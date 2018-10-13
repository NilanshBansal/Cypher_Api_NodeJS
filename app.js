var express = require('express');
var app = express();
var mysql = require('mysql');
var bodyParser = require('body-parser');
var email_validator = require('email-validator');
var password_validator = require('password-validator');
var bcrypt = require("bcrypt");
var randomstring = require("randomstring");
var nodemailer = require("nodemailer");
var port = 8080;

var from_email = 'jatinjain2775@gmail.com';
var from_pass = 'jatinj@2775';
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth:{
        user: from_email,
        pass: from_pass
    }
});

var schema = new password_validator();
schema
.is().min(6)
.is().max(100)
.has().digits()
.has().not().spaces();


var con = mysql.createConnection({
            host:"localhost",
            user:"root",
            password:"password",
            database:"cybernetics",
          });

con.connect(function(err){
    if (err) throw err;
    console.log("Connected!");
});

app.set('view engine', 'ejs');
app.use(bodyParser());

app.get('/', function(req, res){
    res.render('index');
});

app.post('/signup', function(req, res){
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var email = req.body.email;
    var password = req.body.password
    var hash_pass = bcrypt.hashSync(password, 10);
    if(!verifyCredentials(firstName, lastName, email, password)){
        res.render("Invalid");
    }else{
        var verification_token = randomstring.generate();
        var url = "http://localhost:8080/"+email+"/"+verification_token;
        var mailOptions = {
            from: from_email,
            to: email,
            subject: 'Verify your account',
            text:'<a href='+url+'>'+url+'</a>'
        }
        var query = "Insert into users(first_name, last_name, email, password, verification_token) values ('"+firstName+"','"+lastName+"','"+email+"','"+hash_pass+"','"+verification_token+"')";
        con.query(query, function(err, result){
            if(err){
                res.end("Something went wrong");
            }else{
                transporter.sendMail(mailOptions, function(error, info){
                    if(error){
                        res.end("Something went wrong");
                    }else{
                      res.end("Mail sent successfully");  
                    }
                });
            }
        });
        
    }

});

app.post('/login', function(req, res){
    var email = req.body.email;
    var password = req.body.password;

    var query = "Select first_name, last_name, email, password from users where email='"+email+"' and verified="+1;
    con.query(query, function(err, result){
        if(err) throw err;
        if(!result || Object.keys(result).length == 0){
            res.end("Incorrect email");
        }else{
            if(bcrypt.compareSync(password,result[0].password)){
                res.end(JSON.stringify(result[0]));
            }else{
                res.end("Incorrect password");
            }
        }
    });
});


app.get('/:email/:token', function(req, res){
    var email = req.params.email;
    var token = req.params.token;
    
});

function verifyCredentials(firstName, lastName, email, password){
    if(!firstName || !lastName || !email || !password ){
        return false;
    }
    if(!/^[a-z]+$/i.test(firstName) || !/^[a-z]+$/i.test(lastName)){
        return false;
    }
    if(!email_validator.validate(email)){
        return false;
    }
    if(!schema.validate(password)){
        return false;
    }
}


app.listen(port,function(){
    console.log(`App is running on port ${port}`);
});