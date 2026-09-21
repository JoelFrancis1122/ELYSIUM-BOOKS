import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Address from "../models/addressModel.js";
import Wallet from "../models/walletModel.js";
import Cart from "../models/cartModel.js";
import Orders from "../models/orderModel.js";
import Wishlist from "../models/wishlistModel.js";
import Coupon from "../models/couponModel.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import Quote from "inspirational-quotes";
import crypto from "crypto";
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;
let instance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY,
});

const loadGuest = async (req, res) => {
  try {
    let search = req.query.query || "";
    const productData = await Product.aggregate([
      {
        $match: {
          is_Active: true,
          Bookname: { $regex: new RegExp(search, "i") },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "Categories",
          foreignField: "_id",
          as: "Categories",
        },
      },
      {
        $unwind: { path: "$Categories", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategories",
          foreignField: "_id",
          as: "subCategories",
        },
      },
      {
        $unwind: { path: "$subCategories", preserveNullAndEmptyArrays: true },
      },
      {
        $limit: 12,
      },
    ]);
    const quote = Quote.getQuote();
    res.render("home", {
      name: null,
      search: search,
      product: productData,
      quote,
      cartLength: 0,
      wishlistLength: 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const loadlogin = async (req, res) => {
  try {
    if (req.query.blocked === "true") {
      return res.render("login", {
        bannedMessage: "Your account has been blocked by the administrator. Please contact support."
      });
    }
    res.render("login");
  } catch (error) {
    console.error(error);
  }
};

const forgotPass = async (req, res) => {
  try {
    res.render("forgotPass");
  } catch (error) {
    console.error(error);
  }
};

const forgotpassword = async (req, res) => {
  try {
    const email = req.body.email;
    req.session.forgotemail = email;
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: { user: process.env.EMAIL, pass: process.env.PASS },
    });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: "Email not found" });
    const token = Math.random().toString(36).substr(2, 8);
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    const mailOptions = {
      from: "joelfrancis2005@gmail.com",
      to: email,
      subject: "Reset Password",
      text:
        `You are receiving this because you (or someone else) have requested to reset your password.\n\n` +
        `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
        `http://${req.headers.host}/getResetPassword/${token}\n\n` +
        `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).send({ message: "Error sending email" });
      }
      console.log("Email sent: " + info.response);
      res.status(200).send({ message: "Reset email sent" });
    });
  } catch (error) {
    console.log(error);
  }
};

const getResetPassword = async (req, res) => {
  const token = req.params.token;
  try {
    res.render("passReset", { token });
  } catch (error) {
    console.log(error.message);
  }
};

const resetpassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;
  if (password !== confirmPassword)
    return res.status(400).send({ message: "Passwords do not match" });
  try {
    const user = await User.findOne({ email: req.session.forgotemail });
    if (!user)
      return res
        .status(400)
        .send({ message: "Time limit exeeded resend email" });
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).send({ message: "Internal server error" });
      }
      console.log("Session destroyed");
      res.status(200).send({ message: "Password updated successfully" });
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Server error" });
  }
};

const loadHome = async (req, res) => {
  try {
    let search = req.query.query || "";
    let userId = req.session.user;

    const cartData = await Cart.findOne({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;
    console.log("Cart Length:", cartLength, "Wishlist Length:", wishlistLength);

    const productData = await Product.find({
      is_Active: true,
      Bookname: { $regex: new RegExp(search, "i") },
    })
      .populate("Categories")
      .populate("subCategories")
      .limit(12);
    const quote = Quote.getQuote();
    const userData = await User.findOne({ _id: userId });

    res.render("home", {
      product: productData,
      name: userData.name,
      search: search,
      cartLength,
      wishlistLength,
      quote,
    });
  } catch (error) {
    console.error("Error in loadHome:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadLogout = async (req, res) => {
  try {
    const isBlockedUser = req.query.blocked === "true";
    if (req.session) {
      delete req.session.user;
    }

    req.session.save(() => {
      if (isBlockedUser) {
        return res.redirect("/login?blocked=true");
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
};

const applyReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.session.user;

    const referredUser = await User.findOne({ referralCode: referralCode });

    if (!referredUser) {
      return res.json({ success: false, message: "Invalid referral code!" });
    }

    if (referredUser._id.toString() === userId.toString()) {
      return res.json({
        success: false,
        message: "You cannot use your own referral code!",
      });
    }

    const user = await User.findById(userId);
    if (user.alreadyReffered) {
      return res.json({
        success: false,
        message: "Referral code already used!",
      });
    }
    user.alreadyReffered = true;
    const userSaved = await user.save();
    console.log("User saved : ", userSaved);
    const referredUserWallet = await Wallet.findOne({
      userId: referredUser._id,
    });
    referredUserWallet.balance += 100;
    referredUserWallet.history.push({
      amount: 100,
      type: "credit",
    });
    await referredUserWallet.save();
    const userWallet = await Wallet.findOne({ userId: userId });
    userWallet.balance += 100;
    userWallet.history.push({
      amount: 100,
      type: "credit",
    });
    await userWallet.save();
    res.json({ success: true, message: "Referral code applied successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const isJson = req.xhr || req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json');

    const userData = await User.findOne({ email });
    if (!userData) {
      const msg = "User not found";
      if (isJson) return res.json({ success: false, message: msg });
      return res.render("login", { errmessage: msg });
    }

    if (!userData.is_active) {
      const blockedMsg = "Your account has been blocked by the administrator. Please contact support.";
      if (isJson) return res.json({ success: false, isBlocked: true, message: blockedMsg });
      return res.render("login", { bannedMessage: blockedMsg });
    }

    if (userData.is_admin) {
      const msg = "Admins cannot log in here";
      if (isJson) return res.json({ success: false, message: msg });
      return res.render("login", { errmessage: msg });
    }

    if (!userData.password) {
      const msg = "Please sign in using Google or reset your password.";
      if (isJson) return res.json({ success: false, message: msg });
      return res.render("login", { errmessage: msg });
    }

    const passwordMatch = await bcrypt.compare(password, userData.password);
    if (!passwordMatch) {
      const msg = "Incorrect email or password";
      if (isJson) return res.json({ success: false, message: msg });
      return res.render("login", { errmessage: msg });
    }

    req.session.user = userData._id;
    if (isJson) return res.json({ success: true, redirectUrl: "/home" });
    return res.redirect("/home");
  } catch (error) {
    console.error("Error in verifyLogin:", error);
    if (req.xhr || req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
    res.status(500).send("Internal Server Error");
  }
};

const signup = async (req, res) => {
  try {
    res.render("registeration", { emailExists: false });
  } catch (error) {
    console.error(error);
  }
};

const verifySignup = async (req, res) => {
  try {
    const matchEmail = await User.findOne({ email: req.body.email });
    if (matchEmail) return res.render("registeration", { emailExists: true });
    if (req.body.password === req.body.cpassword) {
      const datafromRegister = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        mobile: req.body.mobile,
      };
      console.log(datafromRegister,"avinadhh")
      req.session.data = datafromRegister;
      res.redirect("/getOtp");
    }
  } catch (error) {
    console.error(error);
  }
};

const getOtp = async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: "joelfrancis2005@gmail.com",
        pass: "pxid psxq tcmm nwro",
      },
    });
    //otp_generation//
    let randomotp = Math.floor(1000 + Math.random() * 9000).toString();
    req.session.otp = randomotp;
    const { email, name } = req.session.data;
    const mailOptions = {
      from: "joelfrancis422@gmail.com",
      to: email,
      subject: `Hello ${name}`,
      text: `Your verification OTP is ${randomotp}`,
    };
    console.log(randomotp);
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email: " + error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    res.render("otp");
  } catch (error) {
    console.error(error);
  }
};

const googleAuth = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Email:", email);
    console.log("Password:", password);
    res.status(200).json({ message: "Data received successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    if (req.session.otp === req.body.otp) {
      const { email, name, mobile, password } = req.session.data;
      const hashedPassword = await bcrypt.hash(password, 10);

      const generateReferralCode = () => {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
          code += characters[Math.floor(Math.random() * characters.length)];
        }
        return code;
      };

      const referralCode = generateReferralCode();
      console.log("referralCode :", referralCode);

      const user = new User({
        name: name,
        email: email,
        mobile: mobile,
        password: hashedPassword,
        referralCode: referralCode,
      });

      const userData = await user.save();
      if (userData) {
        req.session.user = userData._id;
        res.redirect("/home");
      }
    } else {
      res.render("registeration", { errmessage: "." });
    }
  } catch (error) {
    console.error(error);
  }
};

const shopProduct = async (req, res) => {
  try {
    let productId = req.query.id;
    let userId = req.session.user;
    const productData = await Product.findOne({ _id: productId }).populate(
      "Categories"
    );
    const relatedProducts = await Product.find({
      Categories: productData.Categories,
      _id: { $ne: productId },
    }); //id
    const userData = await User.findOne({ _id: userId });
    const cartData = await Cart.findOne({ userId: userId });
    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    res.render("singleproduct", {
      product: productData,
      name: userData?.name,
      relatedProducts,
      cartLength,
      wishlistLength,
    });
  } catch (error) {
    console.error(error);
    res.render("error", { error });
  }
};

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });


    const Order = await Orders.find({ userId: userId })
      .populate("userId")
      .sort({ orderDate: -1 });

    const addressData = await Address.find({ userId: userId });
    const coupons = await Coupon.find();
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
      await wallet.save();
    }
    const cartData = await Cart.findOne({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );

    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalOrders = Order.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = Order.slice(startIndex, endIndex);

    res.render("account", {
      userData: userData || {},
      name: userData ? userData.name : '',
      email: userData ? userData.email : '',
      addresses: addressData || [],
      orders: paginatedOrders || [],
      cartLength: cartLength || 0,
      coupons: coupons || [],
      wallet: wallet || { balance: 0, history: [] },
      wishlistLength: wishlistLength || 0,
      currentPage: page,
      totalPages: totalPages || 1,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const productID = req.query.id;

    const orders = await Orders.findOne({ _id: productID }).populate(
      "product.productId"
    );
    const orderData = await Orders.findOne({ _id: productID });
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });
    const cartData = await Cart.findOne({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const couponDiscount = orderData ? orderData.couponDiscount : 0;
    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;

    res.render("ordersdetail", {
      orders,
      user: userData,
      address: addressData,
      cartData,
      cartLength: cartLength,
      orderData,
      wishlistLength,
      couponDiscount,
    });
  } catch (error) {
    res.render("error", { error });
  }
};

const loadShop = async (req, res) => {
  try {
    const categories = await Category.find({ is_Active: true });
    const userId = req.session.user;
    let { query: search, category, filter } = req.query;
    const userData = await User.findOne({ _id: userId });
    const cartData = await Cart.findOne({ userId: userId });
    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const cartLength = cartData ? cartData.product.length : 0;
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;
    let products;
    const query = { is_Active: true };
    if (search) query.Bookname = { $regex: new RegExp(search, "i") };
    if (category) {
      const categoryObj = await Category.findOne({
        categoryName: category,
        is_Active: true,
      });
      if (!categoryObj) {
        console.warn(`Category not found for: ${category}`);
      } else {
        query.Categories = categoryObj._id;
      }
    }

    if (filter) {
      switch (filter) {
        case "low-high":
          if (products) {
            products = products.sort({ saleprice: 1 });
          } else {
            products = await Product.find(query).sort({ saleprice: 1 });
          }
          break;
        case "high-low":
          if (products) {
            products = products.sort({ saleprice: -1 });
          } else {
            products = await Product.find(query).sort({ saleprice: -1 });
          }
          break;
        default:
          console.warn(`Unknown filter type: ${filter}`);
          break;
      }
    } else {
      if (!products) {
        products = await Product.aggregate([
          { $match: query },
          {
            $lookup: {
              from: "categories",
              localField: "Categories",
              foreignField: "_id",
              as: "Categories",
            },
          },
          { $unwind: "$Categories" },
          { $match: { "Categories.is_Active": true } },
        ]);
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = products.slice(startIndex, endIndex);
    res.render("shop", {
      product: paginatedProducts,
      categories,
      name: userData?.name ?? null,
      search,
      category,
      cartLength,
      wishlistLength,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const profileEdit = async (req, res) => {
  try {
    res.render("changePass");
  } catch (error) {
    console.error(error);
  }
};

const profileEdit2 = async (req, res) => {
  try {
    const { password, npassword, cnpassword } = req.body;

    const userId = req.session.user;
    const user = await User.findOne({ _id: userId });

    if (!user) {
      console.error("User not found");
      res.redirect("/loadProfile");
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.json({ message: "Current password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(npassword, 10); // 10 is the salt rounds
    const updated = await User.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );
    if (updated) {
      console.log("Password updated successfully");
      return res.json({
        success: true,
        message: "Password updated successfully!",
      });
    } else {
      console.error("Failed to update password");
      return res.json({ success: false, message: "Failed to update password" });
    }
  } catch (error) {
    console.error(error);
  }
};

const editUsername = async (req, res) => {
  try {
    const { newUsername, currentPassword } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(400).send({ message: "Invalid password" });
    }

    user.name = newUsername;
    await user.save();

    res.status(200).send({ message: "Username updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const addTowallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      amount,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }
    if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac("sha256", RAZORPAY_SECRET_KEY)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res
          .status(400)
          .json({ success: false, message: "Payment verification failed" });
      }

      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: parsedAmount,
          history: [
            { amount: parsedAmount, type: "credit", createdAt: new Date() },
          ],
        });
      } else {
        wallet.balance += parsedAmount;
        wallet.history.push({
          amount: parsedAmount,
          type: "credit",
          createdAt: new Date(),
        });
      }
      await wallet.save();

      return res.json({
        success: true,
        message: "Wallet updated successfully",
      });
    }

    const order = await instance.orders.create({
      amount: Math.round(Number(parsedAmount) * 100),
      currency: "INR",
      receipt: userId.toString(),
    });

    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Error in addToWallet:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    let product = await Product.findOne({ userId });

    const wishlistData = await Wishlist.findOne({ userId: userId }).populate(
      "product.productId"
    );
    const wishlistLength = wishlistData ? wishlistData.product.length : 0;
    res.render("wishlist", {
      wishlistData,
      name: userData.name,
      wishlistLength,
    });
  } catch (error) {
    console.error(error);
  }
};

const wishlist = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, product: [] });
    }
    const existingProductIndex = wishlist.product.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (existingProductIndex !== -1) {
      wishlist.product[existingProductIndex].quantity += 1;
    } else {
      wishlist.product.push({ productId, quantity: 1 });
    }
    await wishlist.save();
    res.redirect("/getWishlist");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const removeWish = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      console.log("wishlist not found");
    }
    const productIndex = wishlist.product.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (productIndex !== -1) {
      wishlist.product.splice(productIndex, 1);
      const updateCart = await wishlist.save();
      return res.status(200).send("Product removed from the wishlist");
    } else {
      return res.status(404).send("Product not found in the wishlist");
    }
  } catch (error) {
    console.error(error.message);
  }
};

export default {
  loadGuest,
  loadHome,
  loadLogout,
  loadlogin,
  signup,
  verifySignup,
  getOtp,
  verifyOtp,
  verifyLogin,
  shopProduct,
  loadProfile,
  loadShop,
  profileEdit,
  profileEdit2,
  addTowallet,
  getWishlist,
  wishlist,
  removeWish,
  googleAuth,
  editUsername,
  forgotPass,
  forgotpassword,
  getResetPassword,
  resetpassword,
  applyReferral,
  loadOrderDetails,
};
