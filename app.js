
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

var from_email = '';
var from_pass = '';
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
        res.end("Invalid");
    }else{
        var verification_token = randomstring.generate();
        var url = "http://localhost:8080/verify_email/"+email+"/"+verification_token;
        var mailOptions = {
            from: from_email,
            to: email,
            subject: 'Verify your account',
            html:'To Verify your account Click <a href='+url+'>here</a>'
        }
        var query = "Insert into users(first_name, last_name, email, password, verification_token) values ('"+firstName+"','"+lastName+"','"+email+"','"+hash_pass+"','"+verification_token+"')";
        con.query(query, function(err, result){
            if(err){
                res.end(JSON.stringify("Something went wrong in insert"));
            }else{
                transporter.sendMail(mailOptions, function(error, info){
                    if(error){
                        console.log(error);
                        query = "Delete from users where email='"+email+"'";
                        con.query(query, function(derror, success_result){
                            if(derror) throw derror;
                            if(success_result.affectedRows > 0){
                                res.end(JSON.stringify("Something went wrong in mail"));
                            }
                        });
                    }else{
                      res.end(JSON.stringify("Mail sent successfully"));  
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
    var query = "Update users set verified=1, verification_token=NULL where email='"+email+"' and verification_token='"+token+"'";
    // console.log(query)
    con.query(query, function(err, result){
        if(err){
            res.end(err);
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


app.post('/password_reset_mail', function(req, res){
    var email = req.body.email;
    var token = randomstring.generate();
    var url = "http://localhost:8080/password_reset_confirm/"+email+"/"+token;
    var mailOptions = {
        from: from_email,
        to: email,
        subject: 'Reset your password',
        html:'To Verify Click <a href='+url+'>here</a>'
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
            var hash_pass = bcrypt.hashSync(password, 10);
            var query = "Update users set password='"+hash_pass+"' where email='"+email+"'";
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
    }else{
        res.end("Password does not match");
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
    return true;
}

//CHECK THIS 
app.post('/add_project_to_database',function(req,res){
    var projectName = req.body.project_name;
    //CHECK IF PROJECT EXISTS
    var query_search_project = "Select project_name from projects where project_name = '" + projectName + "'";
    con.query(query_search_project,function(error,result){
        if(error){
            console.log('PROJECT NOT FOUND ! ');
            //res.send('Project Not Found!');
        }
        else{
            return res.send('PROJECT Already EXISTS');
        }
    });
    
    //INSERTING PROJECT
    
    var query = "Insert into projects(project_name) values ('" + projectName + "')";
    
    con.query(query, function(err, result){
        if(err){
            var query_create = "CREATE TABLE IF NOT EXISTS projects (project_name VARCHAR(50), ID int NOT NULL AUTO_INCREMENT , PRIMARY KEY (ID))"; 
            con.query(query_create,function(error,res_create){
                if(error){
                    console.log(error);
                    res.send(error);
                }
                else{
                    console.log("TABlE CREATED");
                    con.query(query,function(error_insert,response){
                        if(error_insert){
                            console.log(error_insert);
                            res.send(error_insert);
                        }
                        else{
                            console.log("RECORD INSERTED SUCCESSFULLY !");
                            return res.send("RECORD INSERTED SUCCESSFULLY !");
                        }
                    });
                }
            });
        }else{
            res.send("Successfully Inserted Project");
        }
    });
});


app.get('/search_project/:project_name',function(req,res){
    console.log(req.params.project_name);
    var projectName = req.params.project_name;
    //CHECK IF PROJECT EXISTS
    var query_search_project = "Select * from projects where project_name = '" + projectName + "'";
    console.log(query_search_project);
    con.query(query_search_project,function(error,result){
        if(error){
            console.log('PROJECT NOT FOUND ! ');
            return res.send('Project Not Found!');
        }
        else{
            
            if (!result.length){
                console.log("Project Does not Exist In table!");
                return res.send("NO such project Exists!");
            }
            else{
                console.log("RESULT: ",result);
                console.log(result[0]['ID'],result[0]['project_name']);
                return res.send('PROJECT EXISTS');
            }
            
        }
    });
});


app.post('/add_project_to_user',function(req,res){
    var projectId = req.body.projectId;
    var userEmail= req.body.userEmail;
    
    console.log({projectId,userEmail});
    
    var userProjectsString ;
    var userProjectsStringArray = [];
    var userProjectsIntArray = [];
    var query = "Select projects from users where email = '" + userEmail + "'";  

    con.query(query,function(err,result){
        if(err){
            console.log(err);
            // return res.send(err);
        }
        else{
            if(!result.length){
                console.log('No user by that email exists !');
                return res.send('NO user by that email exists !');
            }
            else{
                console.log("RESULT ",result[0]['projects']);
                if(result[0]['projects']){
                    userProjectsString = result[0]['projects'];
                    userProjectsStringArray = userProjectsString.split(",");
                    userProjectsStringArray.forEach(function(projectId){
                        userProjectsIntArray.push(parseInt(projectId));
                    });
                    console.log(userProjectsIntArray);
                    if(userProjectsIntArray.length > 4 ){
                        return res.send('Max Project Limit Reached');
                    }
                    else if(userProjectsIntArray.indexOf(parseInt(projectId)) != -1){
                        return res.send('Project Already Added to users Profile');
                    }
                    else{
                        userProjectsString += "," + projectId;
                        var update_query = "UPDATE users SET projects ='" + userProjectsString +"' Where email =" + "'" + userEmail + "'";
                        console.log(update_query);
                        con.query(update_query,function(error_update,res_update){
                            if(error_update){
                                console.log('FAILED TO UPDATE!');
                                res.send('UPDATE FAILED!');
                            }
                            else{
                                return res.send('Project Added to User Profile !');
                            }
                        });
                        
                    }
                }
                else{
                    console.log('no PROJECT, FIELD NULL for user');
                    var update_query = "UPDATE users SET projects ='" + projectId +"' Where email =" + "'" + userEmail + "'";
                    console.log(update_query);
                    con.query(update_query,function(error_update,res_update){
                        if(error_update){
                            console.log('FAILED TO UPDATE!');
                            res.send('UPDATE FAILED!');
                        }
                        else{
                            return res.send('Project Added to User Profile !');
                        }
                    });
                }
                
            }
        }
    });
    // var query = "Insert into users(projects) values ('" + projectName + "') where email = '" + userEmail + "'";

});


app.post('/remove_project_from_user',function(req,res){
    var projectName = req.body.project_name;
    var userId = req.body.userId;
    console.log({'projectName':projectName,'userId':userId});

});


app.listen(port,function(){
    console.log(`App is running on port ${port}`);
});