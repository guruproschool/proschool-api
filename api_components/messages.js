// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var router = express.Router();
var async = require('async');
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

router.route('/messages/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var d = new Date();
        var day = d.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var month = d.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var year = d.getFullYear();
        var date = year + '-' + month + '-' + day;
        var school_id = req.params.school_id;
        var role = req.body.role;
        console.log(role)
        var item = {
            message_id: 'getauto',
            message: req.body.message,
            subject: req.body.subject,
            sent_to: req.body.sent_to,
            receiver: req.body.receiver,
            sender: req.body.sender,
            sender_name: req.body.sender_name,
            posted_on: date,
            school_id: school_id,
            message_status: 'unread',
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'messages', function (err, autoIndex) {
                var collection = db.collection('messages');
                collection.ensureIndex({
                    "message_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.message == null) {
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
                                    message_id: 'MSG-' + autoIndex
                                }
                            }, function (err, result) {
                                // var mail = {
                                //     from: "sample.moksha@gmail.com",
                                //     to: "sample.moksha@gmail.com",
                                //     subject: item.subject,
                                //     text: "School has sent you a message: " + item.message,
                                //     html: "School has sent you a message: " + item.message
                                // }

                                // smtpTransport.sendMail(mail, function (error, response) {
                                //     if (error) {
                                //         console.log(error);
                                //     } else {
                                //         console.log("Message sent: ");
                                //     }                            
                                //     smtpTransport.close();
                                // });
                                var message = req.app.get('msg_socketio');
                                if (item.sent_to === 'Employees' || item.sent_to === 'teacher') {
                                    var user_id = school_id + '-' + item.sent_to;
                                } else if (item.sent_to === 'admin') {
                                    var user_id = school_id;
                                } else {
                                    var user_id = item.sent_to;
                                }
                                console.log(user_id)
                                message.emit(user_id, item);
                                db.close();
                                res.end('true');
                            });
                        });
                    }
                });
            });
        });
    })

router.route('/outbox_messages/:sender/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var sender = req.params.sender;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({ school_id: school_id, sender: sender, status: 1 });
            cursor.forEach(function (doc, err) {
                // if(doc.category === 'Parents') {
                //     var collection = 'students'
                // } else if(doc.category === 'Employees') {
                //     var collection = 'employee'
                // }
                // var document = doc;
                // db.collection(collection).find({
                //     $or: [
                //         { 'student_id' : document.sent_to},
                //         { 'employee_id' : document.sent_to },
                //     ]
                // }).toArray(function (err, result) {

                //     if(result.length > 0) {

                //         document.sent_to = result[0].first_name;

                //     } else {
                //         document.sent_to = doc.sent_to
                //     }

                // })
                assert.equal(null, err);
                resultArray.push(doc);

            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/inbox_messages/:sent_to/:role/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var sent_to = req.params.sent_to;
        var role = req.params.role;
        var count = 0;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({
                school_id: school_id,
                status: 1,
                $or: [
                    { 'sent_to': sent_to },
                    { 'sent_to': role },
                    { 'sent_to': 'Employees' }
                ]
            }).sort({ _id: -1 });
            cursor.forEach(function (doc, err) {
                if (doc.message_status === 'unread') {
                    count++;
                }
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray, unread: count
                });
            });
        });
    });

// PUT Message Status
router.route('/message_status/:message_id')
    .put(function (req, res, next) {
        var myquery = { message_id: req.params.message_id };

        mongo.connect(url, function (err, db) {
            db.collection('messages').update(myquery, {
                $set: {
                    message_status: 'read',
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/parentInbox_messages/:sent_to/:role/:class_id/:section_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        var sent_to = req.params.sent_to;
        var role = req.params.role;
        console.log(class_id)
        console.log(section_id)
        console.log(sent_to)
        console.log(role)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({
                school_id: school_id,
                status: 1,
                $or: [
                    { 'sent_to': sent_to },
                    { 'sent_to': role },
                    { 'sent_to': class_id },
                    { 'sent_to': section_id }
                ]
            });
            cursor.forEach(function (doc, err) {
                console.log(doc)
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/messages/:receivers/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var receivers = req.params.receivers;
        var school_id = req.params.school_id;
        var cursor;
        if (receivers == "teachers") {
            receivers = "parents";
        }
        else if (receivers == "parents") {
            receivers = "teachers";
        }
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            if (receivers != "all") {
                cursor = db.collection('messages').find({ 'sent_to': { $ne: receivers }, school_id: school_id }).sort({ posted_on: -1 });
            }
            else if (receivers == "all") {
                cursor = db.collection('messages').find({ 'sent_to': receivers, school_id: school_id }).sort({ posted_on: -1 });
            }
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/total_messages/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({ school_id: school_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/messages/:sent_to/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var sent_to = req.params.sent_to;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({ school_id: school_id, sent_to: sent_to });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/total_messages/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('messages').find({ school_id: school_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });
// Teacher send message to parent

router.route('/teacher_msg_all_parents/:section_id/:student_id/:parent_id')
    .post(function (req, res, next) {
        var status = 1;
        var date = new Date();
        var parent_id = req.params.parent_id;
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];

        var item = {
            message_tacher_id: '',
            student_id: student_id,
            section_id: section_id,
            school_id: school_id,
            parent_id: parent_id,
            teacher_id: req.body.teacher_id,
            date: new Date(),
            message: req.body.message
        };

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'teacher_messages', function (err, autoIndex) {
                var collection = db.collection('teacher_messages');
                collection.ensureIndex({
                    "message_tacher_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.message == null || item.parent_id == null) {
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
                                    message_tacher_id: 'Teacher-Msg-' + autoIndex
                                }

                            }, function (err, result) {
                                db.close();
                                res.end('true');
                            });
                        });
                    }
                });
            });
        });
    })
// Teacher send Message to parents
router.route('/teacher_msg_all_parents/:section_id/:school_id')
    .post(function (req, res, next) {

        // var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        var school_id = req.params.school_id;
        var teacher_id = req.body.teacher_id;
        var d = new Date();
        var message = req.body.message;

        if (section_id == null || school_id == null || !req.body.parents) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.parents.length > 0) {
                forEach(req.body.parents, function (key, value) {

                    var item = {
                        message_tacher_id: '',
                        section_id: section_id,
                        school_id: school_id,
                        teacher_id: teacher_id,
                        date: new Date(),
                        student_id: key.student_id,
                        parent_id: key.parent_id,
                        message: message
                    };

                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'teacher_messages', function (err, autoIndex) {
                            var collection = db.collection('teacher_messages');
                            collection.ensureIndex({
                                "message_tacher_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (item.section_id == null || item.message == null || item.parent_id == null) {
                                    res.end('null');
                                } else {
                                    item.message_tacher_id = 'Teacher-Msg-' + autoIndex;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                            if (err.code == 11000) {

                                                res.end('false');
                                            }
                                            res.end('false');
                                        }
                                        count++;
                                        db.close();

                                        if (count == req.body.parents.length) {
                                            res.end('true');
                                        }
                                    });
                                }
                            });
                        });
                    });
                });
            } else {
                res.end('false');
            }
        }
    })

router.route('/parent_get_messages/:parent_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var parent_id = req.params.parent_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('teacher_messages').find({ parent_id: parent_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    messages: resultArray
                });
            });
        });
    });

router.route('/send_messages/:school_id')
    .post(function (req, res, next) {
        var school_id = req.params.school_id;
        var message = req.body.message;
        var receiver = req.body.receiver;
        var receiver_type = req.body.receiver_type;
        var sender = req.body.sender;
        var sender_type = req.body.sender_type;
        var category = req.body.category;
        var status = 'SENT';

        var studentsResult = [];



        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getReceiversList(next) {
                        if (category === 'parent') {
                            if (receiver_type === 'all_classes') {
                                var query = { school_id: receiver, status: 1 }
                            } else if (receiver_type === 'all_sections') {
                                var query = { class_id: receiver, status: 1 }
                            } else if (receiver_type === 'all_students') {
                                var query = { section_id: receiver, status: 1 }
                            } else if (receiver_type === 'student') {
                                var query = { student_id: receiver, status: 1 }
                            }
                            var cursor = db.collection('students').aggregate([
                                {
                                    $match: query
                                },
                                {
                                    "$project": {
                                        "id": "$student_id",
                                    }
                                },
                            ])
                        } else if (category === 'employee') {
                            if (receiver_type === 'all_employeetypes') {
                                var query = { school_id: receiver, status: 1 }
                            } else if (receiver_type === 'all_employees') {
                                var query = { school_id: school_id, job_category: receiver, status: 1 }
                            } else if (receiver_type === 'employee') {
                                var query = { employee_id: receiver, status: 1 }
                            }
                            var cursor = db.collection('employee').aggregate([
                                {
                                    $match: query
                                },
                                {
                                    "$project": {
                                        "id": "$employee_id",
                                    }
                                },
                            ])
                        }
                        cursor.toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function PostMessages(results, next) {
                        var studentsResult = results;
                        var studentsResultLength = results.length;
                        var timestamp = new Date().getTime();
                        var count = 0;
                        if (studentsResultLength === 0) {
                            next(null, [])
                        } else {
                            studentsResult.forEach(function (result) {
                                var receiver_id = result.id;
                                var members = [];
                                var item = {};
                                members.push(sender);
                                members.push(receiver_id);
                                var collection = db.collection('chats');
                                collection.find({
                                    $or: [
                                        { 'chat_id': members[0] + '_' + members[1] },
                                        { 'chat_id': members[1] + '_' + members[0] },
                                    ],
                                    status: 1
                                }).toArray(function (e, resultArray) {
                                    if (resultArray.length > 0) {
                                        var data = {
                                            chat_id: resultArray[0].chat_id,
                                            sender: sender,
                                            sender_type: sender_type,
                                            receiver: receiver_id,
                                            receiver_type: category,
                                            message: message,
                                            status: status,
                                            timestamp: timestamp,
                                        }
                                        collection.update({
                                            chat_id: resultArray[0].chat_id
                                        }, {
                                            "$addToSet": {
                                                "messages": data
                                            }
                                        }, function (err, result) {
                                            count++;
                                            if (err) {
                                                next(null, false)
                                            } else {
                                                var msg = req.app.get('chat_socketio');
                                                msg.emit(data.receiver, data);
                                                if (count === results.length) {
                                                    next(null, true)
                                                }
                                            }
                                        });
                                    } else {

                                        var data = {
                                            chat_id: '',
                                            sender: sender,
                                            sender_type: sender_type,
                                            receiver: receiver_id,
                                            receiver_type: category,
                                            message: message,
                                            status: status,
                                            timestamp: timestamp,
                                        }

                                        var messages = [];
                                        data.chat_id = members[0] + '_' + members[1];
                                        messages.push(data);

                                        item = {
                                            chat_id: members[0] + '_' + members[1],
                                            members: members,
                                            messages: messages,
                                            school_id: school_id,
                                            status: 1,
                                        }
                                        autoIncrement.getNextSequence(db, 'chats', function (err, autoIndex) {
                                            collection.ensureIndex({
                                                "chat_id": 1,
                                            }, {
                                                unique: true
                                            }, function (err, result) {
                                                collection.insertOne(item, function (err, result) {
                                                    if (err) {
                                                        next(null, err)
                                                    } else {

                                                        var msg = req.app.get('chat_socketio');
                                                        msg.emit(receiver_id, data);

                                                        count++;

                                                        if (count === studentsResult.length) {
                                                            next(null, true)
                                                        }
                                                    }
                                                });
                                            });
                                        });
                                    }
                                })
                            })
                        }
                    },
                ],
                function (err, result1) {

                    db.close();
                    if (err) {
                        res.send(err);
                    } else {
                        res.send(result1);
                    }
                }
            )
        })
    })

// PUT Message Reply
router.route('/reply_messages/:chat_id')
    .put(function (req, res, next) {
        var myquery = { chat_id: req.params.chat_id };
        var reply_model = req.body.reply_model;
        console.log(reply_model)
        mongo.connect(url, function (err, db) {
            db.collection('chats').update(myquery, {
                $push: {
                    messages: reply_model,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    var msg = req.app.get('chat_socketio');
                    msg.emit(reply_model.receiver, reply_model);
                    console.log('emitted')
                    db.close();
                    res.send('true');
                }
            });
        });
    });

// Update Message Status
router.route('/chatmessage_status/:chat_id')
    .put(function (req, res, next) {
        var chat_id = req.params.chat_id;
        var member_id = req.body.member_id;
        var member_type = req.body.member_type;

        console.log(chat_id);
        console.log(member_id)
        console.log(member_type)

        mongo.connect(url, function (err, db) {
            db.collection('chats').updateMany({ chat_id: chat_id, status: 1 }, {
                $set: {
                    ['messages.$[elem].status']: "READ"
                }
            },
            {  arrayFilters: [ { "elem.receiver": member_id } ],
            multi: true,   
            }, function (err, result) {
                if (member_type === 'employee' || member_type === 'parent') {
                    if (member_type === 'employee') {
                        var cursor = db.collection('employee').aggregate([
                            {
                                $match: {
                                    employee_id: member_id,
                                }
                            },
                            {
                                "$project": {
                                    "employee_id": "$employee_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "job_category": "$job_category",
                                    "employee_code": "$employee_code",
                                    "employee_image": "$employeeImage.imageSrc"
                                }
                            }

                        ])
                    } else if (member_type === 'parent') {
                        var cursor = db.collection('students').aggregate([
                            {
                                $match: {
                                    student_id: member_id,
                                }
                            },
                            {
                                $lookup: {
                                    from: "school_classes",
                                    localField: "class_id",
                                    foreignField: "class_id",
                                    as: "class_doc"
                                }
                            },
                            {
                                $unwind: "$class_doc"
                            },
                            {
                                $lookup: {
                                    from: "class_sections",
                                    localField: "section_id",
                                    foreignField: "section_id",
                                    as: "section_doc"
                                }
                            },
                            {
                                $unwind: "$section_doc"
                            },
                            {
                                "$project": {
                                    "student_id": "$student_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "parent_name": "$parents",
                                    "class_id": "$class_id",
                                    "class_name": "$class_doc.name",
                                    "section_id": "$section_id",
                                    "section_name": "$section_doc.name",
                                    "roll_no": "$roll_no",
                                    "student_image": "$studentImage.imageSrc"
                                }
                            }

                        ])
                    }
                    cursor.toArray(function (err, result) {
                        if (err) {
                            db.close();
                            res.send('false');
                        } else {
                            db.close();
                            res.send(result);
                        }
                    });
                } else {
                    db.close();
                    res.send('true')
                }
            })
        });
    });

module.exports = router;