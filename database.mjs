import mysql from "mysql"

const connecction = mysql.createConnection({
    host:"localhost",
    password:"",
    database:"crud_wuth_nodejs",
    user:"root"
})

connecction.connect((err)=>{
    if (err) {
        console.log(err)
        return        
    }
    console.log("db connected")
})

export default connecction
