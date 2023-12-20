const mongoose= require('mongoose');

const chatschema=new mongoose.Schema({
   id_chat:{
    type:String,
    required:true
   },
   mensajes:{
    type:Array,
    required:false

   },
   status:{
    type:Boolean,
    required:true
   }
},{
    timestamps:true
})

module.exports=mongoose.model('Chat',chatschema)