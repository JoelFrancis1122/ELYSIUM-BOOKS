const express = require('express')
const userRoute = express()

const userControllers = require('../controllers/userController')
const cartControllers = require('../controllers/cartController')
const Auth = require('../middlewares/userAuth')



userRoute.set('view engine', 'ejs')
userRoute.set('views', './views/users')
// userRoute.use(Auth.preventUserAccessForAdmin)


//--------------------------------------------------
userRoute.get('/', Auth.isLogout, userControllers.loadGuest)

userRoute.get('/login', Auth.isLogout, userControllers.loadlogin)
userRoute.get('/home', Auth.isLogin, Auth.isBlocked, userControllers.loadHome)
userRoute.get('/logout', Auth.isLogin, userControllers.loadLogout)

userRoute.get('/login', Auth.isLogout, userControllers.loadlogin)

userRoute.get('/signup', Auth.isLogout, userControllers.signup)
userRoute.post('/verifySignup', Auth.isLogout, userControllers.verifySignup)


userRoute.get('/getOtp', Auth.isLogout, userControllers.getOtp)
userRoute.post('/verifyOtp', Auth.isLogout, userControllers.verifyOtp)
userRoute.post('/verifyLogin', Auth.isLogout, userControllers.verifyLogin)
userRoute.get('/shop-product', Auth.isLogin, userControllers.shopProduct)
userRoute.get("/loadProfile", Auth.isLogin, userControllers.loadProfile)
userRoute.get('/loadShop', Auth.isLogin, userControllers.loadShop)
userRoute.post('/profileEdit', Auth.isLogin, userControllers.profileEdit)
userRoute.post('/addAddress', Auth.isLogin, userControllers.addAddress)
userRoute.post('/addAddress1', Auth.isLogin, userControllers.addAddress1)
userRoute.get('/loadEditAddress', Auth.isLogin, userControllers.loadEditAddress)
userRoute.get('/loadAddAddress', Auth.isLogin, userControllers.loadAddAddress)
userRoute.get('/loadAddAddress', Auth.isLogin, userControllers.loadAddAddress)
userRoute.post('/updateAddress', Auth.isLogin, userControllers.updateAddress)
userRoute.get('/loadOrderDetails', Auth.isLogin, userControllers.loadOrderDetails)





userRoute.get("/cart", Auth.isLogin, Auth.isBlocked, cartControllers.getCart)
userRoute.get('/addToCart', Auth.isLogin, Auth.isBlocked, cartControllers.addToCart)
userRoute.post("/updateCart", Auth.isLogin, cartControllers.updateCart)
userRoute.post("/removeItem", Auth.isLogin, cartControllers.removeItem)
userRoute.get("/loadCheckOut", Auth.isLogin, cartControllers.isCartEmpty, cartControllers.loadCheckOut)
userRoute.post("/placeOrder", Auth.isLogin, cartControllers.placeOrder)
userRoute.post('/removeAddress', Auth.isLogin, userControllers.removeAddress)
userRoute.post('/clearCart', Auth.isLogin, cartControllers.clearCart)
userRoute.get("/orderCancel", Auth.isLogin, userControllers.OrderCancelled)
userRoute.get("/orderReturn", Auth.isLogin, userControllers.orderReturn)
userRoute.get("/orderDetail", Auth.isLogin, userControllers.orderDetail)
userRoute.get("/categorySearch", Auth.isLogin, userControllers.categorySearch)























module.exports = userRoute