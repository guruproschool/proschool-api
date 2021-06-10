var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var forEach = require('async-foreach').forEach;
var router = express.Router();
var mailer = require('nodemailer');
var url = config.dburl;

// Use Smtp Protocol to send Email
var smtpTransport = mailer.createTransport({
    service: "gmail",
    auth: {
        user: "vinodkumaralluri90@gmail.com",
        pass: "mpwimkenkgsbyfzk"
    }
});

router.route('/userEmail_code/:user_type/:user_id')
    .post(function (req, res, next) {
        var status = 1;

        var d = new Date();
        var timestamp = d.getTime()
        var user_id = req.params.user_id;
        var user_type = req.params.user_type;

        var item = {
            code_id: 'getauto',
            user_id: req.body.user_id,
            user_type: req.body.user_type,
            code: req.body.code,
            code_type: 'email',
            verified: 'false',
            timestamp: timestamp,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'verification_codes', function (err, autoIndex) {
                var collection = db.collection('verification_codes');
                collection.ensureIndex({
                    "code_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.user_id == null || item.code == null) {
                            res.end('null');
                        } else {
                            collection.insertOne(item, function (err, result) {
                                if (err) {
                                    if (err.code == 11000) {
                                        res.end('false');
                                    }
                                    res.end('false');
                                }
                                collection.update({
                                    _id: item._id
                                }, {
                                        $set: {
                                            code_id: 'CODE-' + autoIndex
                                        }
                                    }, function (err, result) {
                                        var mail = {
                                            from: "vinodkumaralluri90@gmail.com",
                                            to: "vinodkumaralluri90@gmail.com",
                                            subject: "Email Verification",
                                            text: "The Verification Code for Email: " + item.code,
                                            html: "The Verification Code for Email: " + item.code,
                                        }
                            
                                        smtpTransport.sendMail(mail, function (error, response) {
                                            if (error) {
                                                console.log(error);
                                            } else {
                                                console.log("Message sent: ");
                                            }                            
                                            smtpTransport.close();
                                        });

                                        db.close();
                                        res.end('true');
                                    });
                            });
                        }
                    });
            });
        });
    })

module.exports = router;