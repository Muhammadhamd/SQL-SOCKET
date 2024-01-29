import express from "express"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import cookieParser from "cookie-parser"
import http from "http"
import {Server} from "socket.io"
import path from "path"
const __dirname = path.resolve()
const app = express()
const server = http.createServer(app)
const io = new Server(server)
const PORT = 4000
let votesARE = null
let votesArray = []
import db from "./database.mjs"
import { error } from "console"
app.use(express.json())
app.use(cookieParser())
// app.use(express.static(path.join(__dirname,"/public")))
const SECRET = "secret"

function authmidlleware(req,res,next){
    const token = req?.cookies?.Token
    if (!token) {
        res.status(401).send("you are not login")
        // res.redirect("/login")
        return
    }

    jwt.verify(req?.cookies?.Token,SECRET,(err,decodeddata)=>{

        if (err) {
            res.status(500).send(err)
        // res.redirect("/login")

            return
        }
        let time = new Date().getTime() / 1000
        if (decodeddata.exp < time) {
            res.status(401).send("login again")
        // res.redirect("/login")

            return
        }

        req.body.decodeddata = decodeddata
        next()
    })
}


app.get("/join-table",(req,res)=>{

    // db.query("INSERT INTO users ( email,name) VALUES (?,?)",["hamd444@g.com","hamd"],(err,result)=>{

    //     if (err) {
    //         res.send(err)
    //         return            
    //     }

    //     res.send(result)
    // })
    // db.query("SELECT msg FROM msgs JOIN users ON (msgs.sender = 4)",(err,result)=>{

    //     if (err) {
    //         res.status(500).send(err)
    //         return            
    //     }

    //     res.send(result)
    // })


    // db.query("INSERT INTO  aggritable (name,price,sales) VALUES (?,?,?)",["orange",14,30],(err,result)=>{

    //     if (err) {
    //         res.status(500).send(err)
    //         return
    //     }

    //     res.send("done hogaya")
    // })

    // db.query("SELECT name FROM aggritable where (price = (SELECT MAX(price) FROM aggritable) , name = 'banana')",(err,result)=>{

    //     if (err) {
    //         res.status(500).send(err)
    //     }

    //     res.send(result)
    // })

    // db.query("delete from aggritable where (price < 50 OR sales < 100)",(err,result)=>{

    //     if (err) {
    //         res.status(500).send(err)
    //         return
    //     }
  
    //     db.query("select * from aggritable",(err,updated)=>{

    //         if (err) {
    //             res.send(err)
    //             return
    //         }
    //         res.send(updated)
    //     })
    // })

    // db.query("select * from departemnt",(err,result)=>{

    //     if (err) {
    //         res.status(500).send(err)
    //         return

    //     }

    //     res.send(result)

    //     // const newarray = result.reduce((newArray , onstep)=>{

    //     //     let key = onstep.dp_name
            
    //     //     newArray[key] = (newArray[key] || [])
    //     //     return newArray
    //     // },{})
    //     // console.log(newarray)

    // //    result.reduce((newarray,obj)=>{

    // //     let key = obj.id
    // //     newarray = newarray.filter() [...newarray , obj]
    // //    })

    // let sorted = result.sort((a,b)=>b.id - a.id)
    // console.log(sorted)
    // })
   

})
app.get("/login",(req,res)=>{

    res.sendFile(path.join(__dirname,"/public/login.html"))
})
app.post("/api/login",(req,res)=>{
    const {email,name}  = req.body

    if (!email || !name) {
        res.status(401).send("not all paramerts")
        return
    }

    db.query("select * from users where email=?",[email],(err,result)=>{

        if (err) {
            res.status(500).send(err)
            return
        }

        let data = result[0]
        console.log(result)
        if (!data) {
            res.status(404).send("no found")
            return
        }
        const token = jwt.sign({
            id:data.id,
            email:data.email,
            name:data.name,
            iat:Math.floor((Date.now() / 1000) - 30)

        },SECRET)

        res.cookie("Token",token,{
            httpOnly:true,
            maxAge:88_400_000
        })

        res.send("login sucessfully")

    })

    
})
app.get("/",(req,res)=>{

    res.sendFile(path.join(__dirname,"/public/index.html"))
})

app.get("/votes",(req,res)=>{

    db.query("select * from votes",(err,data)=>{

        if (err) {
            res.status(500).send(err)
            return;
        }
              votesArray = data
        let updateresult = data.reduce((newarr,existarr)=>{

            let key = existarr.voteto

            newarr[key] = (newarr[key] || []).concat(existarr)
            return newarr
        },{})

        res.send(updateresult)
        votesARE = updateresult
    })
})

app.post("/add-vote",authmidlleware,(req,res)=>{
    const {voteTo} = req.body
    const userdata = req.body.decodeddata

    db.query(`select voterid , voteto from votes where voterid ='${userdata.id}' `,(err,result)=>{

        if (err) {
            res.send(err)
            return
        }

        if (!result[0]) {
            
            db.query("insert into votes (voterid , voteto) values (?,?) ",[userdata.id,voteTo],(err,data)=>{

                if(err){
                    res.send(err)
                    return
                }

                res.send("voted")
                io.of("/notify").emit("new-vote",{votes:votesARE})
            })
            return
        }

        db.query("update votes set voteto =? where voterid = ? ",[voteTo, userdata.id ],(err,data)=>{

            if (err) {
                res.status(500).send(err)
                return
            }
    
            res.send("voted updated sucess")

            votesArray.push({voterid:userdata.id, voteto:voteTo})

            let filterdvotes = votesArray.filter((voterid)=>(voterid.voterid !== userdata.id) && (voterid.voteto !== voteTo))
            let updateresult = filterdvotes.reduce((newarr,existarr)=>{

                let key = existarr.voteto
    
                newarr[key] = (newarr[key] || []).concat(existarr)
                return newarr
            },{})

            io.of("/notify").emit("new-vote",{votes:updateresult})


        })
    })

    
})
io.use((socket, next)=>{


})

io.of('/notify').on('connection',(socket)=>{

    console.log(socket.id)

    socket.emit("new-vote",(data)=>{

        console.log("new voted done")
    })
})







server.listen(PORT,()=>{
    console.log(PORT)
})