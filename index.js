const {
  makeWASocket,
  MessageType,
  MessageOptions,
  Mimetype,
  DisconnectReason,
  BufferJSON,
  AnyMessageContent,
  delay,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  MessageRetryMap,
  useMultiFileAuthState,
  msgRetryCounterMap,
  ButtonText
} = require("@whiskeysockets/baileys");

const log = (pino = require("pino"));
const { session } = { session: "session_auth_info" };
const { Boom } = require("@hapi/boom");
const axios = require('axios');
const path = require("path");
const fs = require("fs");
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = require("express")();
const conn = require('./db.js');
const Activacion = require('./models/activacionPalabras.js');
const Chat = require('./models/chatVentas.js');
const respuestas = require('./models/respuestas.js');
const cron = require('node-cron');

conn()
app.use(
  fileUpload({
    createParentPath: true,
  })
);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const port = process.env.PORT || 5000;
const qrcode = require("qrcode");

let reset=true;

app.use(express.static('public'))

let sock;
let qrDinamic = 'any';

const isConnected = () => {
  return sock?.user ? true : false;
};

cron.schedule('03 10 * * *', () => {
  axios.get('https://gestioncuentas.shop/api/accounts').then(function (response) {
    
    const data=response.data["suscription"].filter((data)=>{
      return data.last_days < response.data.expSus
    })

    let numberWA;

    data.forEach(async element => {
        try {
          if (element?.customer[0]?.phone) {
            numberWA = element.customer[0].phone + "@s.whatsapp.net";
            console.log('numberWA ',numberWA )

            if (isConnected()) {
              const exist = await sock.onWhatsApp(numberWA);

                if (exist) {
                 await sock.sendMessage(numberWA , {
                    text: element?.MensajeExpiracion
                  }).then().catch(err=>console.log(err));
                }
            } else {
              console.log('errooooor')
            }
          }
        } catch (err) {
          console.log('errooooor mas grande')
        }
    
        
    });

    const dataAcc=response.data["accounts"].filter((data)=>{
      return data.last_days < response.data.expAcc
    })
    dataAcc.forEach(async element => {
        try {
          

            if (isConnected()) {
              const exist = await sock.onWhatsApp(sock?.user.id);

                if (exist) {
                 await sock.sendMessage(sock?.user.id, {
                    text: `AVISO ADMIN:\n Su *cuenta:${element.email}* esta por caducar en *${element.last_days} dias*, renovar lo antes posible`
                  }).then().catch(err=>console.log(err));
                }
            } else {
              console.log('errooooor')
            }
          
        } catch (err) {
          console.log('errooooor mas grande')
        }
    })


  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  

}, {
  scheduled: true,
  timezone: "America/Caracas"
});


async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session_auth_info");

  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: log({ level: "silent" }),
  });


sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    qrDinamic = qr;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect.error).output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(
          `Bad Session File, Please Delete ${session} and Scan Again`
        );
        sock.logout();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Conexión cerrada, reconectando....");
        connectToWhatsApp().catch((err) => console.log("unexpected error: " + err));;
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Conexión perdida del servidor, reconectando...");
        connectToWhatsApp().catch((err) => console.log("unexpected error: " + err));;
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log(
          "Conexión reemplazada, otra nueva sesión abierta, cierre la sesión actual primero"
        );
        sock.logout();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(
          `Dispositivo cerrado, elimínelo ${session} y escanear de nuevo.`
        );
        sock.logout();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Se requiere reinicio, reiniciando...");
        connectToWhatsApp().catch((err) => console.log("unexpected error: " + err));;
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Se agotó el tiempo de conexión, conectando...");
        connectToWhatsApp().catch((err) => console.log("unexpected error: " + err));;
      } else {
        sock.end(
          `Motivo de desconexión desconocido: ${reason}|${lastDisconnect.error}`
        );
      }
    } else if (connection === "open") {
      console.log("conexión abierta");
      return;
    }
});

  
sock.ev.on("messages.upsert", async ({ messages, type }) => {


console.log('msj',messages,'type',type,'mesage', messages[0]?.message?.extendedTextMessage?.text )
    try {
      if (type === "notify") {
        if (!messages[0]?.key.fromMe) {

          const captureMessage = messages[0]?.message?.conversation ? messages[0]?.message?.conversation : messages[0]?.message?.extendedTextMessage?.text;
          console.log('captureMessage',captureMessage)

          const numberWa = messages[0]?.key?.remoteJid;

          const plbActivacion= await Activacion.findById("64f147f5192449443581acfa")

          const compareMessage = captureMessage?.toLocaleLowerCase();

          const chatfind = await Chat.findOne({ id_chat: numberWa })

          const respuestasfind = await respuestas.findOne({ text: 'respuestas' })
          if (chatfind) {
            chatfind.mensajes?.push({ user: numberWa.slice(0, -15), mensaje: compareMessage })
            await chatfind.save()

          }
         

          if (compareMessage.includes(plbActivacion.saludo)) {

          

            if (!chatfind) {
              const dat = new Chat({ id_chat: numberWa, mensajes: [{ user: numberWa.slice(0, -15), mensaje: compareMessage }, { user: 'admin', mensaje: "Mensaje saludo enviado" }],status:false })
              await dat.save()
            } else if (chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje saludo enviado" })
              await chatfind.save()

            }

            await sock.sendMessage(numberWa,
              {
                text: respuestasfind.saludo
              }
            )


          }

          if (compareMessage === plbActivacion.lista) {

            const first =async ()=>{ 
              return await sock.sendMessage(numberWa, {
              text: "Esta es nuestra *lista*📄 de Servicios \n de entretenimiento disponible" 
            })}

            first().then(()=>{
              const second =async ()=>{ 

               return respuestasfind.lista.forEach(async (element) => {
                  return await sock.sendMessage(numberWa, {
                    text:  element.texto +"\n precio: "+element.precio+"$"
                  })
                });
                
              }
              

              second().then(async()=>{
                return await sock.sendMessage(numberWa, {
                  text: "Si deseas solicitar algun servicio, \nescribe *el codigo del o los servicios* \n" +
                    "Ejemplo \n" +
                    "E1,E3,E5,..."
                })
              })
            }).catch((err)=>console.log('error',err))
            if(chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje lista enviada" });
              chatfind.status=true;
              await chatfind.save()

            }

          }
          
          if (compareMessage === plbActivacion.soporte) {

            await sock.sendMessage(numberWa, {
              text: respuestasfind.soporte.texto
            })
            await sock.sendMessage(numberWa, {
              text: respuestasfind.soporte.link
            })

            if(chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje soporte enviado" })
              await chatfind.save()

            }
          }

          if (compareMessage === plbActivacion.ofertas) {

            const firt=async ()=>{
               await sock.sendMessage(numberWa, {
              text: "Esta es nuestra lista de promociones actuales, aprovecha antes de que se agoten \n "  })
            }
           
              
            firt().then(()=>{
              const second =async ()=>{ 

                return respuestasfind.ofertas.forEach(async (element) => {
                   return await sock.sendMessage(numberWa, {
                     text:  element.texto +"\n precio: "+element.precio+"$"
                   })
                 });
                 
               }
               
 
               second().then(async()=>{
                 return await sock.sendMessage(numberWa, {
                   text: "Si deseas solicitar alguna oferta, \nescribe *el codigo de la o las ofertas* \n" +
                     "Ejemplo \n" +
                     "E1,E3,E5,..."
                 })
               }).catch((err) => console.log("unexpected error: " + err))
            }).catch((err) => console.log("unexpected error: " + err))
            if(chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje de ofertas enviado" })
              chatfind.status=true;
              await chatfind.save()

            }

          }

          if (chatfind?.status && chatfind?.id_chat === numberWa) {
            if(compareMessage !== "salir"){
              const msj = compareMessage?.replaceAll(' ','').split(",")
              let arrped=[];
              msj?.forEach((ped) => {
                  const selectedoferta =  respuestasfind.ofertas.filter((res)=>{
                    
                      return res.id === ped.toLowerCase()
                  });
                  const selectedlista =  respuestasfind.lista.filter((res)=>{
                    
                    return res.id=== ped.toLowerCase()
                  });
                

                  selectedlista[0]? arrped.push(selectedlista[0]):null;
                  selectedoferta[0]? arrped.push(selectedoferta[0]):null;
                
              });
              
              if(arrped.length > 0){
                const valorTotalMap = arrped.map((e) => {
                  return e.precio
                });
                
    
                const initialValue = 0;
                const sumWithInitial = valorTotalMap.reduce(
                  (accumulator, currentValue) => accumulator + currentValue,
                  initialValue
                );
                
                if (arrped.length >= 1) {

                  const first=async ()=>{
                    return await sock.sendMessage(numberWa, { text: "*Servicios seleccionados*: "})
                  }

                  first().then(async ()=>{
                    const mapCount = arrped.map(async (e) => {
                    await sock.sendMessage(numberWa, { text: e.servicio})
                    return e
                    }); 
                    if (mapCount.length === arrped.length) {
                      await sock.sendMessage(numberWa, { text: "*Total*: " + sumWithInitial + "$" })
                      await sock.sendMessage(numberWa, { text: "Para realizar el pago correspondiente,\n escribe *b-pago* y obten la informacion de pago" })
                    }
                    chatfind.status=false
                    await chatfind.save()
                  }).catch((err) => console.log("unexpected error: " + err));
                 
                
                }
              }else{
                await sock.sendMessage(numberWa, { text: "Por favor ingresa un valor valido \no escribe *salir* para regresar al menu de inicio" })

              }
            }else if(compareMessage === "salir"){
              chatfind.status=false
              await chatfind.save()
              await sock.sendMessage(numberWa,
                {
                  text: respuestasfind.saludo
                }
              )
            }
            
          }


          if (compareMessage === plbActivacion.revendedores) {
            await sock.sendMessage(numberWa, {
              text:respuestasfind.revendedores
            })

            if(chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje a revendedores enviado" })
              await chatfind.save()

            }
          }


          if (compareMessage === plbActivacion.pago) {
            await sock.sendMessage(numberWa, {
              text: respuestasfind.pago
            })

            if(chatfind) {
              chatfind.mensajes?.push({ user: 'admin', mensaje: "Mensaje metodos de pagos enviados" })
              await chatfind.save()

            }
          }


        }
      }
    }
    catch (error) {
      console.log("error ", error);
    }
});

sock.ev.on("creds.update", saveCreds);

}


app.post("/sendmessage", async (req, res) => {


  res.setHeader('Access-Control-Allow-Origin', '*');
  res.header('Content-Type', 'application/json')
 console.log(req.body)
  const subscriptionId = req.body.subscription;
  const number = req.body.phone;

  let numberWA;
  try {
    axios({
      method: 'get',
      url: `http://gestioncuentas.shop/api/accounts`,
      responseType: 'json'
    }).then(async function (responsed) {
      console.log('data-mensaje')
      if (!number) {
        res.status(500).json({
          status: false,
          response: "El numero no existe",
        });
      } else {
        numberWA = number + "@s.whatsapp.net";
  
        if (isConnected()) {
  
  
          const exist = await sock.onWhatsApp(numberWA);
  
          if (exist) {
            await sock.sendMessage(numberWA , {
                text:responsed.data?.suscription.find((data)=>data?.subscription?.id===subscriptionId)?.MensajeData
              }).then(async (result) => {
                  res.status(200).json({
                  status: true,
                  response: 'mensaje enviado',
                });
              })
              .catch((err) => {
                res.status(200).json({
                  status: false,
                  response: 'mensaje no enviado',
                });
              });
          }
        } else {
          res.status(200).json({
            status: false,
            response: "Aun no estas conectado",
          });
        }
      }

    })
    
  } catch (err) {
    res.status(200).send(err);
  }
});

app.get("/", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.header('Referrer-Policy', 'no-referrer')
  
  const imagePath = path.resolve(__dirname, 'public', 'hola.png');


  try {
    qrcode.toFile('public/hola.png', qrDinamic || 'any', {
      color: {
        dark: '#000',  // Blue dots
        light: '#0000' // Transparent background
      }
    }, async (err) => {

        fs.readFile(imagePath, async (err, data) => {
        // Manejar el posible error
        if (err) {
          console.log(err);
          return;
        }
        const resInfo = JSON.stringify({
        "image":data.toString('base64')||'no hay foto',
        "user": await sock?.user ? sock?.user : "sesion no iniciada"
        })
        // Especificar el tipo de contenido de la imagen
        res.writeHead(200, {'Content-Type': 'application/json'});
        // Enviar los datos de la imagen como respuesta
        res.end(resInfo);
      });
 
    })

  } catch (err) {
    console.error(err)
    res.status(500).send("Something went wrong")
  }
})


app.get('/chatlist', async (req, res) => {

  const listChat = await Chat.find({})

  const respuesta = JSON.stringify(listChat)
  res.json(respuesta)

})
app.get('/logout', async (req, res) => {  
  const FOLDER_TO_REMOVE = './session_auth_info/'

  fs.promises.rmdir(FOLDER_TO_REMOVE, { recursive: true })
  .then(() => {
    console.log('"articles" folder removed');
    
    sock.logout();
    connectToWhatsApp().catch((err) => console.log("unexpected error: " + err)); // catch any errors

  })
  .catch(err => {
    console.error('Something wrong happened removing "articles" folder', err)
  })
 
 res.json({logOut:true})
})

app.get('/respuestas', async (req, res) => {

  const respuestasfind = await respuestas.findOne({ text: 'respuestas' })
  const plbActivacion= await Activacion.findById("64f147f5192449443581acfa")

  const respuesta = JSON.stringify({respuestas:respuestasfind,activacion:plbActivacion})
  res.json(respuesta)

})

app.post("/actualizar/respuestas", async (req, res) => {


  res.setHeader('Access-Control-Allow-Origin', '*');
  res.header('Content-Type', 'application/json');

  const data = req.body.datos;
  const dataRes = req.body.respuesta;
  const activacion = req.body?.activacion;


  const plbActivacion= await Activacion.findById("64f147f5192449443581acfa")
  plbActivacion[dataRes]=activacion
  plbActivacion.save()


  const respuestasfind = await respuestas.findOne({ text: 'respuestas' });
  respuestasfind[dataRes]=data;
  respuestasfind.save()

  console.log('data-server',respuestasfind )
  res.status(200).json({"actualizar":"listo"})
})


connectToWhatsApp().catch((err) => console.log("unexpected error: " + err)); // catch any errors
server.listen(port, () => {
  console.log("Server Run Port : " + port);
});