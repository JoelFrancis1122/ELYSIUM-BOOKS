const mongoose = require('mongoose')
const CategorySchema=mongoose.Schema({
    categoryName:{type:String,required:true},
    Description:{type:String,required:true},
    // Images:{type:Array,required:true},
    is_Active:{type:Boolean,default:true}
   
})


module.exports = mongoose.model('Category',CategorySchema);

