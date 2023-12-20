const mongoose= require('mongoose');

const uri = "mongodb+srv://hector7178:taulica123@cluster0.izqeutb.mongodb.net/bot?retryWrites=true&w=majority";


const conn = async ()=>{
    try {
       await mongoose.connect(uri) 
       console.log('conectado a la base de datos ')

    } catch (error) {
        console.log('Error al conectar a la db ')
        console.log(error)
        
    }
} 

module.exports=conn
