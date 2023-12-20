const mongoose= require('mongoose');

const respuestasSchema= new mongoose.Schema({
    saludo:{
        type:String,
        required:true,

    },
    lista:{
        type:String,
        required:true,
    },
    ofertas:{
        type:String,
        required:true,

    },
    
    revendedores:{
        type:String,
        required:true,

    },
    pago:{
        type:String,
        required:true,
    },
    soporte:{
        type:String,
        required:true,
    }
},{
    timestamps:true
})

module.exports=mongoose.model('activacion',respuestasSchema)