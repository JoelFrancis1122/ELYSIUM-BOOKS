import mongoose from "mongoose"
const OrderSchema = mongoose.Schema({



    userId: { type: mongoose.Schema.ObjectId, ref: 'User' },
    product: [{
        productId: { type: mongoose.Schema.ObjectId, ref: "Product" },
        price:{type:Number},
        quantity: { type: Number },
        productStatus:{type:String,enum:["Order Placed","Cancelled","Returned"],default:"Order Placed"}
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
    totalAmount: { type: Number },
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['Pending', 'Received', 'Failed', 'Refund'], default: "Pending" },
    orderStatus: { type: String, enum: ['Order Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'], default: "Order Placed" },
    couponDiscount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    deliveryStatus: { type: Number, default: 0 },
})




export default mongoose.model('Orders', OrderSchema);
