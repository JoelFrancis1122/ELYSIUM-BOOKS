import Category from "../models/categoryModel.js";
import Coupon from "../models/couponModel.js";
import Orders from "../models/orderModel.js";
import Product from "../models/productModel.js";
import SubCategory from "../models/subcategoryModel.js";
import User from "../models/userModel.js";
import Wallet from "../models/walletModel.js";

import bcrypt from "bcrypt";
import cron from "node-cron";

const dashboardLoad = async (req, res) => {
  try {
    const [orders, products] = await Promise.all([
      Orders.find(),
      Product.find(),
    ]);

    const countPerMonth = (items, field) => {
      const counts = Array(12).fill(0);
      for (let i = 0; i < items.length; i++) {
        const date = items[i][field];
        const month = date.getMonth();
        counts[month] += 1;
      }

      return counts;
    };

    //monthlydata
    const orderCountsByMonth = countPerMonth(orders, "orderDate");
    const productCountsByMonth = countPerMonth(products, "CreatedOn");

    //yearlydata
    const getYearlyData = (data, valueField = "count") => {
      const currentYear = new Date().getFullYear();
      const result = Array(12).fill(0);

      for (let i = 0; i < data.length; i++) {
        const year = data[i]._id;
        const index = year - (currentYear - 5);
        if (index >= 0 && index < 12) {
          result[index] = data[i][valueField];
        }
      }

      return result;
    };

    //yearlyorders
    const orderCountsByYearData = await Orders.aggregate([
      { $group: { _id: { $year: "$orderDate" }, orderCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const orderCountsByYear = getYearlyData(
      orderCountsByYearData,
      "orderCount"
    );

    //yearly products
    const productCountsByYearData = await Product.aggregate([
      { $group: { _id: { $year: "$CreatedOn" }, productCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const productCountsByYear = getYearlyData(
      productCountsByYearData,
      "productCount"
    );

    //total revenue
    const totalAmountByMonth = Array(12).fill(0);
    orders.forEach(
      (o) =>
        (totalAmountByMonth[o.orderDate.getMonth()] += parseFloat(
          o.totalAmount
        ))
    );

    const totalAmountByYearData = await Orders.aggregate([
      {
        $group: {
          _id: { $year: "$orderDate" },
          totalAmount: { $sum: { $toDouble: "$totalAmount" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const totalAmountByYear = getYearlyData(
      totalAmountByYearData,
      "totalAmount"
    );

    //best selling products
    const bestSellingProduct = await Orders.aggregate([
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.productId",
          totalSales: { $sum: "$product.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { productName: "$product.Bookname", totalSales: 1 } },
    ]);

    //best selling categories
    const bestSellingCategories = await Orders.aggregate([
      { $unwind: "$product" },
      {
        $lookup: {
          from: "products",
          localField: "product.productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.Categories",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category._id",
          name: { $first: "$category.categoryName" },
          totalSales: { $sum: "$product.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    // console.log(  orders,"orders",
    //   categories,"categories all ",
    //   orderCountsByMonth,"ordercountmonth ", // 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0
    //   productCountsByMonth,"productCountsByMonth", // [0, 4, 11, 3, 0,0, 0, 0, 0, 0, 0, 0]
    //   orderCountsByYear,"orderCOuntbyyear", // [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
    //   productCountsByYear,"productcountbyyear", //[ 1, 0, 0, 0, 15, 2, 0, 0, 0,  0, 0, 0 ]
    //   bestSellingProduct,"bestsellingprodyct",
    //   bestSellingCategories,"bestselling cat",
    //   totalAmountByMonth,"totalamountmonth", //[ 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0 ]
    //   totalAmountByYear,"totalamountyear") //[ 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0 ]
    // // Render
    res.render("admindashboard", {
      orders,
      orderCountsByMonth,
      productCountsByMonth,
      orderCountsByYear,
      productCountsByYear,
      bestSellingProduct,
      bestSellingCategories,
      totalAmountByMonth,
      totalAmountByYear,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const adminlogin = async (req, res) => {
  try {
    res.render("adminLogin");
  } catch (error) {
    console.error(error);
  }
};

const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({ email });

    if (!userData) {
      return res.json({ success: false, message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      return res.json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    if (!userData.is_active) {
      return res.json({
        success: false,
        message: "You are banned from accessing this account",
      });
    }

    req.session.admin = userData._id;
    return res.json({ success: true, redirectUrl: "/admin/dashboard" });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Internal server error" });
  }
};

const productslist = async (req, res) => {
  try {
    let search = req.query.search ? req.query.search : "";
    const productData = await Product.find({
      $and: [
        {
          Bookname: { $regex: new RegExp(search, "i") },
        },
      ],
    })
      .populate("Categories")
      .sort({ CreatedOn: -1 });
    res.render("productslist", { product: productData, search: search });
  } catch (error) {
    console.error(error);
  }
};

//=======================categories================================\\

const loadCategories = async (req, res) => {
  try {
    const catData = await Category.find();
    if (catData) {
      res.render("addcategories", { categories: catData });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const loadSubCategories = async (req, res) => {
  try {
    const catData = await SubCategory.find();
    if (catData) {
      res.render("addSubCategories", { categories: catData });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const addCategories = async (req, res) => {
  try {
    const { categoryName, Description } = req.body;
    const catData = await Category.find();
    const existingCategory = await Category.findOne({
      categoryName: { $regex: new RegExp("^" + categoryName + "$", "i") },
    });
    if (existingCategory) {
      return res.render("addcategories", {
        categoriesExists: true,
        categories: catData,
      });
    } else if (!existingCategory) {
      const categories = new Category({
        categoryName: categoryName,
        Description: Description,
      });
      const categoryData = await categories.save();
      return res.render("addcategories", {
        categoriesExistss: true,
        categories: catData,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
};

const addSubCategories = async (req, res) => {
  try {
    const { subCategoryName, Description } = req.body;
    const catData = await SubCategory.find();
    const existingCategory = await SubCategory.findOne({
      subCategoryName: { $regex: new RegExp("^" + subCategoryName + "$", "i") },
    });
    if (existingCategory) {
      return res.render("addSubcategories", {
        categoriesExists: true,
        categories: catData,
      });
    }
    const categories = new SubCategory({
      subCategoryName: subCategoryName,
      Description: Description,
    });
    const categoryData = await categories.save();
    res.redirect("/admin/loadSubCategories");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
};

const loadeditCategory = async (req, res) => {
  try {
    const categories = await Category.findById(req.query.id);
    req.session.cateid = req.query.id;
    res.render("editcategories", { categories });
  } catch (error) {
    console.error(error);
  }
};

const loadeditSubCategory = async (req, res) => {
  try {
    const categories = await SubCategory.findById(req.query.id);
    req.session.subcateid = req.query.id;
    res.render("editSubcategories", { categories });
  } catch (error) {
    console.log(error);
  }
};

const editCategory = async (req, res) => {
  try {
    const { categoryName, Description, catid } = req.body;
    const existingCategory = await Category.findOne({
      _id: { $ne: req.session.cateid },
      categoryName: { $regex: new RegExp("^" + categoryName + "$", "i") },
    });
    if (existingCategory) {
      res.json({ success: false, error: "Category name must be unique" });
    } else {
      res.json({ success: true, error: "Category name changed successfull" });

      const updated = await Category.findByIdAndUpdate(
        { _id: req.session.cateid },
        { $set: { categoryName, Description } }
      );
      //  res.redirect("/admin/loadCategories")
    }
  } catch (error) {
    console.log(error.message);
  }
};

const editSubCategory = async (req, res) => {
  try {
    const { subCategoryName, Description, catid } = req.body;

    const existingCategory = await SubCategory.findOne({
      _id: { $ne: req.session.subcateid },
      subCategoryName: { $regex: new RegExp("^" + subCategoryName + "$", "i") },
    });

    if (existingCategory) {
      return res.json({
        success: false,
        error: "SubCategory name must be unique",
      });
    } else {
      // Update the SubCategory
      const updated = await SubCategory.findByIdAndUpdate(
        req.session.subcateid,
        { $set: { subCategoryName, Description } }
      );

      // Send success response after updating
      res.json({
        success: true,
        error: "SubCategory name changed successfully",
      });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, error: "SubCategory name must be unique2" });
  }
};

const ToggleblockCategories = async (req, res) => {
  try {
    const catid = req.query.catid;
    const categories = await Category.findOne({ _id: catid });
    categories.is_Active = !categories.is_Active;
    await categories.save();
    res.redirect("/admin/loadCategories");
  } catch (error) {
    console.error(error);
  }
};

const ToggleblockSubCategories = async (req, res) => {
  try {
    const catid = req.query.catid;
    const categories = await SubCategory.findOne({ _id: catid });
    categories.is_Active = !categories.is_Active;
    await categories.save();
    res.redirect("/admin/loadSubCategories");
  } catch (error) {
    console.error(error);
  }
};

const loaduserlist = async (req, res) => {
  try {
    const userData = await User.find({ is_admin: false });
    res.render("userlist", { users: userData });
  } catch (error) {
    console.error(error);
  }
};

const ToggleblockUser = async (req, res) => {
  try {
    const id = req.query.id;
    const user = await User.findOne({ _id: id }); // why new true
    user.is_active = !user.is_active;
    await user.save();
    res.redirect("/admin/loaduserlist");
  } catch (error) {
    console.error(error);
  }
};

const loadOrders = async (req, res) => {
  try {
    const orders = await Orders.find();
    res.render("orderList", { orders: orders });
  } catch (error) {
    console.log(error.message);
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    const orders = await Orders.findOne({ _id: productId }).populate(
      "product.productId"
    );
    const orderData = await Orders.findOne({ _id: productId });
    res.render("ordersview", { orders, orderData });
  } catch (error) {
    console.log(error.message);
  }
};

const loadCoupon = async (req, res) => {
  try {
    const couponData = await Coupon.find().sort({ Date: -1 });
    res.render("Coupon", { couponData });
  } catch (error) {
    console.error(error);
  }
};

const loadLogout = async (req, res) => {
  try {
    if (req.session.admin) {
      delete req.session.admin;
    }
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session on Admin logout:", err);
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error(error);
  }
};

const adminOrderPending = async (req, res) => {
  try {
    const orderId = req.query.id;
    const orderPending = await Orders.findByIdAndUpdate(orderId, {
      $set: { orderStatus: "Order Placed" },
    });
    res.redirect("/admin/loadOrders");
  } catch (error) {
    console.log(error.message);
  }
};

const adminOrderShipped = async (req, res) => {
  try {
    const orderId = req.query.id;
    const orderShipped = await Orders.findByIdAndUpdate(orderId, {
      $set: { orderStatus: "Shipped" },
    });
    res.redirect("/admin/loadOrders");
  } catch (error) {
    console.log(error.message);
  }
};

const adminOrderDelivered = async (req, res) => {
  try {
    const orderId = req.query.id;
    const order = await Orders.findById(orderId);
    if (!order) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      return res.redirect("/admin/loadOrders");
    }

    order.orderStatus = "Delivered";
    // If Cash on delivery, payment is received upon delivery
    if (order.paymentStatus === "Pending") {
      order.paymentStatus = "Received";
    }
    await order.save();

    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.json({ success: true, message: "Order marked as Delivered" });
    }
    res.redirect("/admin/loadOrders");
  } catch (error) {
    console.log(error.message);
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.redirect("/admin/loadOrders");
  }
};

const adminOrderReturned = async (req, res) => {
  try {
    const orderId = req.query.id;
    const order = await Orders.findById(orderId);
    if (!order) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      return res.redirect("/admin/loadOrders");
    }

    // Prevent double return
    if (order.orderStatus === "Returned") {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.json({ success: true, message: "Already marked as Returned" });
      }
      return res.redirect("/admin/loadOrders");
    }

    // Restore stock for items not already returned or cancelled
    for (const item of order.product) {
      if (item.productStatus !== "Returned" && item.productStatus !== "Cancelled") {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
        item.productStatus = "Returned";
      }
    }

    order.orderStatus = "Returned";

    // Refund wallet if not already refunded
    if (order.paymentStatus !== "Refund") {
      const refundAmount = parseFloat(order.totalAmount) || 0;
      if (refundAmount > 0 && order.userId) {
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
          wallet = new Wallet({ userId: order.userId, balance: 0, history: [] });
        }
        wallet.balance += refundAmount;
        wallet.history.push({
          amount: refundAmount,
          type: "credit",
          createdAt: new Date(),
        });
        await wallet.save();
      }
      order.paymentStatus = "Refund";
    }

    order.totalAmount = 0;
    await order.save();

    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.json({ success: true, message: "Order marked as Returned" });
    }
    res.redirect("/admin/loadOrders");
  } catch (error) {
    console.log(error.message);
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.redirect("/admin/loadOrders");
  }
};

const adminOrderCancelled = async (req, res) => {
  try {
    const orderId = req.query.id;
    const order = await Orders.findById(orderId);
    if (!order) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      return res.redirect("/admin/loadOrders");
    }

    // Prevent double cancel
    if (order.orderStatus === "Cancelled") {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.json({ success: true, message: "Already marked as Cancelled" });
      }
      return res.redirect("/admin/loadOrders");
    }

    // Restore stock for items not already cancelled or returned
    for (const item of order.product) {
      if (item.productStatus !== "Cancelled" && item.productStatus !== "Returned") {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
        item.productStatus = "Cancelled";
      }
    }

    order.orderStatus = "Cancelled";

    // Refund wallet if payment was received
    if (order.paymentStatus === "Received") {
      const refundAmount = parseFloat(order.totalAmount) || 0;
      if (refundAmount > 0 && order.userId) {
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
          wallet = new Wallet({ userId: order.userId, balance: 0, history: [] });
        }
        wallet.balance += refundAmount;
        wallet.history.push({
          amount: refundAmount,
          type: "credit",
          createdAt: new Date(),
        });
        await wallet.save();
      }
      order.paymentStatus = "Refund";
    }

    // Restore coupon for customer reuse if coupon was used
    if (order.couponCode && order.userId) {
      await Coupon.findOneAndUpdate(
        { couponCode: order.couponCode },
        {
          $pull: { redeemedUsers: { userId: order.userId.toString() } },
          $inc: { timesUsed: -1 },
        }
      );
    }

    order.totalAmount = 0;
    await order.save();

    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.json({ success: true, message: "Order marked as Cancelled" });
    }
    res.redirect("/admin/loadOrders");
  } catch (error) {
    console.log(error.message);
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.redirect("/admin/loadOrders");
  }
};

const salesReport = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Orders.countDocuments();
    
 
    const totalAmountSummary = await Orders.aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    const grandTotal = totalAmountSummary[0]?.totalAmount || 0;

    const orderList = await Orders.find()
      .populate("userId")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("salesReport", {
      orderList,
      currentPage: page,
      totalPages,
      limit,
      totalOrders,
      grandTotal 
    });
  } catch (error) {
    console.error(error);
  }
};


const salesreportsearch = async (req, res) => {
  try {
    const { start, end } = req.body;

    const page  = parseInt(req.body.page, 10)  || 1;
    const limit = parseInt(req.body.limit, 10) || 10;
    const skip  = (page - 1) * limit;

    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      orderDate: { $gte: new Date(start), $lte: endOfDay },
    };

    const totalOrders = await Orders.countDocuments(filter);

    const totalAmountSummary = await Orders.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    const grandTotal = totalAmountSummary[0]?.totalAmount || 0;

    const orderList = await Orders.find(filter)
      .populate("userId")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("salesReport", {
      orderList,
      start,
      end,
      currentPage: page,
      totalPages,
      limit,
      totalOrders,
      grandTotal 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};


const couponDelete = async (req, res) => {
  try {
    const couponId = req.query.id;

    const deletedCoupon = await Coupon.findOneAndDelete({ _id: couponId });

    if (deletedCoupon) {
      return res.json({
        success: true,
        message: "Coupon deleted successfully",
      });
    } else {
      return res.json({ success: false, message: "Coupon not found" });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const adminOffers = async (req, res) => {
  try {
    const catData = await Category.find();
    const product = await Product.find();
    if (catData) {
      res.render("adminOffer", { categories: catData, product });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const applyAdminOffers = async (req, res) => {
  try {
    const { categoryId, discount, expiry } = req.body;
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { offer: discount, expirationDate: expiry, OfferisActive: true },
      { new: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    const productsToUpdate = await Product.find({ Categories: categoryId });
    if (!productsToUpdate) {
      return res.status(404).json({ message: "product not found" });
    }
    for (const product of productsToUpdate) {
      const updatedPrice = Math.round(
        product.saleprice * ((100 - discount) / 100)
      );
      product.saleprice = updatedPrice;
      await product.save();
    }

    res.status(200).json({
      message: "Offer applied successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const checkingAdminOffers = async () => {
  try {
    const expiredCategories = await Category.find({
      expirationDate: { $lte: new Date() },
      OfferisActive: true,
    });

    for (const category of expiredCategories) {
      category.offer = 0;
      category.expirationDate = null;
      category.OfferisActive = false;
      await category.save();

      const productsToUpdate = await Product.find({ Categories: category._id });
      for (const product of productsToUpdate) {
        product.saleprice = product.Regularprice;
        await product.save();
      }
    }
  } catch (error) {
    console.error("Error checking and resetting expired offers:", error);
  }
};

cron.schedule("0 0 * * *", checkingAdminOffers);

export default {
  dashboardLoad,
  productslist,
  addCategories,
  loadCategories,
  loaduserlist,
  loadLogout,
  loadOrders,
  loadOrderDetails,
  loadCoupon,
  ToggleblockCategories,
  ToggleblockUser,
  adminOrderReturned,
  adminOrderDelivered,
  adminOrderShipped,
  adminOrderPending,
  loadeditCategory,
  editCategory,
  adminOrderCancelled,
  loadSubCategories,
  ToggleblockSubCategories,
  addSubCategories,
  salesReport,
  salesreportsearch,
  couponDelete,
  adminOffers,
  applyAdminOffers,
  loadeditSubCategory,
  editSubCategory,
  adminlogin,
  verifyLogin,
};
