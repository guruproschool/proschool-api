// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;

// Add School Events
router.route('/schoolevents/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var category = req.body.category;
        var classes = req.body.classes;
        var sections = req.body.sections;
        var students = req.body.students;
        var employee_type = req.body.employee_type;
        var employees = req.body.employees;

        console.log(req.body.category);
        console.log(req.body.employee_type);
        console.log(req.body.employees);

        if(category === 'parents') {
            var mycollection = 'students';
            if(classes.length > 1) {
                var myquery = { class_id: { $in: classes }, status: 1 }
            } else if(classes.length === 1 && sections.length > 1) {
                var myquery = { section_id: { $in: sections }, status: 1 }
            } else if(sections.length === 1) {
                var myquery = { student_id: { $in: students }, status: 1 }
            } 
        } else if(category === 'employees') {
            var mycollection = 'employee';
            if(employee_type.length > 1) {
                var myquery = { school_id: school_id, job_category: { $in: employee_type }, status: 1 }
            } else if(employee_type.length === 1) {
                var myquery = { employee_id: { $in: employees }, status: 1 }
            }
            
        } else if(category === 'admin') {

        }

        var splitted = (req.body.date).split('-');
        var month = splitted[1];

        var item = {
            school_event_id: 'getauto',
            school_id: school_id,
            event_title: req.body.event_title,
            event_type: req.body.event_type,
            organizer: req.body.organizer,
            priority: req.body.priority,
            date: req.body.date,
            month: month, 
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            description: req.body.description,
            employees: [],
            students: [],
            status: status
        };

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            if(mycollection === 'students') {
                var cursor = db.collection('students').aggregate([
                    {
                        $match: myquery
                    },
                    {
                        "$project": {
                            "attendee": "$student_id",
                            "first_name": "$first_name",
                            "last_name": "$last_name",
                        }
                    }
                ])
                cursor.forEach(function (doc, err) {
                    assert.equal(null, err);
                    doc.name = doc.first_name + '-' + doc.last_name;
                    item.students.push(doc)
                })
            } else if(mycollection === 'employee') {
                
                var cursor = db.collection('employee').aggregate([
                    {
                        $match: myquery
                    },
                    {
                        "$project": {
                            "attendee": "$employee_id",
                            "first_name": "$first_name",
                            "last_name": "$last_name",
                        }
                    }
                ])
                cursor.forEach(function (doc, err) {
                    assert.equal(null, err);
                    console.log(doc)
                    doc.name = doc.first_name + '-' + doc.last_name;
                    item.employees.push(doc)
                })
            } 
            autoIncrement.getNextSequence(db, 'schoolevents', function (err, autoIndex) {
                console.log(item)
                var collection = db.collection('schoolevents');
                collection.ensureIndex({
                    "school_event_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.event_title == null || item.end_time == null || item.date == null || item.priority == null || item.start_time == null) {
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
                                        school_event_id: school_id + '-EVENT' + id
                                    }
                                }, function (err, result1) {                                                                           
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

router.route('/schoolevents/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var d = new Date();
        var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        var currentDate = new Date(utc + (3600000*+5.5));
        // var currentDate =  nd.toLocaleString();
        var month = currentDate.getMonth() + 1;
        var day = currentDate.getDate()
        var year = currentDate.getFullYear();
        var currenthours = currentDate.getHours();
        var currentminutes = currentDate.getMinutes();
        if(month < 10) {
            month = '0' + month;
        }
        if(day < 10) {
            day = '0' + day;
        }
        var date = year + '-' + month + '-' + day;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schoolevents').find({ school_id: school_id, status: 1 }).sort({start_time: 1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var event_date = new Date(doc.date);
                var start_time = doc.start_time;
                var start_splitted = start_time.split(':');
                var end_time = doc.end_time;
                var end_splitted = end_time.split(':');
                if(doc.date === date) {
                    var starthours = parseInt(start_splitted[0]);
                    var startminutes = parseInt(start_splitted[1]);
                    var endhours = parseInt(start_splitted[0]);
                    var endminutes = parseInt(end_splitted[1]);
                    console.log(currenthours);
                    console.log(currentminutes);
                    console.log(starthours);
                    console.log(startminutes);
                    console.log(endhours);
                    console.log(endminutes);
                    if(starthours > currenthours) {
                        doc.event_status = 'UPCOMING';
                    } else if(endhours < currenthours) {
                        doc.event_status = 'COMPLETED';
                    } else if(starthours <= currenthours && endhours >= currenthours) {
                        if(startminutes > currentminutes) {
                            doc.event_status = 'UPCOMING';
                        } else if(startminutes <= currentminutes && endminutes >= currentminutes) {
                            doc.event_status = 'IN PROGRESS';
                        } else if(endminutes < currentminutes) {
                            doc.event_status = 'COMPLETED';
                        }
                    } else if(endhours < currenthours) {
                        doc.event_status = 'COMPLETED';
                    }
                } else if(event_date.getTime() > new Date(date).getTime()) {
                    doc.event_status = 'UPCOMING';
                } else if(event_date.getTime() < new Date(date).getTime()) {
                    doc.event_status = 'COMPLETED';
                }
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    school_events: resultArray
                });
            });
        });
    });

router.route('/eventsByDate/:date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var date = req.params.date;
        console.log(date)

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schoolevents').find({ date: date, school_id: school_id, status: 1 }).sort({start_time: 1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    school_events: resultArray
                });
            });
        });
    });

router.route('/eventsByMonth/:month/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var month = req.params.month;
        var year = new Date().getFullYear();
        var days = new Date(year, month, 0).getDate();
        for(i = 1; i <= days; i++) {
            resultArray.push({
                day: i,
                school_event_id: '',
                event_title: '',
                date: '',
                month: month,
                start_time: '',
                end_time: '',
                description: '',
                priority: '', 
                employees: [],
                students: [],
            })
        }
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schoolevents').find({ month: month, school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var date = doc.date;
                var splitted = date.split("-");
                var day = splitted[2];

                for(i = 1; i <= days; i++) {
                    if(parseInt(day) === i) {
                        resultArray[i-1].school_event_id = doc.school_event_id;
                        resultArray[i-1].event_title = doc.event_title;
                        resultArray[i-1].date = doc.date;
                        resultArray[i-1].month = doc.month;
                        resultArray[i-1].start_time = doc.start_time;
                        resultArray[i-1].end_time = doc.end_time;
                        resultArray[i-1].description = doc.description;
                        resultArray[i-1].priority = doc.priority;
                        resultArray[i-1].employees = doc.employees;
                        resultArray[i-1].students = doc.students;
                    }
                }
            }, function () {
                db.close();
                res.send({
                    school_events: resultArray
                });
            });
        });
    });

router.route('/school_events_details/:school_event_id')
    .get(function (req, res, next) {
        var school_event_id = req.params.school_event_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schoolevents').find({ school_event_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    schoolevents: resultArray
                });
            });
        });
    });

// Edit School Events

router.route('/edit_school_events/:school_event_id')
    .put(function (req, res, next) {
        var myquery = { school_event_id: req.params.school_event_id };
        var event_title = req.body.event_title;
        var event_type = req.body.event_type;
        var priority = req.body.priority;
        var date = req.body.date;
        var start_time = req.body.start_time;
        var end_time = req.body.end_time;
        var description = req.body.description;

        var resultArray = [];

        mongo.connect(url, function (err, db) {
            db.collection('schoolevents').update(myquery, {
                $set: {
                    event_title: event_title,
                    event_type: event_type,
                    priority: priority,
                    date: date,
                    start_time: start_time,
                    end_time: end_time,
                    description: description,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
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
                var date = year + '-' + month + '-' + day;
                var cursor = db.collection('schoolevents').find({ school_event_id: req.params.school_event_id, status: 1 });
                cursor.forEach(function (doc, err) {
                    assert.equal(null, err);
                    var event_date = new Date(doc.date);
                    console.log(event_date)
                    if(doc.date === date) {
                        doc.event_status = 'IN PROGRESS';
                    } else if(event_date.getTime() > new Date(date).getTime()) {
                        doc.event_status = 'UPCOMING';
                    } else if(event_date.getTime() < new Date(date).getTime()) {
                        doc.event_status = 'COMPLETED';
                    }
                    resultArray.push(doc);
                }, function () {
                    db.close();
                    res.send(resultArray[0]);
                });
            });
        });
    });

// Soft delete School Events
router.route('/delete_school_events/:school_event_id')
    .put(function (req, res, next) {
        var myquery = { school_event_id: req.params.school_event_id };

        mongo.connect(url, function (err, db) {
            db.collection('schoolevents').update(myquery, {
                $set: {
                    status: 0,
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

// Hard delete School Events
router.route('/delete_school_events/:school_event_id')
    .delete(function (req, res, next) {
        var myquery = { school_event_id: req.params.school_event_id };

        mongo.connect(url, function (err, db) {
            db.collection('schoolevents').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

module.exports = router;
