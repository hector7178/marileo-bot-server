const mongoose= require('mongoose');

const respuestasSchema= new mongoose.Schema({
    saludo:{
        type:String,
        required:true,

    },
    lista:{
        type:Array,
        required:true,
    },
    ofertas:{
        type:Array,
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
        type:Object,
        required:true,
    }
},{
    timestamps:true
})

module.exports=mongoose.model('Respuestas',respuestasSchema)