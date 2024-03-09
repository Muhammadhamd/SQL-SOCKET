import express from "express"
import bodyParser from "body-parser"
import db from "./database.mjs"
import path from "path"
import {Server} from "socket.io"
import http from "http"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import cookieParser from "cookie-parser"
import { Console } from "console"
const __dirname = path.resolve()
const app = express()
const PORT = 4000
app.use(bodyParser.json())
app.use(express.json())
app.use(cookieParser())
const server = http.createServer(app)
const io = new Server(server)
const Secret = "hello"
const connectedSockets = [];
app.use(express.static(path.join(__dirname,'/public')))
function authmidlleware(req,res,next){
    console.log("tokenis",req?.cookies?.Token)
    try {
         jwt.verify(req?.cookies?.Token,Secret,(err,decoded)=>{

            if (err) {
                res.status(401).send("error login")
                return;
            }

            let time = new Date().getTime() / 1000

            if (decoded.exp < time) {
                res.status(401).send("login again please")   
                return             
            }
            console.log(decoded)

            req.decodedData = decoded
            next()
        })
    } catch (error) {
        res.status(500).send(error)
    }
}
app.get("/",(req,res)=>{
    // 
    res.sendFile(path.join(__dirname,"/public"))
    console.log(path.join(__dirname,"/public"))
})
app.get("/Token",authmidlleware,(req,res)=>{

    res.send(req.decodedData)
})
 

app.post("/addUser",async(req,res)=>{
    const insertdata = 'INSERT INTO users (name,email) VALUES (?,?)'
    const {name , email} = req.body
    db.query(insertdata , [name,email], (err,result)=>{
        if(err){
            res.status(500).send(err)
            return
        }
        res.send(result)

    })
})

app.get("/Users",async(req,res)=>{
    const readdata = "SELECT * FROM users"
    db.query(readdata , (err,result)=>{

        if (err) {
            res.status.send(err)
            return     
        }
        res.send(result)
    })
})
app.delete(`/deleteUSer/:id`,async(req,res)=>{
    const readdata = "DELETE FROM users WHERE id = ?"
    db.query(readdata ,[req.params.id], (err,result)=>{

        if (err) {
            res.status.send(err)
            return     
        }
        res.send(result)
    })
})

app.put(`/updatedb/:id`,async(req,res)=>{
    const {name , email } = req.body
    const readdata = "  UPDATE users set name = ?, email = ? WHERE id = ?"
    
    db.query(readdata ,[name,email,req.params.id], (err,result)=>{

        if (err) {
            res.status(500).send(err)
            return     
        }
        res.send(result)
    })
})
app.get(`/useris/:id`,async(req,res)=>{
    const {name , email } = req.body
    const readdata = "select *, CONCAT(name , id,email) as concat_ids from users "
    
    db.query(readdata ,[req.params.id], (err,result)=>{

        if (err) {
            res.status(500).send(err)
        }
        // res.send(result)
  
        try {
            result.map((each)=>{
                db.query("insert into newtable (email ,updated) values (?,?)",[each.email , each.concat_ids],(err,result)=>{
    
                    if (err){
                        res.status(500).send(err)
                    }
                    // res.send(result)
                })
            })
            res.send("sucess")
        } catch (error) {
            console.log(error)
        }
     
        
    })
})
app.get(`/api/user/:id`,async(req,res)=>{
    const readdata = "SELECT *FROM users WHERE id = ?"
    
    db.query(readdata ,[req.params.id], (err,result)=>{

        if (err) {
            res.status(500).send(err)
        }
        // res.send(result)
     console.log(result)
       res.send(result[0])
     
        
    })
})
app.get("/login",(req,res)=>{
  res.sendFile(path.join(__dirname,"/public/login.html"))
})
app.post("/api/login",(req,res)=>{ 
    const {name,email} = req.body
    console.log({name,email})
    db.query("SELECT * FROM users WHERE email = ?",[email],(err,result)=>{

        if (err) {
            console.log(err)            
            res.status(500).send(err)
        }
        console.log(result[0]?.name)

        const Token = jwt.sign({
            name:result[0].name,
            id:result[0].id,
            email:result[0].email,
            iat: Math.floor(Date.now() / 1000) - 30,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
        },Secret)

        res.cookie("Token",Token,{
            maxAge:88_400_000,
            httpOnly:true
        })
        res.send(`login sucessfull ${result[0].name}`)
        
    })
})

app.post("/api/send-msg",authmidlleware,(req,res)=>{
    const {reciver , msg} = req.body
    console.log(reciver,msg)

    db.query("INSERT INTO msgs (reciver, sender, msg) VALUES (?, ?, ?)",[reciver , req?.decodedData?.id ,msg],(err,result)=>{

        if (err) {
            res.status(500).send(err)
            return

            
        }
        console.log(result.insertId)
        db.query("SELECT * FROM msgs WHERE id = ?",[result.insertId],(error,row)=>{

            if (error) {
                res.status(500).send(error)
                return
            }
            console.log(row)

            res.send({
                msg:"msg sent and saved in data sucessfully wowwwwwww",
                data:row[0]})
        })
        // io.on(`new-msg-${data.to}-${re.id}`, (data) => {
        //     // Leave existing rooms0. 65
        //     socket.on(`msg-to-${data.to}`,(data.msg))
        //     // Join a room based on the user's ID
        // });
        io.to(`${req.decodedData.id}-${reciver}`).emit("msg-to",{reciver,msg,sender:req.decodedData.id})
        
        // res.send("msg saved in db")

    })

})

app.get("/api/msges/:id",authmidlleware,(req,res)=>{
    let reciver =req?.params?.id
    let sender = Number(req?.decodedData?.id)
    console.log( sender)
    if (!sender || !reciver) {
        console.log(sender,reciver)
        return
    }
    db.query("SELECT * FROM msgs WHERE (sender = ? AND reciver = ?) OR (sender = ? AND reciver = ?) ",[sender,reciver,reciver,sender],(err,result)=>{

        if (err) {
            res.status(500).send(err)
            return
        }

        res.send(result)

    })
})
io.on('connection', (socket) => {
    console.log('A user connected',socket.id);
    connectedSockets.push(socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected');

        // Remove the disconnected socket ID from the array
        const index = connectedSockets.indexOf(socket.id);
        if (index !== -1) {
            connectedSockets.splice(index, 1);
        }
    });

    socket.on('join-room', (room) => {
        // Join a specific room based on the provided room ID
 console.log("fdsaf")
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
        
    });

    // ... other event listeners ...
});


server.listen(PORT, ()=>{
    console.log(PORT)
})