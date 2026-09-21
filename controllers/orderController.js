import Product from "../models/productModel.js";
import Wallet from "../models/walletModel.js";
import Orders from "../models/orderModel.js";
import User from "../models/userModel.js";
import Address from "../models/addressModel.js";
import Coupon from "../models/couponModel.js";
import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";

import cron from "node-cron";

const OrderCancelled = async (req, res) => {
  try {
    const orderId = req.query.id;
    const userId = req.session.user;

    const cancelledOrder = await Orders.findOne({ _id: orderId, userId: userId });

    if (!cancelledOrder) {
      return res.redirect("/loadProfile");
    }

    // Do not allow cancellation if already cancelled, returned, or delivered
    if (
      cancelledOrder.orderStatus === "Cancelled" ||
      cancelledOrder.orderStatus === "Returned" ||
      cancelledOrder.orderStatus === "Delivered"
    ) {
      return res.redirect("/loadProfile");
    }

    // Restore stock for items that are not already cancelled or returned
    for (const item of cancelledOrder.product) {
      if (item.productStatus !== "Cancelled" && item.productStatus !== "Returned") {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
        item.productStatus = "Cancelled";
      }
    }

    cancelledOrder.orderStatus = "Cancelled";

    // Refund to wallet if paymentStatus is Received and totalAmount > 0
    if (cancelledOrder.paymentStatus === "Received") {
      const refundAmount = parseFloat(cancelledOrder.totalAmount) || 0;
      if (refundAmount > 0) {
        let wallet = await Wallet.findOne({ userId: userId });
        if (!wallet) {
          wallet = new Wallet({ userId: userId, balance: 0, history: [] });
        }
        wallet.balance += refundAmount;
        wallet.history.push({
          amount: refundAmount,
          type: "credit",
          createdAt: new Date(),
        });
        await wallet.save();
      }
      cancelledOrder.paymentStatus = "Refund";
    }

    // Restore coupon for reuse if used on this order
    if (cancelledOrder.couponCode) {
      await Coupon.findOneAndUpdate(
        { couponCode: cancelledOrder.couponCode },
        {
          $pull: { redeemedUsers: { userId: userId.toString() } },
          $inc: { timesUsed: -1 },
        }
      );
    }

    cancelledOrder.totalAmount = 0;
    await cancelledOrder.save();

    res.redirect("/loadProfile");
  } catch (error) {
    console.error("Error in OrderCancelled:", error);
    res.status(500).send("Internal Server Error");
  }
};

const orderReturn = async (req, res) => {
  try {
    const orderId = req.query.id;
    const userId = req.session.user;

    const returnedOrder = await Orders.findOne({ _id: orderId, userId: userId });

    if (!returnedOrder) {
      return res.redirect("/loadProfile");
    }

    // Only allow return if delivered and not already returned or cancelled
    if (
      returnedOrder.orderStatus !== "Delivered" ||
      returnedOrder.orderStatus === "Returned"
    ) {
      return res.redirect("/loadProfile");
    }

    // Restore stock for items not already returned or cancelled
    for (const item of returnedOrder.product) {
      if (item.productStatus !== "Returned" && item.productStatus !== "Cancelled") {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
        item.productStatus = "Returned";
      }
    }

    returnedOrder.orderStatus = "Returned";

    // Since order was delivered, customer paid (either online or COD upon delivery)
    if (returnedOrder.paymentStatus !== "Refund") {
      const refundAmount = parseFloat(returnedOrder.totalAmount) || 0;
      if (refundAmount > 0) {
        let wallet = await Wallet.findOne({ userId: userId });
        if (!wallet) {
          wallet = new Wallet({ userId: userId, balance: 0, history: [] });
        }
        wallet.balance += refundAmount;
        wallet.history.push({
          amount: refundAmount,
          type: "credit",
          createdAt: new Date(),
        });
        await wallet.save();
      }
      returnedOrder.paymentStatus = "Refund";
    }

    returnedOrder.totalAmount = 0;
    await returnedOrder.save();

    res.redirect("/loadProfile");
  } catch (error) {
    console.error("Error in orderReturn:", error);
    res.status(500).send("Internal Server Error");
  }
};

const bookCancel = async (req, res) => {
  try {
    const bookid = req.query.id;
    const userId = req.session.user;

    const order = await Orders.findOne({
      userId: userId,
      "product._id": bookid,
    });

    if (!order) {
      return res.redirect("/loadProfile");
    }

    if (
      order.orderStatus === "Delivered" ||
      order.orderStatus === "Returned" ||
      order.orderStatus === "Cancelled"
    ) {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    const cancelledProduct = order.product.find(
      (item) => item._id.toString() === bookid
    );

    if (!cancelledProduct) {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    // Prevent double cancellation of same item
    if (cancelledProduct.productStatus === "Cancelled" || cancelledProduct.productStatus === "Returned") {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    cancelledProduct.productStatus = "Cancelled";

    // Restore stock
    const product = await Product.findById(cancelledProduct.productId);
    if (product) {
      product.stock += cancelledProduct.quantity;
      await product.save();
    }

    // Calculate refund amount for this book
    let refundAmount = cancelledProduct.price * cancelledProduct.quantity;
    if (order.couponDiscount && order.couponDiscount > 0) {
      const discountAmount = (refundAmount * order.couponDiscount) / 100;
      refundAmount -= discountAmount;
    }
    refundAmount = Math.round(refundAmount * 100) / 100;

    const currentTotal = parseFloat(order.totalAmount) || 0;
    order.totalAmount = Math.max(0, parseFloat((currentTotal - refundAmount).toFixed(2)));

    // Check if all products in order are now cancelled
    const allCancelled = order.product.every(
      (item) => item.productStatus === "Cancelled"
    );
    if (allCancelled) {
      order.orderStatus = "Cancelled";
    }

    // Refund to wallet if payment was already received
    if (order.paymentStatus === "Received" && refundAmount > 0) {
      let wallet = await Wallet.findOne({ userId: userId });
      if (!wallet) {
        wallet = new Wallet({ userId: userId, balance: 0, history: [] });
      }
      wallet.balance += refundAmount;
      wallet.history.push({
        amount: refundAmount,
        type: "credit",
        createdAt: new Date(),
      });
      await wallet.save();

      if (allCancelled) {
        order.paymentStatus = "Refund";
      }
    }

    // Restore coupon for reuse if all items in the order were cancelled
    if (allCancelled && order.couponCode) {
      await Coupon.findOneAndUpdate(
        { couponCode: order.couponCode },
        {
          $pull: { redeemedUsers: { userId: userId.toString() } },
          $inc: { timesUsed: -1 },
        }
      );
    }

    await order.save();

    res.redirect(`/loadOrderDetails?id=${order._id}`);
  } catch (error) {
    console.error("Error in bookCancel:", error);
    res.status(500).send({ message: error.message || "Failed to cancel product" });
  }
};

const bookReturn = async (req, res) => {
  try {
    const bookid = req.query.id;
    const userId = req.session.user;

    const order = await Orders.findOne({
      userId: userId,
      "product._id": bookid,
    });

    if (!order) {
      return res.redirect("/loadProfile");
    }

    // Book can only be returned if order is Delivered
    if (order.orderStatus !== "Delivered") {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    const returnedProduct = order.product.find(
      (item) => item._id.toString() === bookid
    );

    if (!returnedProduct) {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    // Prevent double return
    if (returnedProduct.productStatus === "Returned" || returnedProduct.productStatus === "Cancelled") {
      return res.redirect(`/loadOrderDetails?id=${order._id}`);
    }

    returnedProduct.productStatus = "Returned";

    // Restore stock
    const product = await Product.findById(returnedProduct.productId);
    if (product) {
      product.stock += returnedProduct.quantity;
      await product.save();
    }

    // Calculate refund amount
    let refundAmount = returnedProduct.price * returnedProduct.quantity;
    if (order.couponDiscount && order.couponDiscount > 0) {
      const discountAmount = (refundAmount * order.couponDiscount) / 100;
      refundAmount -= discountAmount;
    }
    refundAmount = Math.round(refundAmount * 100) / 100;

    const currentTotal = parseFloat(order.totalAmount) || 0;
    order.totalAmount = Math.max(0, parseFloat((currentTotal - refundAmount).toFixed(2)));

    // Check if all items in order are now returned (or cancelled)
    const allReturned = order.product.every(
      (item) => item.productStatus === "Returned" || item.productStatus === "Cancelled"
    );
    if (allReturned) {
      order.orderStatus = "Returned";
    }

    // Delivered orders have had payment collected
    if (refundAmount > 0) {
      let wallet = await Wallet.findOne({ userId: userId });
      if (!wallet) {
        wallet = new Wallet({ userId: userId, balance: 0, history: [] });
      }
      wallet.balance += refundAmount;
      wallet.history.push({
        amount: refundAmount,
        type: "credit",
        createdAt: new Date(),
      });
      await wallet.save();

      if (allReturned) {
        order.paymentStatus = "Refund";
      }
    }

    await order.save();

    res.redirect(`/loadOrderDetails?id=${order._id}`);
  } catch (error) {
    console.error("Error in bookReturn:", error);
    res.status(500).send({ message: error.message || "Failed to return product" });
  }
};

const orderDetail = async (req, res) => {
  try {
    const id = req.query.id || req.query.orderId;
    if (id) {
      return res.redirect(`/loadOrderDetails?id=${id}`);
    }
    res.redirect("/loadProfile");
  } catch (error) {
    console.error(error);
    res.redirect("/loadProfile");
  }
};

const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const orderId = req.query.id || req.query.orderId;

    let order = null;
    if (orderId) {
      order = await Orders.findOne({ _id: orderId, userId: userId }).populate(
        "product.productId"
      );
    }
    if (!order) {
      order = await Orders.findOne({ userId: userId })
        .sort({ orderDate: -1 })
        .populate("product.productId");
    }

    res.render("orderSuccess", {
      name: userData ? userData.name : "Valued Customer",
      order: order,
      user: userData,
    });
  } catch (error) {
    console.error("Error in orderSuccess:", error);
    res.render("orderSuccess", {
      name: "Customer",
      order: null,
      user: null,
    });
  }
};

const loadInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const productID = req.query.id;
    const [userData, orders, orderData, addressData, cartData, wishlistData] = await Promise.all([
      User.findOne({ _id: userId }),
      Orders.findOne({ _id: productID }).populate("product.productId"),
      Orders.findOne({ _id: productID }),
      Address.findOne({ userId: userId }),
      Cart.findOne({ userId }),
      Wishlist.findOne({ userId })
    ]);

    res.render("invoice", {
      orders,
      address: addressData,
      user: userData,
      orderData,
      name: userData?.name ?? null,
      cartLength: cartData ? cartData.product.length : 0,
      wishlistLength: wishlistData ? wishlistData.product.length : 0,
    });
  } catch (error) {
    console.error(error);
  }
};

cron.schedule("*/5 * * * * *", async () => {
  try {
    const zeroTotalOrders = await Orders.find({
      $or: [{ totalAmount: 0 }, { totalAmount: "0.00" }, { totalAmount: "0" }],
      orderStatus: { $nin: ["Cancelled", "Returned"] },
    });
    if (zeroTotalOrders.length > 0) {
      for (const order of zeroTotalOrders) {
        await Orders.findByIdAndUpdate(order._id, {
          $set: { orderStatus: "Cancelled" },
        });
      }
    }
  } catch (err) {
    console.error("Error in cron order cancellation:", err);
  }
});

export default {
  orderDetail,
  bookReturn,
  bookCancel,
  OrderCancelled,
  orderReturn,
  orderSuccess,
  loadInvoice,
};
