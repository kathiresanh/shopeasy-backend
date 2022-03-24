const express = require('express')
const app = express()
const cors = require("cors")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Razorpay = require("razorpay");



const secret = "abcfghk79685";
app.use(express.json())
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
require('dotenv').config({ path: './secure.env' })
const URL = process.env.URL;

let options = {
    origin:"*",
    credentials: true,
}
app.use(cors(options))

let authenticate = function(req,res,next){
   
    if(req.headers.authorization){
        try {
            let result = jwt.verify(req.headers.authorization,secret)
            if(result){
                next()
            }else{
                res.status(401).json({messae:"token invalid"})
            }
          
        } catch (error) {
            res.status(401).json({message:"token invalid"})
       
        }
     }else{
         res.status(401).json({message:"not authorized"})
     }
 }


// add product to database
app.post("/addproduct", async function (req, res) {

    try {
        let connection = await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("products").insertOne(req.body)
        connection.close();
        res.json({ message: "created" })
    } catch (error) {
        console.log(error)
    }
})

// get the products from database
app.get("/getproduct", async function (req, res) {

    try {
        let connection = await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let products = await db.collection("products").find({}).toArray()
        connection.close();
        res.send(products)
    } catch (error) {
        console.log(error)
    }
})

// get the products from  database after login
app.get("/getproduct/login",authenticate,async function (req, res) {

    try {
        let connection = await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let products = await db.collection("products").find({}).toArray()
        connection.close();
        res.send(products)
    } catch (error) {
        console.log(error)
    }
})

// register new customer
app.post("/register",async function(req,res){
    
    try {
        let salt = await bcrypt.genSalt(10);
        let hash =await bcrypt.hash(req.body.password,salt);
        req.body.password=hash;
        let connection = await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOne({email:req.body.email}) 
        if(user){
           res.status(401).json({message:"no user present"}) 
        }else {
           await db.collection("users").insertOne(req.body);
           res.json({message:"sucessfully registered"})
        } 
       
        connection.close();
      
    } catch (error) {
        console.log(error)
    }
   })


   // login for customer

app.post("/login",async function(req,res){

    try {
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOne({email:req.body.email})
        if(user){
            let passwordresult = await bcrypt.compare(req.body.password,user.password)
          
            if(passwordresult){
                let token = jwt.sign({userid:user._id},secret,{expiresIn: "1h"})
               
                user.tokens=token;
                res.json(user)
              
            }else{
              
                res.status(401).json({message:"user id or password invalid"})
            }
        }else{
            res.status(401).json({message:"no user present"})
        }
    } catch (error) {
        console.log(error)
    }
})

app.put("/forgot-password",async function(req,res){
    
    try {
        let salt = await bcrypt.genSalt(10);
        let hash =await bcrypt.hash(req.body.password,salt);
        req.body.password=hash;
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOne({email:req.body.email});
        if(user){
            let user = await db.collection("users").findOneAndUpdate({email:req.body.email},{$set: {password: hash}});
            res.send("password updated")
        }else{
            res.send("No user exists")
        }
       
        connection.close()
      
    } catch (error) {
        console.log(error)
    }

})


// api for adding items to the cart

app.put("/addtocart/:email",async function(req,res){
   
    try {
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOneAndUpdate({email:req.params.email},{ $push: { cart : req.body} })
        connection.close()
        res.send("added to cart")
    } catch (error) {
        console.log(error)
    }
})



// add the product after purchase in orders
app.put("/addToOrders/:email",async function(req,res){
       
    try {
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        await db.collection("users").findOneAndUpdate({email:req.params.email},{ $pull: { cart : {_id:req.body._id}} })
        await db.collection("users").findOneAndUpdate({email:req.params.email},{ $push: { orders : req.body} })
        connection.close()
        res.send("added to cart")
    } catch (error) {
        console.log(error)
    }
})

app.get("/getcartdata/:email",async function(req,res){
    try {
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOne({email:req.params.email})
        connection.close()
        res.send(user.cart)
    } catch (error) {
        console.log(error)
    }
})



//  send ordered items datas

app.get("/getordersdata/:email",async function(req,res){
    try {
        let connection =  await mongoClient.connect(URL);
        let db = connection.db("shopeasy");
        let user = await db.collection("users").findOne({email:req.params.email})
        connection.close()
        res.send(user.orders)
    } catch (error) {
        console.log(error)
    }
})





// create order id from razor pay


app.post("/createorder",async function(req,res){

    
    try {
        var instance = new Razorpay({
            key_id: process.env.key_id,
            key_secret: process.env.key_secret,
        });


        var options = {
            amount: parseInt(req.body.price) * 100,  // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11"
        };

        instance.orders.create(options, function (err, order) {

            res.send(order)

        });
    } catch (error) {
        res.send(error)
    }
})


app.post("/api/payment/verify",(req,res)=>{

  
    let body=req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id;
   
    var crypto = require("crypto");
     var expectedSignature = crypto.createHmac('sha256', 'byE7X24HOgKJwUZo8cvPdDBJ')
                                     .update(body.toString())
                                     .digest('hex');
                                  
     var response = {"signatureIsValid":"false"}
     if(expectedSignature === req.body.razorpay_signature)
      response={"signatureIsValid":"true"}
         res.send(response);
     });


//    load dashboard content 
     app.get("/dashboard/:email",async function(req,res){
   
        try {
            let connection =  await mongoClient.connect(URL);
            let db = connection.db("shopeasy");
            let user = await db.collection("users").findOne({email:req.params.email})
            connection.close()
            res.send(user)
        } catch (error) {
            console.log(error)
        }
    })

    // delete orders

    app.put("/deleteorder/:email",async function(req,res){
       
        try {
            let connection =  await mongoClient.connect(URL);
            let db = connection.db("shopeasy");
            await db.collection("users").findOneAndUpdate({email:req.params.email},{ $pull: { orders : {_id:req.body._id}} })
            connection.close()
            res.send("order deleted")
        } catch (error) {
            console.log(error)
        }
    })


    // delete items from the cart

    
    app.put("/deletecart/:email",async function(req,res){
       
        try {
            let connection =  await mongoClient.connect(URL);
            let db = connection.db("shopeasy");
            await db.collection("users").findOneAndUpdate({email:req.params.email},{ $pull: { cart : {_id:req.body._id}} })
            connection.close()
            res.send("cart item removed")
        } catch (error) {
            console.log(error)
        }
    })

    // filter the products
    

    app.post("/getfilterproduct", async function (req, res) {

        try {
            let connection = await mongoClient.connect(URL);
            let db = connection.db("shopeasy");
            let products = await db.collection("products").find({category: req.body.searchitem}).toArray()
            connection.close();
            res.send(products)
        } catch (error) {
            console.log(error)
        }
    })
    





app.listen(process.env.PORT || 3001)

