global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
const { MongoClient } = require('mongodb');
let client = new MongoClient(require('./apikeys').aimedtuba.accounts.mongodb_url);
const express=require('express');
const nodemailer=require('nodemailer');
const path=require('path');
const cors=require('cors');
const app = express();
const code=require('./apikeys').aimedtuba.accounts.code;
const twofa=[
    "What is your dad's middle name?",
    "What is your grandmother's name?",
    "What is the name of your first pet?",
    "What is the name of your first teacher?",
    "Where were you born?"
]

async function connect(){
    await client.connect();
    client=client.db("accounts").collection("users");
    app.listen(9090)
}
connect()

app.use(express.json());

app.get('*', function(req, res){
    try{
        if(req.path.includes(".")){path.join(__dirname,"files/"+req.path)}
        else if(req.path!="/"){path.join(__dirname,"files/"+req.path+".html")}
        else{res.redirect(`/signup${req.query.code?"?code="+req.query.code:""}`)}
    }catch(e){res.status(404).send("Error 404")}
})
app.post('/accounts/first', async function(req, res){
    try{
        console.log(req.body)
        if(req.body.code&&(!req.body.username)){
            if(req.body.code==code){
                res.send(true)
            }else{res.send(false)}
        }else if(req.body.code&&req.body.username){
            let found=await client.find({username:req.body.username}).toArray()
            res.send({code:req.body.code==code,username:!found.length==1});
        }else{res.status(406).send("Not acceptable")}
    }catch(e){console.log(e)}
})
app.post('/accounts/new/first', async function(req, res){
    try{
        if(req.body.code&&req.body.username&&req.body.passcode&&req.body.twofa){
            let found=await client.find({username:req.body.username}).toArray()
            if(validate_passcode(req.body.passcode)){
                if(req.body.code==code){
                    if(validate_email(req.body.twofa)||(/^(0|1|2|3|4)$/.test(req.body.twofa)&&req.body.twofanswer)){
                        if(!found.length==1){
                            let _login=makeid(100);
                            let found__login=await client.find({login:_login}).toArray()
                            while(found__login.length==1){_login=makeid(100);found__login=await client.find({login:_login}).toArray()}
                            await client.insertOne(
                                {
                                    username:req.body.username,
                                    passcode:req.body.passcode,
                                    login:_login,
                                    twofa:{
                                        type:req.body.twofa.includes(".") ? "email" : "question",
                                        question:req.body.twofa.includes(".") ? req.body.twofa : twofa[parseInt(req.body.twofa)],
                                        answer:req.body.twofanswer ? req.body.twofanswer : [],
                                    },
                                }
                            )
                            res.send(_login)
                        }else{res.status(409).send("Username taken")}
                    }else{res.status(401).send("Invalid 2FA")}
                }else{res.status(401).send("Incorrect code")}
            }else{res.status(406).send("Invalid passcode")}
        }else{res.status(406).send("Not acceptable")}
    }catch(e){console.log(e)}
})
app.post('/accounts/enter/first',async function(req,res){
    try{
        if(req.body.code&&req.body.username&&req.body.passcode){
            let found1=await client.find({username:req.body.username}).toArray()
            let found2=await client.find({username:req.body.username,passcode:req.body.passcode}).toArray()
            if(req.body.code==code){
                if(found1.length==1){
                    if(found2.length==1){
                        let _holder=echo_JSON(found1[0].twofa)
                        _holder.answer=null;
                        if(_holder.type=="email"){
                            await create_code(req.body.username)
                            _holder=echo_JSON(found1[0].twofa)
                            nodemailer.createTransport({
                                host: 'aimedtuba.com',
                                port: 465,
                                secure: true,
                                auth: {
                                    user: 'accounts@aimedtuba.com',
                                    pass: require('./apikeys').aimedtuba.accounts.email_passcode
                                }
                            }).sendMail({
                                from: '"Account Helper" <accounts@aimedtuba.com>',
                                to: _holder.question,
                                subject: "Your aimedtuba 2FA code",
                                html: '<h1>Your 2FA code is:</h1><h2> '+_holder.answer[0]+'</h2>'
                            })
                            _holder.answer=null;
                        }
                        res.send(_holder)
                    }else{res.status(401).send("Incorrect passcode")}
                }else{res.status(404).send("User not found")}
            }else{res.status(401).send("Incorrect code")}
        }else{res.status(406).send("Not acceptable")}
    }catch(e){console.log(e)}
})
app.post('/accounts/enter/second',async function(req,res){
    try{
        if(req.body.code&&req.body.username&&req.body.passcode&&req.body.twofa){
            let found1=await client.find({username:req.body.username}).toArray()
            let found2=await client.find({username:req.body.username,passcode:req.body.passcode}).toArray()
            if(req.body.code==code){
                if(found1.length==1){
                    if(found2.length==1){
                        let _holder=found1[0].twofa
                        if(Array.isArray(_holder.answer)){
                            if(_holder.answer.includes(req.body.twofa)){
                                res.send(found1[0].login)
                                await client.updateOne({username:req.body.username},{$set:{"twofa.answer":[]}})
                            }else{res.status(401).send("Incorrect 2FA")}
                        }else if(_holder.answer==req.body.twofa){
                            res.send(found1[0].login)
                        }else{res.send(401).send("Incorrect 2FA")}
                    }else{res.status(401).send("Incorrect passcode")}
                }else{res.status(404).send("User not found")}
            }else{res.status(401).send("Incorrect code")}
        }else{res.status(406).send("Not acceptable")}
    }catch(e){console.log(e)}
})
app.post('/api/check',cors(),async (req, res)=>{
    let found1=await client.find({login:req.query.login}).toArray()
    res.json({data:found1.length==1})
})
async function create_code(username){
    let _code="";
    for(let i=0;i<6;i++){
        _code+=Math.floor(Math.random()*10);
    }
    let found=await client.find({username:username}).toArray()
    let answers=found[0].twofa.answer
    answers.splice(0,0,_code)
    await client.updateOne({username:username},{$set:{"twofa.answer":answers}})
    timeout(async ()=>{
        let found=await client.find({username:username}).toArray()
        let answers=found[0].twofa.answer
        answers.splice(0,1)
        await client.updateOne({username:username},{$set:{"twofa.answer":answers}})
    },600000)
    return;
}
function timeout(to_do,time){
    setTimeout(to_do,time)
}

// https://stackoverflow.com/a/1349426
function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}
function validate_passcode(passcode){
    return passcode.length>11&&passcode.length<25&&/\d/.test(passcode)&&/[ -/:-@[-`{-~]/.test(passcode)
}
function echo_JSON(echo){return JSON.parse(JSON.stringify(echo))}

// https://www.w3resource.com/javascript/form/email-validation.php, modified some
function validate_email(mail){
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail)
}