var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var async = require('async');
var router = express.Router();
// var url = 'mongodb://' + config.dbname + ':27017/proschool';
var url = config.dburl;
// var chat = req.app.get('chat_socketio');

// Add Lessons

exports = module.exports = function (io) {

    var chat = io.of('/chat');

    chat.on('connection', (socket) => {
        chat.emit('SCH-1', 'Hello');
        socket.on("send_'message", (data) => {
            console.log('Hello Vinod');
            chat.emit(data.receiver, 'Hello Nitish');
            data.timestamp = Date.now();
            var chat_id = data.chat_id;
            mongo.connect(url, function (err, db) {
                var collection = db.collection('chats');
                collection.find({ status: 1, chat_id: chat_id }).count(function (e, triggerCount) {
                    if (triggerCount > 0) {
                        var message = {
                            chat_id: data.chat_id,
                            receiver: data.receiver,
                            receiver_type: data.receiver_type,
                            sender: data.sender,
                            sender_type: data.sender_type,
                            message: data.message,
                            status: data.status,
                            timestamp: data.timestamp,
                        }
                        collection.update({
                            chat_id: chat_id
                        }, {
                            "$addToSet": {
                                "messages": message
                            }
                        }, function () {
                            var count = 0;
                            db.close();
                            chat.emit(data.receiver, message)
                            // socket.emit(data.receiver, message, function() {
                            //     count++;
                            //     console.log(count)
                            // });

                        });
                    } else {
                        var members = [];
                        var messages = [];
                        members.push(data.sender);
                        members.push(data.receiver);
                        messages.push(data);
                        var splited = members[0].split('-');
                        var school_id = splited[0];
                        item = {
                            chat_id: data.chat_id,
                            members: members,
                            messages: messages,
                            school_id: school_id,
                            status: 1,
                        }
                        autoIncrement.getNextSequence(db, 'chats', function (err, autoIndex) {
                            var collection = db.collection('chats');
                            collection.ensureIndex({
                                "chat_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                collection.insertOne(item, function (err, result) {
                                    db.close();
                                    chat.emit(data.receiver, data);
                                });
                            });
                        });
                    }
                });
            });
        });
        socket.on('read_messages', (data) => {
            var chat_id = data.chat_id;
            var member_id = data.receiver;
            var member_type = data.member_type;
            console.log('Hello Vinod')
            chat.emit(data.receiver, 'Hello Nitish');
            mongo.connect(url, function (err, db) {
                var collection = db.collection('chats');
                collection.
                    findOne(
                        {
                            chat_id: chat_id, 
                        // "messages.status":{$ne : "READ"}, 
                        "messages.receiver": data.receiver,
                        messages: { $elemMatch: { status: {$ne : "READ"} } }

                         })
                        .then(res => {
                            console.log({res: JSON.stringify(res)});
                            if(res !== null) {
                                let modifiedMessage = res.messages.map(message => {
                                    if(message.status !== 'READ') {
                                        message.status = 'READ';
                                    }
                                    return message;
                                });
                                collection.update(
                                {
                                    chat_id: chat_id, 
                                    // "messages.status":{$ne : "READ"}, 
                                    "messages.receiver": data.receiver,
                                    messages: { $elemMatch: { status: {$ne : "READ"} } }
                                }, {
                                    $set: {
                                        "messages": modifiedMessage
                                    }
                                }, function (err, result1) {
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
                                            db.close();
                                            // socket.write(JSON.stringify({ req: reqName, msg: 'some response' }));
                                            // chat.emit('read' + data.member_id, result[0]);
                                            return result[0];
                                            // sendResponse(data);
                                        });
                                    } else {
                                        db.close();
                                    }
                                });
                            }
                        }
                        ).catch(err => {
                            console.error(err)
                        });

            })
        })
        socket.on('disconnect', () => {
            chat.emit('BYE', 'Bye');
            console.log('user disconnected');
        });
    })

    return router;
};

exports.createRoom = function (req, res, next) {
    console.log(req.body)
    var members = req.body.members;
    var splited = members[0].split('-');
    var school_id = splited[0];
    mongo.connect(url, function (err, db) {
        // members.forEach(function (member) {
        //     if (member.member_type === 'parent') {
        //         var collection1 = db.collection('students').find({ school_id: school_id, student_id: member.member, status: 1 })
        //     } else if (member.member_type === 'teacher') {
        //         var collection1 = db.collection('employee').find({ school_id: school_id, employee_id: member.member, status: 1 })
        //     }
        //     collection1.toArray(function (err, result) {
        //         member.name = result[0].first_name + ' ' + result[0].last_name;
        //     })
        // })
        data = {
            chat_id: req.body.chat_id,
            members: members,
            messages: req.body.messages,
            school_id: school_id,
            status: 1,
        }
        autoIncrement.getNextSequence(db, 'chats', function (err, autoIndex) {
            var collection = db.collection('chats');
            collection.ensureIndex({
                "chat_id": 1,
            }, {
                unique: true
            }, function (err, result) {
                if (data.school_id == null || data.members == null) {
                    res.end('null');
                } else {
                    collection.insertOne(item, function (err, result) {
                        if (err) {
                            if (err.code == 11000) {
                                console.log(err);
                                res.end('false');
                            }
                            res.end('false');
                        }
                        db.close();
                        res.send('true');
                    });
                }
            });
        });
    });
}

exports.getChats = function (req, res, next) {
    var resultArray = [];
    var unique_id = req.params.unique_id;
    var employees = [];
    var parents = [];
    mongo.connect(url, function (err, db) {
        async.waterfall(
            [
                function getAdminChats(next) {
                    db.collection('chats').aggregate([
                        {
                            $match: {
                                members: { $in: [unique_id] },
                                status: 1,
                            },
                        },
                        {
                            $project: {
                                "chat_id": "$chat_id",
                                "school_id": "$school_id",
                                "members": "$members",
                                "messages": "$messages",
                                "status": "$status"
                            }
                        }
                    ]).sort({ _id: -1 }).toArray(function (err, result) {
                        if (err) {
                            next(err, null);
                        }
                        next(null, result);
                    });
                },
                function getUserName(result, next) {
                    console.log(result)
                    var chatResult = result;
                    var chatResultLength = result.length;
                    var count = 0;
                    if (chatResultLength === 0) {
                        next(null, [])
                    } else {
                        chatResult.forEach(function (chat) {
                            var collection_name = '';
                            var first_name = '';
                            var last_name = '';
                            var unread = 0;
                            chat.messages.forEach(function (msg) {
                                if (msg.receiver === unique_id && msg.status === 'SENT') {
                                    unread++;
                                }
                            })
                            chat.totalMessages = chat.messages.length;
                            chat.unread = unread;
                            chat.members.forEach(function (mem) {
                                if(mem !== unique_id) {                                    
                                    var splitted = mem.split("");
                                    if(splitted[0] === "E") {
                                        var other_id = mem;
                                        collection_name = 'employee';
                                        console.log(typeof other_id)
                                        db.collection('employee').find({ employee_id: other_id, status: 1 }).toArray(function (err, result) {
                                            console.log(result)
                                            if (result.length > 0) {
                                                chat.first_name = result[0].first_name;
                                                chat.last_name = result[0].last_name;
                                                chat.profileImage = result[0].employeeImage.imageSrc;
                                            } else {
                                                chat.first_name = '';
                                                chat.last_name = '';
                                                chat.profileImage = '';
                                            }
                                        })
                                        employees.push(chat);
                                    } else if(splitted[0] === "S" && splitted[1] === "T") {
                                        other_id = mem;
                                        collection_name = 'students';
                                        db.collection(collection_name).find({ student_id: other_id, status: 1 }).toArray(function (err, result) {
    
                                            if (result.length > 0) {
                                                chat.first_name = result[0].first_name;
                                                chat.last_name = result[0].last_name;
                                                chat.profileImage = result[0].studentImage.imageSrc;
                                            } else {
                                                chat.first_name = '';
                                                chat.last_name = '';
                                                chat.profileImage = '';
                                            }
                                        })
                                        parents.push(chat);
                                    }
                                }
                            })
                            // if (chat.messages[0].sender === unique_id) {
                            //     if (chat.messages[0].receiver_type === 'employee') {
                            //         other_id = chat.messages[0].receiver
                            //         collection_name = 'employee';
                            //         db.collection(collection_name).find({ employee_id: other_id, status: 1 }).toArray(function (err, result) {
                            //             if (result.length > 0) {
                            //                 chat.first_name = result[0].first_name;
                            //                 chat.last_name = result[0].last_name;
                            //             } else {
                            //                 chat.first_name = '';
                            //                 chat.last_name = '';
                            //             }
                            //         })
                            //     } else if (chat.messages[0].receiver_type === 'student') {
                            //         other_id = chat.messages[0].receiver
                            //         collection_name = 'students';
                            //         db.collection(collection_name).find({ student_id: other_id, status: 1 }).toArray(function (err, result) {

                            //             if (result.length > 0) {
                            //                 chat.first_name = result[0].first_name;
                            //                 chat.last_name = result[0].last_name;
                            //             } else {
                            //                 chat.first_name = '';
                            //                 chat.last_name = '';
                            //             }
                            //         })
                            //     }
                            // } else if (chat.messages[0].receiver === unique_id) {
                            //     if (chat.messages[0].sender_type === 'employee') {
                            //         other_id = chat.messages[0].sender
                            //         collection_name = 'employee';
                            //         db.collection(collection_name).find({ employee_id: other_id, status: 1 }).toArray(function (err, result) {

                            //             if (result.length > 0) {
                            //                 chat.first_name = result[0].first_name;
                            //                 chat.last_name = result[0].last_name;
                            //             } else {
                            //                 chat.first_name = '';
                            //                 chat.last_name = '';
                            //             }
                            //         })
                            //     } else if (chat.messages[0].sender_type === 'student') {
                            //         other_id = chat.messages[0].sender
                            //         collection_name = 'students';
                            //         db.collection(collection_name).find({ student_id: other_id, status: 1 }).toArray(function (err, result) {

                            //             if (result.length > 0) {
                            //                 chat.first_name = result[0].first_name;
                            //                 chat.last_name = result[0].last_name;
                            //             } else {
                            //                 chat.first_name = '';
                            //                 chat.last_name = '';
                            //             }
                            //         })
                            //     }
                            // }
                            count++;
                            if (count === chatResultLength) {
                                next(null, employees, parents)
                            }
                        })
                    }
                },
            ],
            function (err, employees, parents) {
                db.close();
                if (err) {
                    res.send({
                        error: err
                    });
                } else {
                    res.send({ employees: employees, parents: parents });
                }
            }
        )
    })
}

exports.getChatDetails = function (req, res, next) {
    var resultArray = [];
    var chat_id = req.params.chat_id;
    console.log(chat_id)
    mongo.connect(url, function (err, db) {
        assert.equal(null, err);
        // var cursor = db.collection('chats').find({ status: 1, chat_id: chat_id });
        var cursor = db.collection('chats').aggregate([
            {
                $match: {
                    status: 1,
                    chat_id: chat_id
                }
            },
            {
                $project: {
                    "chat_id": "$chat_id",
                    "school_id": "$school_id",
                    "members": "$members",
                    "messages": "$messages",
                    "status": "$status"
                }
            }
        ])
        cursor.forEach(function (doc, err) {
            console.log(doc)
            assert.equal(null, err);
            delete doc._id
            resultArray.push(doc);
        }, function () {
            if(resultArray.length === 0) {
                console.log('hello')
                resultArray.push({
                    "chat_id": chat_id,
                    "school_id": "",
                    "members": [],
                    "messages": [],
                    "status": 0,
                })
            }
            db.close();
            res.send(resultArray[0]);
        });
    });
}