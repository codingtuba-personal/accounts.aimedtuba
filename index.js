const express=require('express');
const nodemailer=require('nodemailer');
const cors=require('cors');
const fs=require('fs');
const app = express();
const code="w3TeRDEqKJXvow0Gs12mwywQlR8UJsMDz9C5YRgL6xSGjZ1ZPTW2yC57YdIDJr10t7LF26I4tQyT11z260is3KA7wX9Wn659SLcy"
const twofa=[
    "What is your dad's middle name?",
    "What is your grandmother's name?",
    "What is the name of your first pet?",
    "What is the name of your first teacher?",
    "Where were you born?"
]
let database={users:[]}
fs.readFile('./database.json',(err,data)=>{
    database=JSON.parse(data);
})
setInterval(()=>{
    fs.writeFileSync('database.json',JSON.stringify(database))
},1000)

app.use(express.json());

app.listen(9090)

app.get('*', function(req, res){
    try{
        if(req.path.includes(".")){res.sendFile("/users/27cadem/desktop/aimedtuba/accounts/files/"+req.path)}
        else if(req.path!="/"){res.sendFile("/users/27cadem/desktop/aimedtuba/accounts/files/"+req.path+".html")}
        else{res.redirect(`/signup${req.query.code?"?code="+req.query.code:""}`)}
    }catch(e){res.status(404).send("Error 404")}
})
app.post('/accounts/first', (req, res)=>{
    console.log(req.body)
    if(req.body.code&&(!req.body.username)){
        if(req.body.code==code){
            res.send(true)
        }else{res.send(false)}
    }else if(req.body.code&&req.body.username){
        res.send({code:req.body.code==code,username:!database.users.find(x=>x.username==req.body.username)});
    }else{res.status(406).send("Not acceptable")}
})
app.post('/accounts/new/first', (req, res)=>{
    if(req.body.code&&req.body.username&&req.body.passcode&&req.body.twofa){
        if(validate_passcode(req.body.passcode)){
            if(req.body.code==code){
                if(validate_email(req.body.twofa)||(/^(0|1|2|3|4)$/.test(req.body.twofa)&&req.body.twofanswer)){
                    if(!database.users.find(x=>x.username==req.body.username)){
                        let _login=makeid(100);
                        while(database.users.find(x=>x.login==_login)){_login=makeid(100)}
                        database.users.push(
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
})
app.post('/accounts/enter/first',(req,res)=>{
    if(req.body.code&&req.body.username&&req.body.passcode){
        if(req.body.code==code){
            if(database.users.find(x=>x.username==req.body.username)){
                if(database.users.find(x=>x.passcode==req.body.passcode&&x.username==req.body.username)){
                    let _holder=echo_JSON(database.users.find(x=>x.username==req.body.username).twofa)
                    _holder.answer=null;
                    if(_holder.type=="email"){
                        create_code(req.body.username)
                        _holder=echo_JSON(database.users.find(x=>x.username==req.body.username).twofa)
                        nodemailer.createTransport({
                            host: 'aimedtuba.com',
                            port: 465,
                            secure: true,
                            auth: {
                                user: 'accounts@aimedtuba.com',
                                pass: '*MHlJL.r{4As'
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
})
app.post('/accounts/enter/second',(req,res)=>{
    if(req.body.code&&req.body.username&&req.body.passcode&&req.body.twofa){
        if(req.body.code==code){
            if(database.users.find(x=>x.username==req.body.username)){
                if(database.users.find(x=>x.passcode==req.body.passcode&&x.username==req.body.username)){
                    let _holder=database.users.find(x=>x.username==req.body.username).twofa
                    if(Array.isArray(_holder.answer)){
                        if(_holder.answer.includes(req.body.twofa)){
                            res.send(database.users.find(x=>x.username==req.body.username).login)
                            _holder.answer=[];
                        }else{res.status(401).send("Incorrect 2FA")}
                    }else if(_holder.answer==req.body.twofa){
                        res.send(database.users.find(x=>x.username==req.body.username).login)
                    }else{res.send(401).send("Incorrect 2FA")}
                }else{res.status(401).send("Incorrect passcode")}
            }else{res.status(404).send("User not found")}
        }else{res.status(401).send("Incorrect code")}
    }else{res.status(406).send("Not acceptable")}
})
app.post('/api/check',cors(),(req, res)=>{
    res.json({data:database.users.find(x=>x.login==req.query.login)?true:false})
})
function create_code(username){
    let _code="";
    for(let i=0;i<6;i++){
        _code+=Math.floor(Math.random()*10);
    }
    console.log(username)
    console.log(database.users.find(x=>x.username==username))
    database.users.find(x=>x.username==username).twofa.answer.splice(0, 0, _code)
    setTimeout(()=>{
        database.users.find(x=>x.username==username).twofa.answer.splice(0, 1)
    },600000)
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