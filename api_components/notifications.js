// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// GET School Notifications

router.route('/notifications/:school_id')    
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('session_timings').find({ school_id: school_id, status: 1 }).sort({startTime: 1});
            var cursor = db.collection('notifications').aggregate([
                {
                    $match: {
                        school_id: school_id,
                    },
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "notification_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $lookup: {
                        from: "schools",
                        localField: "school_id",
                        foreignField: "school_id",
                        as: "schools_doc"
                    }
                },
                {
                    $unwind: "$schools_doc"
                },
                {
                    $project:
                        {
                            notification_id: "$notification_id",
                            subject: "$subject",
                            school_id: "$school_id",
                            notification_to: "$notification_to",
                            employee: "$employee_doc.first_name" + " " + "$employee_doc.last_name",
                            employeeImage: "$schools_doc.SchoolImage[0].imageSrc",
                            notification_by: "$notification_by",
                            notification_on: "$notification_on",
                        }
                }
            ]).sort({notification_id: -1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    notifications: resultArray
                });
            });
        });
    });

// GET Admin Notifications
router.route('/admin_notifications/:school_id')    
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        var count = 0;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('notifications').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        notification_to: 'admin',
                    },
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "notification_by",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $project:
                        {
                            notification_id: "$notification_id",
                            subject: "$subject",
                            school_id: "$school_id",
                            notification_to: "$notification_to",
                            notification_by: "$employee_doc.first_name",
                            notification_type: "$notification_type",
                            employeeImage: "$employee_doc.employeeImage.imageSrc",
                            notification_on: "$notification_on",
                            original_id: "$original_id",
                            status: "$status"
                        }
                }
            ]).sort({notification_id: -1});
            cursor.forEach(function (doc, err) {
                console.log(doc)
                assert.equal(null, err);
                if(doc.status === 'unread') {
                    count++;
                }
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    notifications: resultArray, unread: count
                });
            });
        });
    });

// GET Employee Notifications
router.route('/employee_notifications/:employee_id')    
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var resultArray = [];
        var unread = 0;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('session_timings').find({ school_id: school_id, status: 1 }).sort({startTime: 1});
            var cursor = db.collection('notifications').aggregate([
                {
                    $match: {
                        notification_to: employee_id,
                    },
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "notification_to",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $lookup: {
                        from: "schools",
                        localField: "school_id",
                        foreignField: "school_id",
                        as: "schools_doc"
                    }
                },
                {
                    $unwind: "$schools_doc"
                },
                {
                    $project:
                        {
                            notification_id: "$notification_id",
                            subject: "$subject",
                            school_id: "$school_id",
                            notification_toId: "$notification_to",
                            notification_to: "$employee_doc.first_name",
                            notification_by: "$notification_by",
                            notification_on: "$notification_on",
                            employeeImage: "$schools_doc.SchoolImage",
                            status: "$status"
                        }
                }
            ]).sort({notification_id: -1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                if(doc.status === "unread") {
                    unread++;
                }
                doc.employeeImage = doc.employeeImage[0].imageSrc;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    notifications: resultArray,
                    unread: unread
                });
            });
        });
    });

// Edit Notification Status
router.route('/notification_status/:notification_id')
    .put(function (req, res, next) {
        console.log(req.params.notification_id)
        var myquery = { notification_id: req.params.notification_id };
        mongo.connect(url, function (err, db) {
            db.collection('notifications').update(myquery, {
                $set: {
                    status: 'read',
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

// Delete Timing
router.route('/delete_session/:session_id')
    .put(function (req, res, next) {
        var myquery = { session_id: req.params.session_id };

        mongo.connect(url, function (err, db) {
            db.collection('session_timings').update(myquery, { $set: { status : 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Timing
router.route('/hard_delete_session/:session_id')
    .delete(function (req, res, next) {
        var myquery = { session_id: req.params.session_id };

        mongo.connect(url, function (err, db) {
            db.collection('session_timings').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// router.route('/session_time/:school_id')
//     .post(function (req, res, next) {
//         var status = 1;
//         var school_id = req.params.school_id;

//         mongo.connect(url, function (err, db) {
//             var collection = db.collection('session_timings');
//             collection.find({school_id: school_id}).forEach(function (doc, err) {
//                 if (err) {
//                     if (err.code == 11000) {
//                         console.log(err);
//                         res.end('false');
//                     }
//                     res.end('false');
//                 }
//                 var session_id = doc.session_id;
//                 var newDate = new Date();
//                 var startTime = newDate.setHours(doc.start_time.substring(0, 2), doc.start_time.substring(3, 5), 0);
//                 var endTime = newDate.setHours(doc.end_time.substring(0, 2), doc.end_time.substring(3, 5), 0);
//                 collection.update({
//                     session_id: session_id
//                 }, {
//                         $set: {
//                             startTime: startTime,
//                             endTime: endTime
//                         }
//                     }, function (err, result) {
//                         db.close();
//                         res.end('true');
//                     });
//             });
//         });
//     })

// router.route('/edit/:school_id')
//     .put(function (req, res, next) {
//         var myquery = { school_id: req.params.school_id };

//         mongo.connect(url, function (err, db) {
//             db.collection('session_timings').updateMany(myquery, {
//                 $set: {
//                     class: 'SCH-1-CL-1',
//                     section: 'SCH-1-CL-1-SEC-1',
//                 }
//             }, function (err, result) {
//                 assert.equal(null, err);
//                 if (err) {
//                     res.send('false');
//                 }
//                 db.close();
//                 res.send('true');
//             });
//         });
//     });

module.exports = router;
