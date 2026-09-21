import Address from "../models/addressModel.js";
import Cart from "../models/cartModel.js";
import Coupon from "../models/couponModel.js";
import Orders from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import Wallet from "../models/walletModel.js";
import Wishlist from "../models/wishlistModel.js";
import dotenv from "dotenv";
dotenv.config();
import Razorpay from "razorpay";
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

let instance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY,
});
const onlinePay = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      address: addressId,
      paymentMethod,
      paymentStatus,
      amount,
      couponCode,
    } = req.body;

    const cart = await Cart.findOne({ userId });
    const address = await Address.findById(addressId);

    if (!address) {
      return res
        .status(400)
        .json({ success: false, message: "Address not found" });
    }

    // ✅ Generate unique order ID
    function generateOrderId() {
      const timestamp = Date.now().toString();
      const randomChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let orderId = "ORD";
      while (orderId.length < 6) {
        const randomIndex = Math.floor(Math.random() * randomChars.length);
        orderId += randomChars.charAt(randomIndex);
      }
      return orderId + timestamp.slice(-6);
    }

    const newOrderId = generateOrderId();

    let productDataToSave = [];

    if (req.session.buyNowProductId) {
      const product = await Product.findById(req.session.buyNowProductId);
      if (product) {
        productDataToSave = [
          {
            productId: product._id,
            quantity: 1,
            price: product.saleprice,
          },
        ];
        delete req.session.buyNowProductId;
        await req.session.save();
      }
    } else if (cart && cart.product.length > 0) {
      productDataToSave = cart.product;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "No products found to order" });
    }

    // ✅ Handle optional coupon calculation (do NOT burn coupon here; coupon is only redeemed once payment succeeds in saveOrder)
    let couponDiscount = 0;
    let normalizedCouponCode = "";
    if (couponCode && couponCode.trim() !== "") {
      const cleanCode = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({
        $or: [
          { couponCode: cleanCode },
          { couponCode: new RegExp(`^${couponCode.trim()}$`, "i") }
        ],
        isActive: true,
        expirationDate: { $gte: new Date() }
      });
      if (coupon) {
        normalizedCouponCode = coupon.couponCode;
        if (!coupon.minimumPurchase || amount >= coupon.minimumPurchase) {
          let discount = amount * (coupon.discountAmount / 100);
          if (coupon.maxDiscount > 0)
            discount = Math.min(discount, coupon.maxDiscount);
          couponDiscount = Math.round(discount);
        }
      }
    }

    // ✅ Create the new order with Pending paymentStatus
    const order = new Orders({
      orderId: newOrderId,
      userId,
      paymentMethod,
      paymentStatus,
      totalAmount: amount,
      couponDiscount,
      couponCode: normalizedCouponCode || couponCode || "",
      product: productDataToSave,
      address,
    });

    await order.save();

    // ✅ Create Razorpay order in INR (amount in paise: 1 INR = 100 paise)
    const order2 = await instance.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: userId.toString(),
    });

    return res.json({ success: true, order, order2 });
  } catch (error) {
    console.error("❌ Error in onlinePay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponCode } = req.body;

    const coupon = await Coupon.findOne({
      couponCode,
      isActive: true,
      expirationDate: { $gte: Date.now() },
    });

    const cart = await Cart.findOne({ userId });
    const address = await Address.findOne({ _id: req.body.address });

    // 🆔 generate order ID
    function generateOrderId() {
      const timestamp = Date.now().toString();
      const randomChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let orderId = "ORD";
      while (orderId.length < 6) {
        const randomIndex = Math.floor(Math.random() * randomChars.length);
        orderId += randomChars.charAt(randomIndex);
      }
      return orderId + timestamp.slice(-6);
    }

    const newOrderId = generateOrderId();
    const orderItems = cart.product;

    // 💰 default payment status
    let paymentStatus = "Pending";

    if (req.body.paymentMethod === "Wallet") {
      paymentStatus = "Received";
      const userWallet = await Wallet.findOne({ userId });

      if (userWallet && userWallet.balance >= req.body.amount) {
        userWallet.balance -= req.body.amount;
        userWallet.history.push({
          amount: req.body.amount,
          type: "debit",
        });
        await userWallet.save();
      } else {
        return res.json({ message: "Insufficient wallet balance" });
      }
    }
    let couponDiscount = 0;

    if (coupon && req.body.couponCode) {
      const totalAmount = req.body.amount;

      if (totalAmount >= coupon.minimumPurchase) {
        let discount = totalAmount * (coupon.discountAmount / 100);

        if (coupon.maxDiscount && coupon.maxDiscount > 0) {
          discount = Math.min(discount, coupon.maxDiscount);
        }

        couponDiscount = discount;

        // ✅ mark coupon as used only after payment success
        coupon.redeemedUsers.push({ userId, usedTime: new Date() });
        coupon.timesUsed++;
        await coupon.save();
      }
    }

    // 🛒 save order product details
    let productDataToSave;

    if (req.session.buyNowProductId) {
      const product = await Product.findById(req.session.buyNowProductId);
      if (product) {
        productDataToSave = {
          productId: product._id,
          quantity: 1,
          price: product.saleprice,
        };

        // update stock
        if (product.stock > 0) {
          product.stock -= 1;
          await product.save();
        }

        delete req.session.buyNowProductId;
        await req.session.save();
      }
    } else {
      productDataToSave = cart.product;
    }

    // 🧾 create and save order
    const order = new Orders({
      orderId: newOrderId,
      userId,
      paymentMethod: req.body.paymentMethod,
      paymentStatus,
      totalAmount: req.body.amount,
      product: productDataToSave,
      address,
      couponDiscount,
      couponCode: req.body.couponCode || "",
    });

    await order.save();

    // 🏷️ update product stocks
    for (const item of orderItems) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock -= item.quantity;
        await product.save();
      }
    }

    res.status(200).json({ message: "Order Placed Successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Something went wrong while placing order." });
  }
};

const saveOrder = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });

    let productDataToSave;

    if (req.session.buyNowProductId) {
      const product = await Product.findById(req.session.buyNowProductId);
      if (product) {
        productDataToSave = [
          {
            productId: product._id,
            quantity: 1,
            price: product.saleprice,
          },
        ];
        delete req.session.buyNowProductId;
        await req.session.save();
      }
    } else {
      productDataToSave = cart.product;
    }

    if (!Array.isArray(productDataToSave)) {
      productDataToSave = [productDataToSave]; // Convert to array if it's not already
    }

    // Loop through each product in productDataToSave
    for (const item of productDataToSave) {
      const product = await Product.findById(item.productId);
      if (product) {
        // Update stock of the product
        product.stock -= item.quantity;
        await product.save();
      }
    }

    const order = await Orders.findOneAndUpdate(
      { orderId },
      { $set: { paymentStatus: "Received" } },
      { new: true }
    );

    // ✅ Payment confirmed: Now record coupon redemption for this user
    if (order && order.couponCode) {
      const cleanCode = order.couponCode.trim().toUpperCase();
      await Coupon.findOneAndUpdate(
        {
          $or: [
            { couponCode: cleanCode },
            { couponCode: new RegExp(`^${order.couponCode.trim()}$`, "i") }
          ]
        },
        {
          $push: { redeemedUsers: { userId, usedTime: new Date() } },
          $inc: { timesUsed: 1 },
        }
      );
    }

    if (order) {
      res.redirect("/orderSuccess");
    } else {
      res.status(404).send("Order not found");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const cartData = await Cart.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    res.render("cart", {
      cartData,
      name: userData.name,
      cartLength,
      wishlistLength,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;

    const product = await Product.findById(productId);
    if (!product || product.stock === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Product is out of stock" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, product: [] });
    }

    const existingProductIndex = cart.product.findIndex(
      (item) => item.productId.toString() === productId
    );
    const isNew = existingProductIndex === -1; // true only when brand-new item
    if (!isNew) {
      const totalQuantity = cart.product[existingProductIndex].quantity + 1;
      if (totalQuantity > product.stock) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Cannot add more items than available stock",
          });
      }
      cart.product[existingProductIndex].quantity = totalQuantity;
    } else {
      cart.product.push({ productId, quantity: 1, price: product.saleprice });
    }

    await cart.save();

    // uniqueCount = number of distinct products in cart (for the header badge)
    const uniqueCount = cart.product.length;
    const cartLength = cart.product.reduce(
      (total, item) => total + item.quantity,
      0
    );
    res
      .status(200)
      .json({
        success: true,
        message: "Product added to cart successfully",
        cartLength,
        uniqueCount,
        isNew,
      });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please login to update cart" });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || !productId) {
      return res.status(400).json({ success: false, message: "Invalid quantity or product ID" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, product: [] });
    }

    const productIndex = cart.product.findIndex((item) => {
      const itemPid = item.productId && item.productId._id 
        ? item.productId._id.toString() 
        : (item.productId ? item.productId.toString() : "");
      return itemPid === productId.toString();
    });

    if (productIndex !== -1) {
      const product = await Product.findById(productId);
      const currentQty = cart.product[productIndex].quantity;
      const targetQty = currentQty + numQty;

      if (numQty > 0) {
        if (product && targetQty > product.stock) {
          return res.status(400).json({
            success: false,
            message: `Only ${product.stock} units available in stock.`,
            maxStock: product.stock,
            currentQuantity: currentQty,
          });
        }
        cart.product[productIndex].quantity = targetQty;
      } else if (numQty < 0) {
        if (targetQty > 0) {
          cart.product[productIndex].quantity = targetQty;
        } else {
          cart.product.splice(productIndex, 1);
        }
      }
    } else if (numQty > 0) {
      const product = await Product.findById(productId);
      const price = product ? product.saleprice : 0;
      cart.product.push({ productId, quantity: numQty, price });
    }

    await cart.save();

    const updatedItem = productIndex !== -1 && cart.product[productIndex] 
      ? cart.product[productIndex] 
      : null;

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      newQuantity: updatedItem ? updatedItem.quantity : 0,
      cartLength: cart.product.length,
    });
  } catch (error) {
    console.error("Error in updateCart:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update cart" });
  }
};

const removeItem = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please login" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const productIndex = cart.product.findIndex((item) => {
      const itemPid = item.productId && item.productId._id 
        ? item.productId._id.toString() 
        : (item.productId ? item.productId.toString() : "");
      return itemPid === productId.toString();
    });

    if (productIndex !== -1) {
      cart.product.splice(productIndex, 1);
      await cart.save();
      return res.status(200).json({
        success: true,
        message: "Product removed from cart",
        cartLength: cart.product.length,
      });
    } else {
      return res.status(404).json({ success: false, message: "Product not found in cart" });
    }
  } catch (error) {
    console.error("Error in removeItem:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to remove item" });
  }
};

const isCartEmpty = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.product.length === 0) {
      res.redirect("/home");
    } else {
      next();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const loadCheckOut = async (req, res) => {
  try {
    let userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    const userData = await User.findOne({ _id: userId });
    const addressData = await Address.find({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const cartData = await Cart.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    res.render("checkout", {
      name: userData.name,
      cartData,
      addresses: addressData,
      cartLength,
      wishlistLength,
    });
  } catch (error) {
    console.log(error);
  }
};

const loadCheckOut1 = async (req, res) => {
  try {
    let userId = req.session.user;
    let id = req.query.id;
    req.session.buyNowProductId = id;
    req.session.save();
    const product = await Product.findOne({ _id: id });
    const userData = await User.findOne({ _id: userId });
    const addressData = await Address.find({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const cartData = await Cart.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    res.render("checkout", {
      name: userData.name,
      addresses: addressData,
      product,
      cartLength,
      wishlistLength,
    });
  } catch (error) {
    console.log(error);
  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      couponName,
      couponCode,
      minimumPurchase,
      discountAmount,
      maxDiscount,
      expirationDate,
    } = req.body;

    const code = (couponCode || "").trim().toUpperCase();
    const name = (couponName || "").trim();
    const couponData = await Coupon.find().sort({ Date: -1 });

    if (!code || !name) {
      return res.render("Coupon", { couponData, errorMessage: "Name and Code are required." });
    }

    const expiryDate = new Date(expirationDate);
    expiryDate.setHours(23, 59, 59, 999);
    const now = new Date();

    if (expiryDate < now) {
      return res.render("Coupon", { expiredDate: true, couponData });
    }

    const existingCoupon = await Coupon.findOne({
      $or: [
        { couponCode: code },
        { couponCode: new RegExp(`^${code}$`, "i") }
      ]
    });

    if (existingCoupon) {
      return res.render("Coupon", { couponExists: true, couponData });
    }

    const coupon = new Coupon({
      couponName: name,
      couponCode: code,
      minimumPurchase: Number(minimumPurchase) || 0,
      discountAmount: Number(discountAmount) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      expirationDate: expiryDate,
      isActive: true,
      timesUsed: 0,
      redeemedUsers: [],
    });

    await coupon.save();
    return res.redirect("/admin/loadCoupon");
  } catch (error) {
    console.error("Error in addCoupon:", error);
    const couponData = await Coupon.find().sort({ Date: -1 });
    return res.render("Coupon", { couponData, errorMessage: error.message || "Failed to create coupon" });
  }
};

const ToggleblockCoupon = async (req, res) => {
  try {
    const Couid = req.query.Couid || req.body.Couid;
    const coupons = await Coupon.findOne({ _id: Couid });
    if (!coupons) {
      if (req.xhr || req.headers.accept?.includes("json") || req.headers["content-type"]?.includes("json")) {
        return res.status(404).json({ success: false, message: "Coupon not found" });
      }
      return res.redirect("/admin/loadCoupon");
    }
    coupons.isActive = !coupons.isActive;
    await coupons.save();
    if (req.xhr || req.headers.accept?.includes("json") || req.headers["content-type"]?.includes("json")) {
      return res.json({
        success: true,
        isActive: coupons.isActive,
        message: `Coupon ${coupons.isActive ? "unblocked" : "blocked"} successfully`,
      });
    }
    return res.redirect("/admin/loadCoupon");
  } catch (error) {
    console.error("Error in ToggleblockCoupon:", error);
    if (req.xhr || req.headers.accept?.includes("json") || req.headers["content-type"]?.includes("json")) {
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.redirect("/admin/loadCoupon");
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user;

    if (couponCode && userId) {
      const cleanCode = couponCode.trim().toUpperCase();
      await Coupon.findOneAndUpdate(
        {
          $or: [
            { couponCode: cleanCode },
            { couponCode: new RegExp(`^${couponCode.trim()}$`, "i") }
          ]
        },
        {
          $pull: { redeemedUsers: { userId: userId.toString() } },
          $inc: { timesUsed: -1 }
        }
      );
    }

    return res.json({ success: true, message: "Coupon removed successfully" });
  } catch (error) {
    console.error("Error in removeCoupon:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, selectedAmount } = req.body;
    const userId = req.session.user;

    if (!couponCode || couponCode.trim() === "") {
      return res.json({ success: false, message: "Please enter a coupon code." });
    }

    const cleanCode = couponCode.trim().toUpperCase();

    // Find coupon by exact or case-insensitive code
    const coupon = await Coupon.findOne({
      $or: [
        { couponCode: cleanCode },
        { couponCode: new RegExp(`^${couponCode.trim()}$`, "i") }
      ]
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Invalid coupon code.",
      });
    }

    if (!coupon.isActive) {
      return res.json({
        success: false,
        message: "This coupon is currently inactive or blocked.",
      });
    }

    if (new Date(coupon.expirationDate) < new Date()) {
      return res.json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    // Check if this user is recorded in redeemedUsers
    const alreadyRedeemed =
      coupon.redeemedUsers &&
      coupon.redeemedUsers.some(
        (u) => u.userId && u.userId.toString() === userId.toString()
      );

    if (alreadyRedeemed) {
      // Auto-heal check: Check if the user actually has a completed, non-cancelled order with this coupon
      const activeCompletedOrder = await Orders.findOne({
        userId,
        couponCode: { $in: [coupon.couponCode, cleanCode] },
        $or: [
          { paymentStatus: "Received", orderStatus: { $ne: "Cancelled" } },
          { paymentMethod: "Cash On Delivery", orderStatus: { $ne: "Cancelled" } },
          { paymentMethod: "Wallet", orderStatus: { $ne: "Cancelled" } }
        ]
      });

      if (!activeCompletedOrder) {
        // User closed modal, abandoned checkout, or order was cancelled previously:
        // Auto-heal by removing them from redeemedUsers so coupon can be used again!
        await Coupon.findOneAndUpdate(
          { _id: coupon._id },
          {
            $pull: { redeemedUsers: { userId: userId.toString() } },
            $inc: { timesUsed: -1 }
          }
        );
      } else {
        return res.json({ success: false, message: "You have already used this coupon." });
      }
    }

    const currentTotal = Number(selectedAmount) || 0;

    if (coupon.minimumPurchase && currentTotal < coupon.minimumPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required for this coupon.`,
      });
    }

    let discount = currentTotal * (coupon.discountAmount / 100);
    if (coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = Math.round(discount);

    return res.json({
      success: true,
      message: `Coupon "${coupon.couponName}" applied successfully!`,
      couponName: coupon.couponName,
      couponCode: coupon.couponCode,
      discountPercent: coupon.discountAmount,
      discountAmount: discount,
      couponId: coupon._id,
    });
  } catch (err) {
    console.error("Error in applyCoupon:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    cart.product = [];
    await cart.save();
    res.json({ message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res
      .status(500)
      .json({ error: "An error occurred while clearing the cart" });
  }
};
const googleAuth = async (req, res) => {
  try {
    const user = req.body.user;
    const email = user.email;
    // Check if user already exists
    let userData;
    const existingUser = await User.findOne({ email });
    const generateReferralCode = () => {
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += characters[Math.floor(Math.random() * characters.length)];
      }
      return code;
    };
    const referralCode = generateReferralCode();
    if (existingUser) {
      if (!existingUser.is_active) {
        return res.json({
          success: false,
          banned: true,
          message: "Your account has been blocked by the administrator. Please contact support.",
        });
      }
      // User already exists, set session for existing user
      req.session.user = existingUser._id;
      userData = existingUser;
    } else {
      // Create a new user
      const newuser = new User({
        name: user.displayName,
        email: user.email,
        mobile: user.phoneNumber,
        referralCode: referralCode,
      });

      userData = await newuser.save();
    }

    // If user data is successfully obtained, respond with success message
    if (userData) {
      req.session.user = userData._id;
      return res.json({
        success: true,
        message: "User data saved successfully",
      });
    } else {
      // If user data retrieval fails, render registration page with error message
      return res.render("registeration", { errmessage: "." });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

export default {
  getCart,
  addToCart,
  updateCart,
  removeItem,
  isCartEmpty,
  loadCheckOut,
  loadCheckOut1,
  placeOrder,
  addCoupon,
  ToggleblockCoupon,
  clearCart,
  applyCoupon,
  onlinePay,
  removeCoupon,
  saveOrder,
  googleAuth,
};
