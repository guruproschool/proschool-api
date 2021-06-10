// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var forEach = require('async-foreach').forEach;
var url = config.dburl;

// Add Attandance

router.route('/employee_attendance/:employee_id')
    .post(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var d = new Date();
        var month = d.getMonth() + 1;
        var day = d.getDate()
        var year = d.getFullYear()
        var select_date = new Date(year, d.getMonth(), day, 05, 30, 0, 0);
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        var time = d.getHours();
        if (time >= 13) {
            var session = 'afternoon';
        } else {
            var session = 'morning';
        }
        attendance = [];
        if (req.body.session) {
            var session = req.body.session;
        }
        var item = {
            attendance_id: 'getauto',
            employee_id: employee_id,
            date: new Date(),
            category: req.body.category,
            session: session,
            status: req.body.status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'employee_attendance', function (err, autoIndex) {
                var collection = db.collection('employee_attendance');
                var data = collection.find({
                    date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) },
                    employee_id: item.employee_id
                }).count(function (e, triggerCount) {

                    if (triggerCount > 0) {
                        res.end('false');
                    } else {
                        collection.ensureIndex({
                            "employee_attendance_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.employee_id == null || item.date == null || item.session == null || item.status == null) {
                                res.end('null');
                            } else {
                                collection.find({ employee_id: employee_id }).count(function (err, triggerCount) {
                                    var id = triggerCount + 1;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            if (err.code == 11000) {
                                                console.log(err);
                                                res.end('false');
                                            }
                                            res.end('false');
                                        }
                                        collection.update({
                                            _id: item._id
                                        }, {
                                            $set: {
                                                employee_attendance_id: item.employee_id + '-AT' + id
                                            }
                                        }, function (err, result) {
                                            db.close();
                                            res.send({
                                                employee_attendance_id: employee_id + '-EMPATT-' + autoIndex
                                            });
                                            // res.end();
                                        });
                                    });
                                })
                            }
                        });
                    }

                });
            });
        });
    })
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').find({
                employee_id
            });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    emp_attendance: resultArray
                });
            });
        });
    });

//add bulk attendance

router.route('/employee_attendancebulk/:date/:school_id')
    .post(function (req, res, next) {

        var school_id = req.params.school_id;
        var date = req.params.date;
        var d = new Date(date);
        var month = d.getMonth() + 1;
        var day = d.getDate()
        var year = d.getFullYear();
        var time = d.getHours();
        if (school_id == null) {
            res.end('null');
        } else {
            var count = 0;

            if (req.body.employees.length > 0) {
                forEach(req.body.employees, function (key, value) {

                    if (time >= 13) {
                        var session = 'afternoon';
                    } else {
                        var session = 'morning';
                    }
                    attendance = [];
                    if (req.body.session) {
                        var session = req.body.session;
                    }
                    var item = {
                        employee_attendance_id: '',
                        employee_id: key.employee_id,
                        school_id: school_id,
                        date: date,
                        atten_date: d,
                        day: day,
                        month: month,
                        year: year,
                        category: key.job_category,
                        session: session,
                        status: key.status
                    };

                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'employee_attendance', function (err, autoIndex) {
                            var data = db.collection('employee_attendance').find({
                                date: date,
                                employee_id: item.employee_id
                            }).count(function (e, triggerCount) {
                                if (triggerCount > 0) {
                                    count++;
                                    if (count == req.body.employees.length) {
                                        res.send('null');
                                    }
                                } else {

                                    var collection = db.collection('employee_attendance');
                                    collection.ensureIndex({
                                        "employee_attendance_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.date == null || item.session == null || item.status == null || item.category == null) {
                                            res.end('null');
                                        } else {
                                            collection.find({ employee_id: key.employee_id }).count(function (err, triggerCount) {
                                                var id = triggerCount + 1;
                                                item.employee_attendance_id = key.employee_id + '-AT' + id;
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
    
                                                    if (count == req.body.employees.length) {
                                                        res.end('true');
                                                    }
                                                });
                                            })
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
    });

router.route('/edit_attendance/:employee_attendance_id/:name/:value')
    .post(function (req, res, next) {
        var employee_attendance_id = req.params.employee_attendance_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('employee_attendance').update({
                employee_attendance_id
            }, {
                $set: {
                    [name]: value
                }
            }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/get_employee_attendance/:employee_id/')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').find({
                employee_id
            }, {
                'status': 1,
                'session': 1,
                'date': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/get_employee_attendance_by_date/:employee_id/:date')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var date = req.params.date;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').find({
                student_id,
                date
            }, {
                'status': 1,
                'session': 1,
                'date': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/employee_Attendance_by_category/:category/:select_date/:school_id')
    .get(function (req, res, next) {

        var category = req.params.category;
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;
        var endDate = new Date(select_date);
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultt = [];
        endDate.setDate(endDate.getDate() + 1);

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            db.collection('employee').find({
                school_id: school_id,
                job_category: category,
                status: 1
            }).toArray(function (err, results) {
                if(err) {
                    res.send('false')
                } else {
                    var count = 0;
                    results.forEach(function (result) {
                        var employee_id = result.employee_id;
                        var resultArray = [];
                        var cursor = db.collection('employee_attendance').aggregate([
                            {
                                $match: {
                                    'date': select_date,
                                    'employee_id': employee_id
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "employee",
                                    "localField": "employee_id",
                                    "foreignField": "employee_id",
                                    "as": "employee_doc"
                                }
                            }
                        ])      
                        cursor.forEach(function (doc, err) {
                            count++;
                            assert.equal(null, err);
                            resultArray.push(doc);
                        }, function () {
                            if (resultArray[0].status == "Present") {
                                present += 1;
                            }
                            else if (resultArray[0].status == "Absent") {
                                absent += 1;
                            }
                            else if (resultArray[0].status == "On Leave") {
                                onLeave += 1;
                            }
                            resultt.push(resultArray[0]);
                            if(count === results.length) {
                                db.close();
                                res.send({
                                    employeeAttendence: resultt,
                                    count: results.length,
                                    present: present,
                                    onleave: onLeave,
                                    absent: absent            
                                });
                            }
                        });
                    })
                }
            })
        });
    });

router.route('/get_employeeattendance_id_by_date_session/:employee_id/:date/:session')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var date = req.params.date;
        var session = req.params.session;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').find({
                employee_id,
                date,
                session
            }, {
                'employee_attendance_id': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

module.exports = router;
