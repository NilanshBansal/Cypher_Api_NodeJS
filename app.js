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

//BODY PARSER CONFIG
app.use(bodyParser.urlencoded({
    extended: true
}));
  
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
        var url = "http://localhost:8080/verify_email/"+email+"/"+verification_token;
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
                        query = "Delete from users where email='"+email+"'";
                        con.query(query, function(derror, success_result){
                            if(derror) throw derror;
                            if(success_result.affectedRows > 0){
                                res.end("Something went wrong");
                            }
                        });
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

    var query = "Select first_name, last_name, email, password, verified from users where email='"+email+"'";
    con.query(query, function(err, result){
        if(err) throw err;
        if(!result || Object.keys(result).length == 0){
            res.end("Incorrect email");
        }else{
            if(result[0].verified == 1){
                if(bcrypt.compareSync(password,result[0].password)){
                    res.end(JSON.stringify(result[0]));
                }else{
                    res.end("Incorrect password");
                }
            }
            else{
                res.end("verify your email first");
            }
        }
    });
});


app.get('/verify_email/:email/:token', function(req, res){
    var email = req.params.email;
    var token = req.params.token;
    var query = "Update users set verified=1, verification_token=NULL where email='"+email+"' and verofication_token='"+token+"'";
    con.query(query, function(err, result){
        if(err){
            res.end("Something went wrong");
        }else{
            if(result.affectedRows > 0){
                query =  "Select first_name, last_name, email from users where email='"+email+"'";
                con.query(query, function(error, result){
                    if(error) throw error;
                    res.end(JSON.stringify(result));
                });
            }
        }
    });
});


app.get('/password_reset_mail', function(req, res){
    var email = req.body.email;
    var token = randomstring.generate();
    var url = "http://localhost:8080/password_reset_confirm/"+email+"/"+verification_token;
    var mailOptions = {
        from: from_email,
        to: email,
        subject: 'Reset your password',
        text:'<a href='+url+'>'+url+'</a>'
    }
    var query = "Update users set password_reset_token='"+token+"' where email='"+email+"'";
        con.query(query, function(err, result){
            if(err){
                res.end("Something went wrong");
            }else{
                if(result.affectedRows > 0){
                    transporter.sendMail(mailOptions, function(error, info){
                        if(error){
                            query = "Update users set password_reset_token=NULL where email='"+email+"'";
                            con.query(query, function(derror, success_result){
                                if(derror) throw derror;
                                if(success_result.affectedRows > 0){
                                    res.end("Something went wrong");    
                                }
                            });
                        }else{
                            res.end("Mail sent successfully");
                        }
                    });
                }
            }
        });

});

app.get('/password_reset_confirm/:email/:token', function(req, res){
    var email = req.params.email;
    var token = req.params.token;
    var query = "Update users set password_reset_token=NULL where email='"+email+"' and password_reset_token='"+token+"'";
    con.query(query, function(err, result){
        if(err){
            res.end("Something went wrong");
        }else{
            if(result.affectedRows > 0){
                query =  "Select first_name, last_name, email from users where email='"+email+"'";
                con.query(query, function(error, result){
                    if(error) throw error;
                    res.end(JSON.stringify(result));
                });
            }
        }
    });

});

app.post('/reset_password',function(req, res){
    var email = req.body.email;
    var password = req.body.password;
    var repass = req.body.re_pass;
    if(password == repass){
        if(!schema.validate(password)){
            res.end("Password too weak");
        }else{
            var query = "Update users set password='"+password+"' where email='"+email+"'";
            con.query(query, function(error, result){
                if(error){
                    res.end("Something went wrong");
                }else{
                    if(result.affectedRows > 0){
                        res.end("Password changed successfully");
                    }else{
                        res.end("Email not matched");
                    }
                }
            });
        }
    }
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

app.get('/search_project',function(req,res){
    console.log("project name: ",req.query.name);
    res.send(req.query.name);
});

app.get('/search_user',function(req,res){
    console.log("User name: ",req.query.name);
    res.send(req.query.name);
});

app.post('/add_project',function(req,res){
    var projectName = req.body.project_name;
    var userId = req.body.userId;
    console.log({projectName,userId});
});

app.post('/remove_project',function(req,res){
    var projectName = req.body.project_name;
    var userId = req.body.userId;
    console.log({'projectName':projectName,'userId':userId});
});


app.listen(port,function(){
    console.log(`App is running on port ${port}`);
});