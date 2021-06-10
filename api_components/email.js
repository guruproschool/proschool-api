const AWS = require('aws-sdk');
var nodemailer = require("nodemailer");
var express = require("express");
var router = express.Router();

// var transport = nodemailer.createTransport("SMTP", { // Yes. SMTP!
//     host: "ses-smtp-user.20200910-124649", // Amazon email SMTP hostname
//     secureConnection: true, // use SSL
//     port: 465, // port for secure SMTP
//     auth: {
//         user: "AKIAWW4SCDGKYXNRS6FB", // Use from Amazon Credentials
//         pass: "BPtkoB9egmBTeFdOa7TnHlVA42at7ZNfZQzXOZm+/Icm" // Use from Amazon Credentials
//     }
// });

var transport = nodemailer.createTransport({
    host: "email-smtp.ap-south-1.amazonaws.com", // Amazon email SMTP hostname
    secureConnection: true, // use SSL
    port: 465, // port for secure SMTP
    auth: {
        user: "AKIAWW4SCDGKYXNRS6FB",
        pass: "BPtkoB9egmBTeFdOa7TnHlVA42at7ZNfZQzXOZm+/Icm"
    }
});

router.route('/sampleEmail')
    .post(function (req, res, next) {
        var mailOptions = {
            from: "Amazon <success@simulator.amazonses.com>", // sender address
            to: "Vinod Kumar Alluri <vinodkumaralluri90@gmail.com>", // list of receivers
            subject: "User registerd", // Subject line
            html: "<b>New user registered!</b>" // email body
        };

        transport.sendMail(mailOptions, function(error, response){
            if(error){
                console.log(error);
            }else{
                console.log("Message sent: " + response.message);
            }
    
            transport.close(); // shut down the connection pool, no more messages
        });
    
        res.send('true');   
     
    });

module.exports = router;