var express = require('express');
var app = express();
var mysql = require('mysql');
var bodyParser = require('body-parser');
var email_validator = require('email-validator');
var password_validator = require('password-validator');
var bcrypt = require("bcrypt");
var randomstring = require("randomstring");
var nodemailer = require("nodemailer");
var mongoose = require("mongoose");
var datesBetween = require("dates-between");
var port = 8080;

var Schema = mongoose.Schema;

//mongodb Connect
mongoose.connect("mongodb://localhost:27017/twitter", { useNewUrlParser: true });

//mongoDB schemas
//// twitter schema
let twitterSchema= new Schema({
    date: String,
    general_info: Schema.Types.Mixed,
    project_name: String,
    twitter_handle_info: Schema.Types.Mixed
});

////reddit schema
var redditSchema = new Schema({
    date:String,
    general_info: Schema.Types.Mixed,
    project_name: String
});

//github schema
var githubSchema = new Schema({
    date:String,
    project_name:String,
    data: Schema.Types.Mixed
});


var Twitter = mongoose.model('twitter_projects_report', twitterSchema);
var Reddit = mongoose.model('reddit_projects_report', redditSchema);
var Github = mongoose.model('github_projects_report',githubSchema);

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

app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', function (req, res) {
    res.render('index');
});


response_json = {}

app.post('/signup', function(req, res){
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var email = req.body.email;
    var password = req.body.password;
    var hash_pass = bcrypt.hashSync(password, 10);
    if(!verifyCredentials(firstName, lastName, email, password)){
        response_json['response_code'] = null;
        response_json['response_type'] = "failure";
        response_json['content'] = null;
        response_json['info'] = "Invalid Credentials";
        res.end(JSON.stringify(response_json));
    }else{
        var verification_token = randomstring.generate();
        var url = "http://localhost:8080/verify_email/"+email+"/"+verification_token;
        var mailOptions = {
            from: from_email,
            to: email,
            subject: 'Verify your account',
            html:'To Verify your account Click <a href='+url+'>here</a>'
        }
        con.query("Insert into users(first_name, last_name, email, password, verification_token) values (?,?,?,?,?)",[firstName, lastName, email, hash_pass, verification_token], function(err, result){
            if(err){
                response_json['response_code'] = null;
                response_json['response_type'] = "failure";
                response_json['content'] = null;
                response_json['info'] = err;
                res.end(JSON.stringify(response_json));
            }else{
                transporter.sendMail(mailOptions, function(error, info){
                    if(error){
                        console.log(error);
                        con.query("Delete from users where email=?",[email], function(derror, success_result){
                            if(derror){
                                response_json['response_code'] = null;
                                response_json['response_type'] = "failure";
                                response_json['content'] = null;
                                response_json['info'] = derror;
                                res.end(JSON.stringify(response_json));
                            };
                            if(success_result.affectedRows > 0){
                                response_json['response_code'] = null;
                                response_json['response_type'] = "failure";
                                response_json['content'] = null;
                                response_json['info'] = "Error in Sending mail";
                                res.end(JSON.stringify(response_json));
                            }
                        });
                    }else{
                        response_json['response_code'] = null;
                        response_json['response_type'] = "success";
                        response_json['content'] = null;
                        response_json['info'] = "Mail send successfully";
                        res.end(JSON.stringify(response_json));  
                    }
                });
            }
        });
        
    }

});

app.post('/login', function(req, res){
    var email = req.body.email;
    var password = req.body.password;

    con.query("Select first_name, last_name, email, password, verified from users where email=?",[email], function(err, result){
        if(err) throw err;
        if(!result || Object.keys(result).length == 0){
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = "Incorrect Email";
            res.end(JSON.stringify(response_json));
        }else{
            if(result[0].verified == 1){
                if(bcrypt.compareSync(password,result[0].password)){
                    response_json['response_code'] = null;
                    response_json['response_type'] = "success";
                    response_json['content'] = result[0];
                    response_json['info'] = "login successfully";
                    res.end(JSON.stringify(response_json));
                }else{
                    response_json['response_code'] = null;
                    response_json['response_type'] = "failure";
                    response_json['content'] = null;
                    response_json['info'] = "Incorrect Password";
                    res.end(JSON.stringify(response_json));
                }
            }
            else{
                response_json['response_code'] = null;
                response_json['response_type'] = "failure";
                response_json['content'] = null;
                response_json['info'] = "Verify your email first";
                res.end(JSON.stringify(response_json));
            }
        }
    });
});


app.get('/verify_email/:email/:token', function(req, res){
    var email = req.params.email;
    var token = req.params.token;
    con.query("Update users set verified=1, verification_token=NULL where email=? and verification_token=?",[email, token], function(err, result){
        if(err){
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = err;
            res.end(JSON.stringify(response_json));
        }else{
            if(result.affectedRows > 0){
                con.query("Select first_name, last_name, email from users where email=?",[email], function(error, result){
                    if(error) {
                        response_json['response_code'] = null;
                        response_json['response_type'] = "failure";
                        response_json['content'] = null;
                        response_json['info'] = error;
                        res.end(JSON.stringify(response_json));
                    }else{
                        response_json['response_code'] = null;
                        response_json['response_type'] = "success";
                        response_json['content'] = result;
                        response_json['info'] = "Verified Email";
                        res.end(JSON.stringify(response_json));
                    }
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
        con.query("Update users set password_reset_token=? where email=?",[token, email], function(err, result){
            if(err){
                response_json['response_code'] = null;
                response_json['response_type'] = "failure";
                response_json['content'] = null;
                response_json['info'] = err;
                res.end(JSON.stringify(response_json));
            }else{
                if(result.affectedRows > 0){
                    transporter.sendMail(mailOptions, function(error, info){
                        if(error){
                            con.query("Update users set password_reset_token=NULL where email=?",[email], function(derror, success_result){
                                if(derror){
                                    response_json['response_code'] = null;
                                    response_json['response_type'] = "failure";
                                    response_json['content'] = null;
                                    response_json['info'] = derror;
                                    res.end(JSON.stringify(response_json));
                                }
                                if(success_result.affectedRows > 0){
                                    response_json['response_code'] = null;
                                    response_json['response_type'] = "failure";
                                    response_json['content'] = null;
                                    response_json['info'] = "Something went wrong";
                                    res.end(JSON.stringify(response_json));
                                }
                            });
                        }else{
                            response_json['response_code'] = null;
                            response_json['response_type'] = "success";
                            response_json['content'] = null;
                            response_json['info'] = "Mail sent successfully";
                            res.end(JSON.stringify(response_json));
                        }
                    });
                }
            }
        });

});

app.get('/password_reset_confirm/:email/:token', function(req, res){
    var email = req.params.email;
    var token = req.params.token;
    
    con.query("Update users set password_reset_token=NULL where email=? and password_reset_token=?",[email, token], function(err, result){
        if(err){
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = err;
            res.end(JSON.stringify(response_json));
        }else{
            if(result.affectedRows > 0){
                con.query("Select first_name, last_name, email from users where email=?",[email], function(error, result){
                    if(error){
                        response_json['response_code'] = null;
                        response_json['response_type'] = "failure";
                        response_json['content'] = null;
                        response_json['info'] = error;
                        res.end(JSON.stringify(response_json));
                    }else{
                        response_json['response_code'] = null;
                        response_json['response_type'] = "success";
                        response_json['content'] = result;
                        response_json['info'] = "verification token success";
                        res.end(JSON.stringify(response_json));
                    }
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
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = "Password is too weak";
            res.end(JSON.stringify(response_json));
        }else{
            var hash_pass = bcrypt.hashSync(password, 10);
            con.query("Update users set password=? where email=?",[hash_pass, email], function(error, result){
                if(error){
                    response_json['response_code'] = null;
                    response_json['response_type'] = "failure";
                    response_json['content'] = null;
                    response_json['info'] = error;
                    res.end(JSON.stringify(response_json));
                }else{
                    if(result.affectedRows > 0){
                        response_json['response_code'] = null;
                        response_json['response_type'] = "success";
                        response_json['content'] = null;
                        response_json['info'] = "Password changed successfully";
                        res.end(JSON.stringify(response_json));
                    }else{
                        response_json['response_code'] = null;
                        response_json['response_type'] = "failure";
                        response_json['content'] = null;
                        response_json['info'] = "Email not matched";
                        res.end(JSON.stringify(response_json));
                    }
                }
            });
        }
    }else{
        response_json['response_code'] = null;
        response_json['response_type'] = "failure";
        response_json['content'] = null;
        response_json['info'] = "Password does not match";
        res.end(JSON.stringify(response_json));
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

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}


app.post("/twitter_project_score",async function(req, res){
    var project = req.body.project_name;
    var from_date = req.body.from_date;
    var to_date = req.body.to_date
    var dates = [];
    var record_Object = {};
    var records = [];
    for (const date of datesBetween(new Date(from_date), new Date(to_date))) {
        dates.push(formatDate(date));
    }
    await Twitter.find({project_name: project, date: {$in: dates}}, function(err, data){
        if(err){
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = err;
            res.end(JSON.stringify(response_json));
        }else{
            records = data;
        }
    });
    record_Object['twitter'] = records;
    response_json['response_code'] = null;
    response_json['response_type'] = "success";
    response_json['content'] = record_Object;
    response_json['info'] = "success";
    res.end(JSON.stringify(response_json));
});


app.post("/github_project_score",async function(req, res){
    var project = req.body.project_name;
    var from_date = req.body.from_date;
    var to_date = req.body.to_date
    var dates = [];
    var record_Object = {};
    var records = [];
    for (const date of datesBetween(new Date(from_date), new Date(to_date))) {
        dates.push(formatDate(date));
    }
    await Github.find({project_name: project, date: {$in: dates}}, function(err, data){
        if(err){
            response_json['response_code'] = null;
            response_json['response_type'] = "failure";
            response_json['content'] = null;
            response_json['info'] = err;
            res.end(JSON.stringify(response_json));
        }else{
            records = data;
        }
    });
    record_Object['github'] = records;
    response_json['response_code'] = null;
    response_json['response_type'] = "success";
    response_json['content'] = record_Object;
    response_json['info'] = "success";
    res.end(JSON.stringify(response_json));
});

app.post("/reddit_project_score", async function(req,res){
    var project = req.body.project_name;
    var from_date = req.body.from_date;
    var to_date = req.body.to_date
    var dates = [];
    var record_Object = {};
    var records = [];
    for (const date of datesBetween(new Date(from_date), new Date(to_date))) {
        dates.push(formatDate(date));
    }
    await Reddit.find({project_name: project, date: {$in: dates}},function(err,data){
        if(err){
            res.send(err);
        }
        else{
            records = data;
        }
    });
    console.log(records)
    record_Object['reddit'] = records;
    res.end(JSON.stringify(record_Object));
});

app.post("/github_project_score",async function(req, res){
    var project = req.body.project_name;
    var from_date = req.body.from_date;
    var to_date = req.body.to_date
    var dates = [];
    var record_Object = {};
    var records = [];
    for (const date of datesBetween(new Date(from_date), new Date(to_date))) {
        dates.push(formatDate(date));
    }
    await Github.find({project_name: project, date: {$in: dates}}, function(err, data){
        if(err){
            res.end(error);
        }else{
            records = data;
        }
    });
    console.log(records)
    record_Object['github'] = records;
    res.end(JSON.stringify(record_Object));
});

app.post('/add_project_to_database', function (req, res) {
    var projectName = req.body.project_name;
    console.log(projectName);
    //Checking if project exists
    // var query_search_project = "Select project_name from projects where project_name = '" + projectName + "'";
    con.query("Select project_name from projects where project_name=?",[projectName], function (error, result) {
        if (error) {
            console.log('PROJECT NOT FOUND ! ');

            //INSERTING PROJECT

            // var query = "Insert into projects(project_name) values ('" + projectName + "')";

            con.query("Insert into projects(project_name) values (?)",[projectName], function (err, result) {
                if (err) {
                    // var query_create = "CREATE TABLE IF NOT EXISTS projects (project_name VARCHAR(50), ID int NOT NULL AUTO_INCREMENT , PRIMARY KEY (ID))";
                    con.query("CREATE TABLE IF NOT EXISTS projects (project_name VARCHAR(50), ID int NOT NULL AUTO_INCREMENT , PRIMARY KEY (ID))", function (error_create, res_create) {
                        if (error_create) {
                            console.log(error_create);
                            return res.send(error_create);
                        }
                        else {
                            console.log("TABlE CREATED");
                            con.query("Insert into projects(project_name) values (?)",[projectName], function (error_insert, response) {
                                if (error_insert) {
                                    console.log(error_insert);
                                    return res.send(error_insert);
                                }
                                else {
                                    console.log("RECORD INSERTED SUCCESSFULLY !");
                                    return res.send("RECORD INSERTED SUCCESSFULLY !");
                                }
                            });
                        }
                    });
                } else {
                    return res.send("Successfully Inserted Project");
                }
            });


        }
        else {
            console.log(result);
            if (!result.length) {
                // var query_insert = "Insert into projects(project_name) values ('" + projectName + "')";
                con.query("Insert into projects(project_name) values (?)",[projectName], function (error_insert, response) {
                    if (error_insert) {
                        console.log(error_insert);
                        return res.send(error_insert);
                    }
                    else {
                        console.log("RECORD INSERTED SUCCESSFULLY !");
                        return res.send("RECORD INSERTED SUCCESSFULLY !");
                    }
                });
            }
            else {
                return res.send('PROJECT Already EXISTS');
            }

        }
    });
});


app.get('/search_project/:project_name', function (req, res) {
    console.log(req.params.project_name);
    var projectName = req.params.project_name;
    //CHECK IF PROJECT EXISTS
    // var query_search_project = "Select * from projects where project_name = '" + projectName + "'";

    con.query("Select * from projects where project_name=?",[projectName], function (error, result) {
        if (error) {
            console.log('PROJECT NOT FOUND ! ');
            return res.send('Project Not Found!');
        }
        else {

            if (!result.length) {
                console.log("Project Does not Exist In table!");
                return res.send("NO such project Exists!");
            }
            else {
                console.log("RESULT: ", result);
                console.log(result[0]['ID'], result[0]['project_name']);
                return res.send('PROJECT EXISTS');
            }
        }
    });
});

app.post('/get_user_projects',function(req,res){
    var userEmail = req.body.userEmail;
    con.query("Select projects from users where email=?",[userEmail],function(err,result){
        if(err){
            console.log(err);
            return res.send(err);
        }
        else{
            if (!result.length) {
                console.log('No user by that email exists !');
                return res.send('NO user by that email exists !');
            }
            else {
                var userProjectsString;
                var userProjectsStringArray = [];
                if (result[0]['projects']) {
                    userProjectsString = result[0]['projects'];
                    userProjectsStringArray = userProjectsString.split(",");          
                    var projects_count = userProjectsStringArray.length;
                    if(projects_count<5){
                        for (var i=projects_count;i<5;i++){
                            userProjectsStringArray[i] = null;
                        }
                    }

                    con.query('Select * from projects where ID in (?,?,?,?,?)',[userProjectsStringArray[0],userProjectsStringArray[1],userProjectsStringArray[2],userProjectsStringArray[3],userProjectsStringArray[4]],function(err_search_project,res_search_project){
                            if(err_search_project){
                                console.log(err_search_project);
                                return res.end('Error Searching ');
                            }
                            else{
                                if(!res_search_project.length){
                                    console.log("Some error !");
                                    return res.send('Error!');
                                }
                                else{
                                    console.log(res_search_project);
                                    return res.send(res_search_project);
                                }
                            }
                        });
                }
                else{
                    console.log('User has no PROJECT, FIELD NULL for user');
                    return res.end('User has no Project Added!');
                }
            }
        }
    });
});

app.post('/add_project_to_user', function (req, res) {
    var projectId = req.body.projectId;
    var userEmail = req.body.userEmail;

    console.log({ projectId, userEmail });

    if (projectId.match(/[a-z]/i)) {
        // alphabet letters found
        console.log("Invalid Project Id");
        return res.send("Invalid Project Id");
    }  
    // var query_search_project = "Select * from projects where ID = '" + projectId + "'";
    con.query("Select * from projects where ID=?",[projectId], function (error, result) {
        if (error) {
            console.log("Project NOT Found BY that ID");
            return res.send("Project NOT Found BY that ID");
        }
        else {
            if (!result.length) {
                console.log("Project Does not Exist In table!");
                return res.send("NO such project Exists!");
            }
            else {
                console.log("RESULT: ", result);

                var userProjectsString;
                var userProjectsStringArray = [];
                var userProjectsIntArray = [];
                // var query = "Select projects from users where email = '" + userEmail + "'";

                con.query("Select projects from users where email=?",[userEmail], function (err, result) {
                    if (err) {
                        console.log(err);
                        return res.send(err);
                    }
                    else {
                        if (!result.length) {
                            console.log('No user by that email exists !');
                            return res.send('NO user by that email exists !');
                        }
                        else {
                            console.log("RESULT ", result[0]['projects']);
                            if (result[0]['projects']) {
                                userProjectsString = result[0]['projects'];
                                userProjectsStringArray = userProjectsString.split(",");
                                userProjectsStringArray.forEach(function (projectId) {
                                    userProjectsIntArray.push(parseInt(projectId));
                                });
                                console.log(userProjectsIntArray);
                                if (userProjectsIntArray.length > 4) {
                                    return res.send('Max Project Limit Reached');
                                }
                                else if (userProjectsIntArray.indexOf(parseInt(projectId)) != -1) {
                                    return res.send('Project Already Added to users Profile');
                                }
                                else {
                                    userProjectsString += "," + projectId;
                                    // var update_query = "UPDATE users SET projects ='" + userProjectsString + "' Where email =" + "'" + userEmail + "'";
                                    // console.log(update_query);
                                    con.query("UPDATE users SET projects=? Where email=?",[userProjectsString,userEmail], function (error_update, res_update) {
                                        if (error_update) {
                                            console.log('FAILED TO UPDATE!');
                                            return res.send('UPDATE FAILED!');
                                        }
                                        else {
                                            return res.send('Project Added to User Profile !');
                                        }
                                    });

                                }
                            }
                            else {
                                console.log('User has no PROJECT, FIELD NULL for user');
                                // var update_query = "UPDATE users SET projects ='" + projectId + "' Where email =" + "'" + userEmail + "'";
                                // console.log(update_query);
                                con.query("UPDATE users SET projects=? Where email=?",[projectId,userEmail], function (error_update, res_update) {
                                    if (error_update) {
                                        console.log('FAILED TO UPDATE!');
                                        return res.send('UPDATE FAILED!');
                                    }
                                    else {
                                        return res.send('Project Added to User Profile !');
                                    }
                                });
                            }

                        }
                    }
                });
            }
        }
    });

});


app.post('/remove_project_from_user', function (req, res) {
    var projectId = req.body.projectId;
    var userEmail = req.body.userEmail;
    console.log({ 'projectId': projectId, 'userEmail': userEmail });

    var userProjectsString;
    var userProjectsStringArray = [];
    var userProjectsIntArray = [];
    // var query = "Select projects from users where email = '" + userEmail + "'";
    if (projectId.match(/[a-z]/i)) {
        // alphabet letters found
        console.log("Invalid Project Id");
        return res.send("Invalid Project Id");
    }

    con.query("Select projects from users where email=?",[userEmail], function (err, result) {
        if (err) {
            console.log(err);
            return res.send(err);
        }
        else {
            if (!result.length) {
                console.log('No user by that email exists !');
                return res.send('NO user by that email exists !');
            }
            else {
                console.log("RESULT ", result[0]['projects']);
                if (result[0]['projects']) {
                    userProjectsString = result[0]['projects'];
                    userProjectsStringArray = userProjectsString.split(",");
                    userProjectsStringArray.forEach(function (projectId) {
                        userProjectsIntArray.push(parseInt(projectId));
                    });
                    console.log(userProjectsIntArray);

                    if (userProjectsIntArray.indexOf(parseInt(projectId)) == -1) {
                        console.log('No such Project is added to the user!');
                        return res.send('No such Project is added to the user!');
                    }
                    else {
                        var updateProjectsString = "";
                        var projectIndex = userProjectsIntArray.indexOf(parseInt(projectId));
                        userProjectsIntArray.splice(projectIndex, 1);

                        userProjectsIntArray.forEach(function (el) {
                            updateProjectsString += el;
                            updateProjectsString += ','
                        });

                        updateProjectsString = updateProjectsString.slice(0, -1);
                        console.log("UPDATE PROJECT STRING", updateProjectsString);

                        // var update_query = "UPDATE users SET projects ='" + updateProjectsString + "' Where email =" + "'" + userEmail + "'";

                        // console.log(update_query);
                        con.query("UPDATE users SET projects=? Where email=?",[updateProjectsString,userEmail], function (error_update, res_update) {
                            if (error_update) {
                                console.log('FAILED TO Delete Project!');
                                return res.send('Delete Project FAILED!');
                            }
                            else {
                                return res.send('Project Deleted from Users Profile !');
                            }
                        });
                    }
                }
                else {
                    console.log('no PROJECT, FIELD NULL for user');
                    return res.send('USER HAS NO PROJECTS TO DELETE !');
                }
            }
        }

    });

});


app.listen(port, function () {
    console.log(`App is running on port ${port}`);
});
