import Address from "../models/addressModel.js";
import User from "../models/userModel.js";
import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";

const loadAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const [userData, cartData, wishlistData] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId }),
      Wishlist.findOne({ userId })
    ]);
    res.render("addAddress", {
      name: userData?.name ?? null,
      cartLength: cartData ? cartData.product.length : 0,
      wishlistLength: wishlistData ? wishlistData.product.length : 0,
    });
  } catch (error) {
    console.error(error);
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, mobile, houseName, city, state, pinCode } = req.body;
    const address = new Address({
      userId: userId,
      name: name,
      mobile: mobile,
      houseName: houseName,
      city: city,
      state: state,
      pinCode: pinCode,
    });
    const savedAddress = await address.save();
    res.redirect("/loadProfile");
  } catch (error) {
    console.error(error);
  }
};

const addAddress1 = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, mobile, houseName, city, state, pinCode } = req.body;
    const address = new Address({
      userId: userId,
      name: name,
      mobile: mobile,
      houseName: houseName,
      city: city,
      state: state,
      pinCode: pinCode,
    });
    const savedAddress = await address.save();
    res.redirect("/loadCheckOut");
  } catch (error) {
    console.error(error);
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const [addressData, userData, cartData, wishlistData] = await Promise.all([
      Address.findById(req.query.id),
      User.findById(userId),
      Cart.findOne({ userId }),
      Wishlist.findOne({ userId })
    ]);
    res.render("editAddress", {
      addresses: addressData,
      name: userData?.name ?? null,
      cartLength: cartData ? cartData.product.length : 0,
      wishlistLength: wishlistData ? wishlistData.product.length : 0,
    });
  } catch (error) {
    console.error(error);
  }
};

const loadEditAddress1 = async (req, res) => {
  try {
    const userId = req.session.user;
    const [addressData, userData, cartData, wishlistData] = await Promise.all([
      Address.findById(req.query.id),
      User.findById(userId),
      Cart.findOne({ userId }),
      Wishlist.findOne({ userId })
    ]);
    res.render("editAddressProfile", {
      addresses: addressData,
      name: userData?.name ?? null,
      cartLength: cartData ? cartData.product.length : 0,
      wishlistLength: wishlistData ? wishlistData.product.length : 0,
    });
  } catch (error) {
    console.error(error);
  }
};

const updateAddress = async (req, res) => {
  try {
    const { name, mobile, houseName, city, state, pinCode } = req.body;
    const userId = req.session.user;
    const updated = await Address.findByIdAndUpdate(
      { _id: req.query.id },
      { $set: { name, mobile, houseName, city, state, pinCode } }
    );
    res.redirect("/loadCheckOut");
  } catch (error) {
    console.error(error);
  }
};

const updateAddress1 = async (req, res) => {
  try {
    const { name, mobile, houseName, city, state, pinCode } = req.body;
    const userId = req.session.user;
    const updated = await Address.findByIdAndUpdate(
      { _id: req.query.id },
      { $set: { name, mobile, houseName, city, state, pinCode } }
    );
    res.redirect("/loadProfile");
  } catch (error) {
    console.error(error);
  }
};

const removeAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    const deletedAddress = await Address.findOneAndDelete({ _id: addressId });
    res.status(200).json({ message: "Address removed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export default {
  removeAddress,
  updateAddress1,
  updateAddress,
  loadEditAddress1,
  loadEditAddress,
  addAddress1,
  addAddress,
  loadAddAddress,
};
