import mysql from "mysql"

const connection = mysql.createConnection({
    host: 'localhost',         // Replace with your MySQL server's hostname or IP
  user: 'root',              // Replace with your MySQL username
  password: '',              // Replace with your MySQL password (leave empty if none)
  database: 'crud_with_nodejs',

})

connection.connect((err)=>{
    if(err){
        console.log(err)
        return;
    }
    console.log("connected db")
})

export default connection