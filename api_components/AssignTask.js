// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Timetable
router.route('/tasks/:school_id')
    .post(function (req, res, next) {
        var school_id = req.params.school_id;
        var currentDate = new Date();
        var month = currentDate.getMonth() + 1;
        var day = currentDate.getDate()
        var year = currentDate.getFullYear();
        if(month < 10) {
            month = '0' + month;
        }
        if(day < 10) {
            day = '0' + day;
        }
        var assigned_on = year + '-' + month + '-' + day;
      //  var assigned_to = [];
        var item = {
            task_id: 'getauto',
            task: req.body.task,
            school_id: school_id,
            department: req.body.department,
            priority: req.body.priority,
            assigned_to: req.body.assigned_to,
            posted_by: req.body.posted_by,
            assigned_on: assigned_on,
            due_date: req.body.due_date,
            completion_date: "",
            rating: 1,
            task_status: "pending",
            comments: [],
            status: 1,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'tasks', function (err, autoIndex) {
                var collection = db.collection('tasks');
                collection.ensureIndex({
                    "task_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.task == null) {
                            res.end('null');
                        } else {
                            collection.find({school_id: school_id}).count(function (err, triggerCount) { 
                                var id = triggerCount + 1;
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
                                                task_id: school_id + '-TA' + id
                                            }
                                        }, function (err, result) {
                                            var notification = {
                                                notification_id: 'getauto',
                                                subject: 'You have been assigned a Task',
                                                school_id: school_id,
                                                notification_to: req.body.assigned_to,                                     
                                                notification_by: req.body.posted_by,
                                                notification_on: assigned_on,
                                                notification_type: "task",
                                                status: 'unread',
                                            }
                                            mongo.connect(url, function (err, db) {
                                                autoIncrement.getNextSequence(db, 'notifications', function (err, autoIndex1) {
                                                    var collection1 = db.collection('notifications');
                                                    collection1.ensureIndex({
                                                        "notification_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        if (notification.subject == null || notification.notification_to == null || notification.notification_by == null) {
                                                            res.end('null');
                                                        } else {
                                                            collection.find({school_id: school_id}).count(function (err, triggerCount1) { 
                                                                var id1 = triggerCount1 + 1;
                                                                collection1.insertOne(notification, function (err, result) {
                                                                    if (err) {
                                                                        if (err.code == 11000) {
                                                                            res.end('false');
                                                                        }
                                                                        res.end('false');
                                                                    }
                                                                    collection1.update({
                                                                        _id: notification._id
                                                                    }, {
                                                                        $set: {
                                                                            notification_id: school_id + '-N-' + id1
                                                                        }
                                                                    }, function (err, result1) {                                                              
                                                                        var notifications = req.app.get('not_socketio');
                                                                        notifications.emit(item.assigned_to, notification);                                                                                                  
                                                                        db.close();
                                                                        res.end('true');
                                                                    });
                                                                });
                                                            })
                                                        }
                                                    });
                                                });
                                            });
                                        });
                                });
                            })
                        }
                    });
            });
        });
    })
    
router.route('/tasks/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "task_id": "$task_id",
                        "task": "$task",
                        "employee_id": "$employee_doc.employee_id",
                        "employee_name": "$employee_doc.first_name",
                        "school_id": "$school_id",
                        "department": "$department",
                        "priority": "$priority",
                        "assigned_to": "$assigned_to",
                        "completion_date": "$completion_date",
                        "due_date": "$due_date",
                        "rating": "$rating",
                        "task_status": "$task_status",
                        "assigned_on": "$assigned_on",
                        "comments": "$comments",
                        "status": "$status",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var comments = doc.comments;
                var unread_comments = 0;
                if(comments.length > 0) {
                    comments.forEach( function(comment) {
                        if(comment.comment_status === 'unread') {
                            unread_comments++
                        }
                    })
                } else {
                    unread_comments = 0;
                }
                doc.unread_comments = unread_comments;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    tasks: resultArray
                });
            });
        });
    });

router.route('/task_details/:task_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var task_id = req.params.task_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        task_id: task_id,
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "task_id": "$task_id",
                        "task": "$task",
                        "employee_id": "$employee_doc.employee_id",
                        "employee_name": "$employee_doc.first_name",
                        "school_id": "$school_id",
                        "department": "$department",
                        "priority": "$priority",
                        "assigned_to": "$assigned_to",
                        "completion_date": "$completion_date",
                        "due_date": "$due_date",
                        "rating": "$rating",
                        "task_status": "$task_status",
                        "assigned_on": "$assigned_on",
                        "comments": "$comments",
                        "status": "$status",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var comments = doc.comments;
                var unread_comments = 0;
                if(comments.length > 0) {
                    comments.forEach( function(comment) {
                        if(comment.comment_status === 'unread') {
                            unread_comments++
                        }
                    })
                } else {
                    unread_comments = 0;
                }
                doc.unread_comments = unread_comments;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    tasks: resultArray
                });
            });
        });
    });

router.route('/tasks_employee/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        assigned_to: employee_id,
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $group: {
                        _id: '$_id',
                        task_id: {
                            "$first": "$task_id"
                        },
                        task: {
                            "$first": "$task"
                        },
                        assigned_to: {
                            "$first": "$employee_doc.first_name"
                        },
                        department: {
                            "$first": "$department"
                        },
                        priority: {
                            "$first": "$priority"
                        },
                        assigned_on: {
                            "$first": "$assigned_on"
                        },
                        due_date: {
                            "$first": "$due_date"
                        },
                        completion_date: {
                            "$first": "$completion_date"
                        },
                        rating: {
                            "$first": "$rating"
                        },
                        task_status: {
                            "$first": "$task_status"
                        },
                    }
                }
            ]).sort({due_date: 1})
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    tasks: resultArray
                });
            });
        });
    });

router.route('/employee_task_mobile/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var today_tasks = [];
        var pending_tasks = [];
        var upcoming_tasks = [];
        var d = new Date();
        var month = d.getMonth() + 1;
        if(month < 10) {
            month = '0' + month;
        }
        var day = d.getDate();
        if(day < 10) {
            day = '0' + day;
        }
        var year = d.getFullYear();
        var current_date = year + '-' + month + '-' + day;
        console.log(current_date);
        var employee_id = req.params.employee_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        assigned_to: employee_id,
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $group: {
                        _id: '$_id',
                        task_id: {
                            "$first": "$task_id"
                        },
                        task: {
                            "$first": "$task"
                        },
                        assigned_to: {
                            "$first": "$employee_doc.first_name"
                        },
                        department: {
                            "$first": "$department"
                        },
                        priority: {
                            "$first": "$priority"
                        },
                        assigned_on: {
                            "$first": "$assigned_on"
                        },
                        assigned_by: {
                            "$first": "$posted_by"
                        },
                        due_date: {
                            "$first": "$due_date"
                        },
                        completion_date: {
                            "$first": "$completion_date"
                        },
                        rating: {
                            "$first": "$rating"
                        },
                        task_status: {
                            "$first": "$task_status"
                        },
                        comments: {
                            "$first": "$comments"
                        },
                        status: {
                            "$first": "$status"
                        },
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var comments = doc.comments;
                console.log(comments)
                var unread_comments = 0;
                if(comments.length > 0) {
                    comments.forEach( function(comment) {
                        if(comment.comment_status === 'unread' && comment.employee_id !== employee_id) {
                            unread_comments++
                        }
                    })
                } else {
                    unread_comments = 0;
                }
                doc.unread_comments = unread_comments;
                var current_time = new Date().getTime();
                var due_time = new Date(doc.due_date).getTime();
                if(doc.due_date === current_date) {
                    today_tasks.push(doc);
                } else if(due_time < current_time && doc.task_status === 'pending') {
                    pending_tasks.push(doc);
                } else if(due_time > current_time) {
                    upcoming_tasks.push(doc)
                }
            }, function () {
                db.close();
                res.send({
                    today_tasks: today_tasks, pending_tasks: pending_tasks, upcoming_tasks: upcoming_tasks
                });
            });
        });
    });

router.route('/update_task/:status/:task_id/:school_id')
    .put(function (req, res, next) {
        var myquery = { task_id: req.params.task_id };
        var school_id = req.params.school_id;
        var req_status = req.params.status;
        var updated_by = req.body.updated_by;
        var role = req.body.role;
        var date = new Date();
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        if(month < 10) {
            month = '0' + month;
        }
        var day = date.getDate();
        if(day < 10) {
            day = '0' + day;
        }
        var updated_on = year + '-' + month + '-' + day;
        if(req.params.status === 'completed') {
            var completion_date = year + '-' + month + '-' + day;
        } else if(req.params.status === 'pending') {
            var completion_date = "";
        }
        console.log(role)
        mongo.connect(url, function (err, db) {
            db.collection('tasks').update(myquery, {
                $set: {
                    task_status: req_status,
                    completion_date: completion_date,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }

                if(role === 'admin') {
                    db.close();
                    res.end('true');
                } else {
                    var notification = {
                        notification_id: 'getauto',
                        subject: updated_by + ' have Completed the Task ' + req.params.task_id,
                        school_id: school_id,
                        notification_to: 'admin',                                     
                        notification_by: updated_by,
                        notification_on: updated_on,
                        notification_type: 'task',
                        status: 'unread',
                    }
                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'notifications', function (err, autoIndex1) {
                            var collection1 = db.collection('notifications');
                            collection1.ensureIndex({
                                "notification_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (notification.subject == null || notification.notification_to == null || notification.notification_by == null) {
                                    res.end('null');
                                } else {
                                    collection1.insertOne(notification, function (err, result) {
                                        if (err) {
                                            if (err.code == 11000) {
                                                res.end('false');
                                            }
                                            res.end('false');
                                        }
                                        collection1.update({
                                            _id: notification._id
                                        }, {
                                            $set: {
                                                notification_id: school_id + '-NOT-' + autoIndex1
                                            }
                                        }, function (err, result1) {                                                              
                                            var notifications = req.app.get('not_socketio');
                                            notifications.emit(school_id, notification);                                                             
                                            db.close();
                                            res.end('true');
                                        });
                                    });
                                }
                            });
                        });
                    });
                }
            });
        });
    });

router.route('/edit_task/:task_id')
    .put(function (req, res, next) {
        var myquery = { task_id: req.params.task_id };
        var req_task = req.body.task;
        var req_department = req.body.department;
        var req_assigned_to = req.body.assigned_to;
        var req_priority = req.body.priority;
        var req_due_date = req.body.due_date;

        mongo.connect(url, function (err, db) {
            db.collection('tasks').update(myquery, {
                $set: {
                    task: req_task,
                    department: req_department,
                    assigned_to: req_assigned_to,
                    priority: req_priority,
                    due_date: req_due_date,
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

router.route('/delete_task/:task_id')
    .put(function (req, res, next) {
        var myquery = { task_id: req.params.task_id };

        mongo.connect(url, function (err, db) {
            db.collection('tasks').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/task_comments/:task_id')
    .put(function (req, res, next) {
        var myquery = { task_id: req.params.task_id };
        var timezone = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        var currentDate = new Date(timezone);
        var month = currentDate.getMonth() + 1;
        var day = currentDate.getDate()
        var year = currentDate.getFullYear();
        if(month < 10) {
            month = '0' + month;
        }
        if(day < 10) {
            day = '0' + day;
        }
        var assigned_date = year + '-' + month + '-' + day;
        var h = currentDate.getHours();
        // if(h < 10) {
        //     h = '0' + h;
        // }
        var m = currentDate.getMinutes();
        // if(m < 10) {
        //     m = '0' + m;
        // }
        // var assigned_time = (h > 12) ? (h-12 + ':' + m +' PM') : (h + ':' + m +' AM');
        var assigned_time = h + ':' + m;
        
        var comment = {
            comment: req.body.comment,
            author: req.body.author,
            author_id: req.body.author_id,
            date: assigned_date,
            time: assigned_time,
            comment_status: 'unread',
            status: 1
        }

        mongo.connect(url, function (err, db) {
            db.collection('tasks').update(myquery, { $push: { comments: comment } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send(comment);
            });
        });
    });

router.route('/tasks_manager/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('tasks').find({ school_id: school_id });
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "employee_id",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "task_id": "$task_id",
                        "task": "$task",
                        "employee_id": "$employee_doc.employee_id",
                        "school_id": "$school_id",
                        "department": "$department",
                        "priority": "$priority",
                        "assigned_to": "$employee_doc.first_name",
                        "status": "$status",
                        "completion_date": "$completion_date",
                        "rating": "$rating",
                        "assigned_on": "$assigned_on"
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    tasks: resultArray
                });
            });
        });
    });

router.route('/currentDay_task/:select_date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        task_status: 'pending',
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "task_id": "$task_id",
                        "task": "$task",
                        "employee_id": "$employee_doc.employee_id",
                        "employee_name": "$employee_doc.first_name",
                        "school_id": "$school_id",
                        "department": "$department",
                        "priority": "$priority",
                        "assigned_to": "$assigned_to",
                        "due_date": "$due_date",
                        "completion_date": "$completion_date",
                        "rating": "$rating",
                        "task_status": "$task_status",
                        "assigned_on": "$assigned_on",
                        "status": "$status",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                console.log(doc)
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    tasks: resultArray
                });
            });
        });
    });

router.route('/task_rating/:task_id')
    .put(function (req, res, next) {
        var myquery = { task_id: req.params.task_id };
        var req_rating = parseInt(req.body.rating);

        mongo.connect(url, function (err, db) {
            db.collection('tasks').update(myquery, {
                $set: {
                    rating: req_rating,
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

router.route('/employee_task_perDay/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var d = new Date();
        var month = d.getMonth() + 1;
        if(month < 10) {
            month = '0' + month;
        }
        var day = d.getDate();
        if(day < 10) {
            day = '0' + day;
        }
        var year = d.getFullYear();
        var current_date = year + '-' + month + '-' + day;
        console.log(current_date);
        var employee_id = req.params.employee_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('tasks').aggregate([
                {
                    $match: {
                        assigned_to: employee_id,
                        assigned_on: { $lte: current_date } ,
                        task_status: 'pending',
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "assigned_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $group: {
                        _id: '$_id',
                        task_id: {
                            "$first": "$task_id"
                        },
                        task: {
                            "$first": "$task"
                        },
                        assigned_to: {
                            "$first": "$employee_doc.first_name"
                        },
                        department: {
                            "$first": "$department"
                        },
                        priority: {
                            "$first": "$priority"
                        },
                        assigned_on: {
                            "$first": "$assigned_on"
                        },
                        assigned_by: {
                            "$first": "$posted_by"
                        },
                        due_date: {
                            "$first": "$due_date"
                        },
                        completion_date: {
                            "$first": "$completion_date"
                        },
                        rating: {
                            "$first": "$rating"
                        },
                        task_status: {
                            "$first": "$task_status"
                        },
                        comments: {
                            "$first": "$comments"
                        },
                        status: {
                            "$first": "$status"
                        },
                    }
                }
            ]).sort({ due_date: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc)
            }, function () {
                db.close();
                res.send({
                    today_tasks: resultArray
                });
            });
        });
    });


module.exports = router;