const mongoose = require('mongoose')
const OrderSchema = mongoose.Schema({



    userId: { type: mongoose.Schema.ObjectId, ref: 'User' },
    product: [{
        productId: { type: mongoose.Schema.ObjectId, ref: "Product" },
        quantity: { type: Number }
    }],

    address: {
        name: { type: String },
        mobile: { type: Number },
        houseName: { type: String },
        city: { type: String },
        state: { type: String },
        pinCode: { type: Number },

    },

    orderId: { type: String },
    orderDate: { type: Date, default: Date.now },
    totalAmount: { type: String },
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['Pending', 'Recieved', 'Failed', 'Refund'], default: "Pending" },
    orderStatus: { type: String, enum: ['Order Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'], default: "Order Placed" },
    couponDiscount: { type: Number },
    deliveryStatus: { type: Number, default: 0 },
})


module.exports = mongoose.model('Orders', OrderSchema);


