import express from "express"
const userRoute = express()

import Auth from '../middlewares/userAuth.js'

import userControllers from "../controllers/userController.js"
import orderControllers from "../controllers/orderController.js"
import cartControllers from "../controllers/cartController.js"
import addressController from "../controllers/addressController.js"

userRoute.set('view engine', 'ejs')
userRoute.set('views', './views/users')


//--------------------------------------------------
userRoute.get('/', Auth.isLogout, userControllers.loadGuest)
userRoute.get('/login', Auth.isLogout, userControllers.loadlogin)
userRoute.get('/forgotPass', Auth.isLogout, userControllers.forgotPass)
userRoute.post('/forgotpassword', Auth.isLogout, userControllers.forgotpassword)
userRoute.get('/getResetPassword/:token',Auth.isLogout, userControllers.getResetPassword);
userRoute.post('/resetpassword/:token',Auth.isLogout, userControllers.resetpassword);
userRoute.get('/getOtp', Auth.isLogout, userControllers.getOtp)
userRoute.post('/verifyOtp', Auth.isLogout, userControllers.verifyOtp)
userRoute.post('/verifyLogin', userControllers.verifyLogin)
userRoute.get('/signup', Auth.isLogout, userControllers.signup)
userRoute.post('/verifySignup', Auth.isLogout, userControllers.verifySignup)


userRoute.get('/loadShop', userControllers.loadShop)
userRoute.get('/shop-product', userControllers.shopProduct)

userRoute.get('/home', Auth.isLogin, Auth.isBlocked, userControllers.loadHome)
userRoute.get('/logout', Auth.isLogin, userControllers.loadLogout)
userRoute.post('/applyReferral', Auth.isLogin, userControllers.applyReferral)
userRoute.get("/loadProfile", Auth.isLogin, userControllers.loadProfile)


userRoute.patch('/editUsername', Auth.isLogin, userControllers.editUsername)
userRoute.get('/loadAddAddress', Auth.isLogin, addressController.loadAddAddress)
userRoute.post('/addAddress', Auth.isLogin, addressController.addAddress)
userRoute.post('/addAddress1', Auth.isLogin, addressController.addAddress1)
userRoute.get('/loadEditAddress', Auth.isLogin, addressController.loadEditAddress)
userRoute.get('/loadEditAddress1', Auth.isLogin, addressController.loadEditAddress1)
userRoute.put('/updateAddress', Auth.isLogin, addressController.updateAddress)
userRoute.post('/updateAddress', Auth.isLogin, addressController.updateAddress)
userRoute.post('/updateAddress1', Auth.isLogin, addressController.updateAddress1)
userRoute.get('/loadOrderDetails', Auth.isLogin, userControllers.loadOrderDetails)
userRoute.get('/loadInvoice', Auth.isLogin, orderControllers.loadInvoice)
userRoute.get("/cart", Auth.isBlocked, cartControllers.getCart)
userRoute.get('/addToCart', Auth.isBlocked, cartControllers.addToCart)


userRoute.get("/loadCheckOut", Auth.isLogin, cartControllers.isCartEmpty, cartControllers.loadCheckOut)
userRoute.get("/loadCheckOut1", Auth.isLogin,cartControllers.loadCheckOut1)
userRoute.post("/placeOrder", Auth.isLogin, cartControllers.placeOrder)


userRoute.get("/orderCancel", Auth.isLogin, orderControllers.OrderCancelled)
userRoute.get("/orderReturn", Auth.isLogin, orderControllers.orderReturn)
userRoute.get("/orderDetail", Auth.isLogin, orderControllers.orderDetail)
userRoute.get("/bookCancel", Auth.isLogin, orderControllers.bookCancel)
userRoute.get("/bookReturn", Auth.isLogin, orderControllers.bookReturn)





// userRoute.get("/categorySearch", Auth.isLogin, userControllers.categorySearch)
userRoute.post('/applyCoupon', Auth.isLogin, cartControllers.applyCoupon)
userRoute.post('/onlinepay',Auth.isLogin,cartControllers.onlinePay)
userRoute.post('/addTowallet',Auth.isLogin,userControllers.addTowallet)
userRoute.get("/wishlist", Auth.isLogin, userControllers.wishlist)
userRoute.get("/getWishlist", Auth.isLogin, userControllers.getWishlist)
userRoute.get("/orderSuccess", Auth.isLogin, orderControllers.orderSuccess)
userRoute.patch("/saveOrder", Auth.isLogin, cartControllers.saveOrder)
userRoute.post("/googleAuth", cartControllers.googleAuth)

userRoute.get('/profileEdit', Auth.isLogin, userControllers.profileEdit)



userRoute.delete("/removeWish", Auth.isLogin, userControllers.removeWish)
userRoute.delete("/removeItem", Auth.isLogin, cartControllers.removeItem)
userRoute.post("/removeItem", Auth.isLogin, cartControllers.removeItem)
userRoute.delete('/removeAddress', Auth.isLogin, addressController.removeAddress)
userRoute.delete('/removeCoupon',Auth.isLogin,cartControllers.removeCoupon)
userRoute.post('/removeCoupon',Auth.isLogin,cartControllers.removeCoupon)
userRoute.delete('/clearCart', Auth.isLogin, cartControllers.clearCart)


userRoute.patch("/updateCart", Auth.isLogin, cartControllers.updateCart) 
userRoute.post("/updateCart", Auth.isLogin, cartControllers.updateCart) 


userRoute.put('/profileEdit2', Auth.isLogin, userControllers.profileEdit2)


// const express = require('express')
const app = express();
app.get('/orders123', (req, res) => {
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
      const orders = [];
    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = orders.slice(startIndex, endIndex);
    res.render('orders', { orders: paginatedOrders, currentPage: page, totalPages });
  });

userRoute.post("/googleAuth", Auth.isLogin, userControllers.googleAuth)




export default userRoute