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
app.get("/api/inbox", authmidlleware, async (req, res) => {
    db.query(`SELECT u.* 
    FROM inboxes AS Ib
    JOIN users AS u ON Ib.userId = u.id
    WHERE ofInbox = ?` ,[req.decodedData.id], (err,result)=>{

        if (err) {
            res.status(500).send(err)
            return
        }
        // res.send(result)
     console.log(result)
     if(result.length > 0) return res.send(result) 
       res.status(404).send(false)
     
        
    })
});

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
app.get(`/api/user/:id`,authmidlleware,async(req,res)=>{
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
app.get("/inbox",authmidlleware,(req,res)=>{
    res.sendFile(path.join(__dirname,"/public/inbox.html"))
})

app.post("/api/login",(req,res)=>{ 
    const {name,email} = req.body
    console.log({name,email})
    db.query("SELECT * FROM users WHERE email = ?",[email],(err,result)=>{

        if (err) {
            console.log(err)            
            res.status(500).send(err)
            return
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

app.post("/api/send-msg", authmidlleware, (req, res) => {
    const { reciver, msg } = req.body;

    // Insert message into the database
    db.query("INSERT INTO msgs (reciver, sender, msg) VALUES (?, ?, ?)", [reciver, req.decodedData.id, msg], (err, result) => {
        if (err) {
            console.error("Error saving message to database:", err);
            return res.status(500).send("Error saving message to database");
        }

        // Emit message to recipient
        const room = `${reciver}-${req.decodedData.id}`;
        if (io.sockets.adapter.rooms.get(room)) {
            io.to(room).emit("msg-to", { reciver, msg, sender: req.decodedData.id });
        } else {
            io.to(`${req.decodedData.id}-${reciver}`).emit("msg-to", { reciver, msg, sender: req.decodedData.id });
        }

        // Insert inbox record if it doesn't exist
        db.query(`
            INSERT INTO inboxes (userId, ofInbox)
            SELECT ?, ?
            WHERE NOT EXISTS (
                SELECT 1 FROM inboxes WHERE userId = ? AND ofInbox = ?
            )
        `, [req.decodedData.id, reciver, req.decodedData.id, reciver], (inboxErr, inboxResult) => {
            if (inboxErr) {
                console.error("Error inserting inbox record:", inboxErr);
                return res.status(500).send("Error inserting inbox record");
            }

        });
        db.query(`
        INSERT INTO inboxes (ofInbox, userId)
        SELECT ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM inboxes WHERE ofInbox = ? AND userId = ?
        )
    `, [req.decodedData.id, reciver, req.decodedData.id, reciver], (inboxErr, inboxResult) => {
        if (inboxErr) {
            console.error("Error inserting inbox record:", inboxErr);
            return res.status(500).send("Error inserting inbox record");
        }

    });
        // Insert inbox record if it doesn't exist
      
    });
});


app.get("/api/msges/:id", authmidlleware, (req, res) => {
    let receiver = req?.params?.id
    let sender = Number(req?.decodedData?.id)
    if (!sender || !receiver) {
        console.log(sender, receiver)
        return
    }

    db.query(`SELECT * FROM msgs
     WHERE (
        (sender = ${sender} AND reciver = ${receiver} AND senderDelete = 0) 
        OR 
        (sender = ${receiver} AND reciver = ${sender} AND reciverDelete = 0)
        )`
      , [sender], (err, result) => {
        if (err) {
            res.status(500).send(err)
            return
        }
        res.send(result)
    })
})
app.delete("/api/deleteAllConversation/:id",authmidlleware,(req,res)=>{

    db.query(`
    UPDATE msgs 
    SET 
        senderDelete = CASE 
            WHEN sender = ${req.decodedData.id} AND reciver = ${req.params.id} THEN 1 
            ELSE senderDelete 
        END,
        reciverDelete = CASE 
            WHEN reciver = ${req.decodedData.id} AND sender = ${req.params.id} THEN 1 
            ELSE reciverDelete 
        END
    WHERE
        (sender = ${req.decodedData.id} AND reciver = ${req.params.id}) OR
        (reciver = ${req.decodedData.id} AND sender = ${req.params.id})
`,(err,result)=>{

    if(err) return res.status(400).send(err)
    res.send("deleted sucessfully")
});


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
        const {reciver,sender} = room
        if (io.sockets.adapter.rooms.get(`${reciver}-${sender}`)) {
         socket.join(`${reciver}-${sender}`)
        room = `${reciver}-${sender}`

        }else{
         socket.join(`${sender}-${reciver}`)
        room = `${sender}-${reciver}`
            
        }
        console.log(`Socket ${socket.id} joined room ${room}`);
        
    });

    // ... other event listeners ...
});


server.listen(PORT, ()=>{
    console.log(PORT)
})