// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;

router.route('/attendancechartbydate/:select_date/:section_id')
    .get(function (req, res, next) {
        var select_date = req.params.select_date;
        var section_id = req.params.section_id;
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        console.log(select_date)
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                    {
                                        student_id: "$student_id",
                                        first_name: "$first_name",
                                        last_name: "$last_name",
                                        roll_no: "$roll_no",
                                    }
                            }
                        ]).sort({roll_no: 1}).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSubjects(result, next) {
                        db.collection('subjects').find({ section_id: section_id, status: 1 }).toArray(function (err, subjectsResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, subjectsResult);
                        });
                    },
                    function getSectionAttendance(result, subjectsResult, next) {
                        var studentResult = result;
                        var studentResultLength = result.length;
                        var count = 0;
                        if(studentResultLength === 0 || subjectsResult === 0) {
                            next(null, [])
                        } else {
                            studentResult.forEach(function(std) {
                                var student_id = std.student_id;
                                std.subjects = [];
                                var cursor = db.collection('attendance').aggregate([ 
                                    {
                                        $match: {
                                            date: select_date,
                                            student_id: student_id,
                                        }
                                    },    
                                    { $unwind: '$subjects' },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subjects.subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$project": {
                                            "subject_id": "$subject_doc.subject_id",
                                            "name": "$subject_doc.name",
                                            "status": "$subjects.status",
                                        }
                                    }
                                ]).sort({ subject_id: 1 }) 
                                cursor.toArray( function(err, resultArray) {
                                    count++; 
                                    for(i = 0; i < subjectsResult.length; i++) {
                                        var subject_id = subjectsResult[i].subject_id;
                                        var datacounter = 0;
                                        if(resultArray.length > 0) {
                                            for(j = 0; j < resultArray.length; j++) {
                                                if(subject_id === resultArray[j].subject_id) {
                                                    std.subjects.push(resultArray[j]); 
                                                } else {
                                                    datacounter++
                                                }
                                                if(j === (resultArray.length - 1)) {
                                                    if(datacounter === resultArray.length) {
                                                        std.subjects.push({
                                                            "_id": '',
                                                            "subject_id": subjectsResult[i].subject_id,
                                                            "name": subjectsResult[i].name,
                                                            "status": "Pending",
                                                        }); 
                                                    }
                                                    // if((i === (subjectsResult.length - 1)) && (count === studentResultLength)) {
                                                    //     next(null, studentResult);
                                                    // }
                                                }
                                            }
                                        } else {
                                            std.subjects.push({
                                                "_id": '',
                                                "subject_id": subjectsResult[i].subject_id,
                                                "name": subjectsResult[i].name,
                                                "status": "Pending",
                                            }); 
                                        }

                                    }
                                    if(count === studentResultLength) {
                                        next(null, studentResult);
                                    }
                                });   
                            })
                        }
                    }
                ],
                function (err, result1) {
                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send(result1);
                    }
                }
            )
        });
    });

router.route('/attendanceByRange/:start_date/:end_date/:section_id')
    .get(function (req, res, next) {
        var start_date = new Date(req.params.start_date);
        var end_date = new Date(req.params.end_date);
        end_date.setDate(end_date.getDate() + 1);
        var section_id = req.params.section_id;
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                    {
                                        student_id: "$student_id",
                                        first_name: "$first_name",
                                        last_name: "$last_name",
                                        roll_no: "$roll_no",
                                    }
                            }
                        ]).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSubjects(result, next) {
                        db.collection('subjects').find({ section_id: section_id, status: 1 }).toArray(function (err, subjectsResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, subjectsResult);
                        });
                    },
                    function getSectionAttendance(result, subjectsResult, next) {
                        var studentResult = result;
                        var studentResultLength = result.length;
                        var count = 0;
                        if(studentResultLength === 0) {
                            next(null, [])
                        } else {
                            studentResult.forEach(function(std) {
                                var student_id = std.student_id;
                                std.subjects = [];
                                var cursor = db.collection('attendance').aggregate([ 
                                    {
                                        $match: {
                                            'atten_date': {
                                                $gte: start_date,
                                                $lt: end_date,
                                            },
                                            student_id: student_id,
                                        }
                                    },    
                                    { $unwind: '$subjects' },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subjects.subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$project": {
                                            "subject_id": "$subject_doc.subject_id",
                                            "name": "$subject_doc.name",
                                            "status": "$subjects.status",
                                        }
                                    }
                                ]).sort({ subject_id: 1 }) 
                                cursor.toArray( function(err, resultArray) {
                                    count++; 
                                    for(i = 0; i < subjectsResult.length; i++) {
                                        var subject_id = subjectsResult[i].subject_id;
                                        var datacounter = 0;
                                        var present = 0;
                                        var absent = 0;
                                        var leave = 0;
                                        for(j = 0; j < resultArray.length; j++) {
                                            if(subject_id === resultArray[j].subject_id) {
                                                if(resultArray[j].status === "Present") {
                                                    present++;
                                                } else if(resultArray[j].status === "Absent") {
                                                    absent++;
                                                } else if(resultArray[j].status === "On Leave") {
                                                    leave++;
                                                } 
                                            } else {
                                                datacounter++
                                            }
                                            if(j === (resultArray.length - 1)) {
                                                if(datacounter === resultArray.length) {
                                                    std.subjects.push({
                                                        "subject_id": subjectsResult[i].subject_id,
                                                        "name": subjectsResult[i].name,
                                                        "present": 0,
                                                        "absent": 0,
                                                        "leave": 0,
                                                    }); 
                                                } else {
                                                    std.subjects.push({
                                                        "subject_id": subjectsResult[i].subject_id,
                                                        "name": subjectsResult[i].name,
                                                        "present": present,
                                                        "absent": absent,
                                                        "leave": leave,
                                                    }); 
                                                }
                                                if((i === (subjectsResult.length - 1)) && (count === studentResultLength)) {
                                                    next(null, studentResult);
                                                }
                                            }
                                        }
                                    }
                                });   
                            })
                        }
                    },
                ],
                function (err, result1) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send(result1);

                    }
                }
            )
        });
    });

router.route('/attendanceByRange/:class_id/:section_id/:start_date/:end_date')
    .get(function (req, res, next) {
        var start_date = new Date(req.params.start_date);
        var end_date = new Date(req.params.end_date);
        var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        end_date.setDate(end_date.getDate() + 1);
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                    {
                                        student_id: "$student_id",
                                        first_name: "$first_name",
                                        last_name: "$last_name",
                                        roll_no: "$roll_no",
                                    }
                            }
                        ]).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionAttendance(result, next) {
                        var count = 0;
                        var studentResult = result;
                        var studentResultLength = result.length;
                        if(studentResultLength === 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                studentData.present = 0;
                                studentData.absent = 0;
                                studentData.onLeave = 0;
                                studentData.count = 0;
                                var first_name = studentData.first_name;
                                var last_name = studentData.last_name;
                                var roll_no = studentData.roll_no;
                                var student_id = studentData.student_id;
                                var cursor = db.collection('attendance').aggregate([
                                    {
                                        $match: {
                                            'atten_date': {
                                                $gte: start_date,
                                                $lt: end_date,
                                            },
                                            student_id: student_id,
                                            class_id: class_id,
                                            section_id: section_id
                                        }
                                    },
                                    {
                                        "$lookup": {
                                            "from": "attendance",
                                            "localField": "section_id",
                                            "foreignField": "section_id",
                                            "as": "section_doc"
                                        }
                                    },
                    
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "section_id": "$section_id",
                                            "status": "$status",
                                            "date": "$date",
                    
                                        }
                                    }
                                ])

                                cursor.forEach(function (doc, err) {
                                    assert.equal(null, err);
                       
                                    if (doc.status == "Present") {
                                        studentData.present++;
                                        studentData.count++;
                                    }
                                    else if (doc.status == "Absent") {
                                        studentData.absent++;
                                        studentData.count++;
                                    }
                                    else if (doc.status == "On Leave") {
                                        studentData.onLeave++;
                                        studentData.count++;
                                    }
                                }, function() {
                                    count++; 
                                    resultArray.push(studentData)
                                    if(count === studentResultLength) {
                                        next(null, resultArray);
                                    }
                                })

                            })
                        }
                    }
                ],
                function (err, result1) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send(result1);

                    }
                }
            )
        });
    });

router.route('/attendancechartbyStudentAndDate/:select_date/:student_id')
    .get(function (req, res, next) {
        var select_date = new Date(req.params.select_date);
        var student_id = req.params.student_id;
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1);
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var data = db.collection('attendance').find({
            //     date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) },
            //     student_id: student_id
            // })
            // dataCount = data.count(function (e, triggerCount) {
            //     if (triggerCount > 0) {
            //         count = triggerCount;
            //     }
            // });

            // data.forEach(function (doc, err) {
            //     if (doc.status == "Present") {
            //         present += 1;
            //     }
            //     else if (doc.status == "Absent") {
            //         absent += 1;
            //     }
            //     else if (doc.status == "On Leave") {
            //         onLeave += 1;
            //     }
            // })

            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        'date': {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        student_id: student_id
                    }
                },
                {
                    "$lookup": {
                        "from": "students",
                        "localField": "student_id",
                        "foreignField": "student_id",
                        "as": "student_doc"
                    }
                },
                {
                    "$unwind": "$student_doc"
                },
                {
                    "$lookup": {
                        "from": "school_classes",
                        "localField": "class_id",
                        "foreignField": "class_id",
                        "as": "class_doc"
                    }
                },
                {
                    "$unwind": "$class_doc"
                },
                {
                    "$lookup": {
                        "from": "class_sections",
                        "localField": "section_id",
                        "foreignField": "section_id",
                        "as": "section_doc"
                    }
                },
                {
                    "$unwind": "$section_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$student_doc.first_name",
                        "last_name": "$student_doc.last_name",
                        "status": "$status",
                        "gender": "$student_doc.gender",
                        "admission_no": "$student_doc.admission_no",
                        "roll_no": "$student_doc.roll_no",
                        "class_name": "$class_doc.name",
                        "section_name": "$section_doc.name",
                        "date": "$date",

                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                length = resultArray.length;
                for (i = 0; i < resultArray.length; i++) {

                    if (resultArray[i].status == "Present") {
                        present += 1;
                    }
                    else if (resultArray[i].status == "Absent") {
                        absent += 1;
                    }
                    else if (resultArray[i].status == "On Leave") {
                        onLeave += 1;
                    }
                }
                db.close();
                res.send({
                    donutchart: resultArray,
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent
                });
            });
        });
    });

router.route('/section_attendance_status/:class_id/:section_id/:select_date')
    .get(function (req, res, next) {
        var select_date = new Date(req.params.select_date);
        var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1);
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);


            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        'date': {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        class_id: class_id,
                        section_id: section_id
                    }
                },
                {
                    "$lookup": {
                        "from": "attendance",
                        "localField": "section_id",
                        "foreignField": "section_id",
                        "as": "section_doc"
                    }
                },

                {
                    "$project": {
                        "_id": "$_id",
                        "section_id": "$section_id",
                        "status": "$status",
                        "date": "$date",

                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {

                db.close();
                res.send({
                    attendanceStatus: resultArray,

                });
            });
        });
    });

router.route('/totalstudents_attendance/:select_date/:school_id')
    .get(function (req, res, next) {
        var select_date = req.params.select_date;
        var school_id = req.params.school_id;
        var present = 0, absent = 0, onLeave = 0;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolStudents(next) {
                        db.collection('students').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getStudentsAttendance(result, next) {
                        db.collection('attendance').aggregate([
                            {
                                $match: {
                                    date: select_date,
                                    school_id: school_id
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "students",
                                    "localField": "student_id",
                                    "foreignField": "student_id",
                                    "as": "student_doc"
                                }
                            },
                            {
                                $unwind: "$student_doc"
                            },
                            {
                                $project:
                                {
                                    attendance_id: "$attendance_id",
                                    student_id: "$student_id",
                                    student_name: "$student_doc.first_name",
                                    class_id: "$class_id",
                                    section_id: "$section_id",
                                    date: "$date",
                                    day: "$day",
                                    month: "$month",
                                    year: "$year",
                                    status: "$status",
                                    student_status: "$student_doc.status",
                                }
                            }
                        ]).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            } else {
                                results = results.filter(data => data.student_status === 1);
                                next(null, result, results);
                            }
                        });
                    },
                ],
                function (err, result, results) {

                    console.log(results)
                    for (i = 0; i < results.length; i++) {

                        if (results[i].status == "Present") {
                            present += 1;
                        }
                        else if (results[i].status == "Absent") {
                            absent += 1;
                        }
                        else if (results[i].status == "On Leave") {
                            onLeave += 1;
                        }
                    }

                    var totalStudents = result.length;
                    var attendanceTaken = parseInt(present) + parseInt(absent) + parseInt(onLeave);
                    if(attendanceTaken === 0) {
                        var presentPercentage = 0;
                        var absentPercent = 0;
                        var onLeavePercent = 0;
                    } else {
                        var presentPercentage = parseFloat(((parseInt(present) / parseInt(attendanceTaken)) * 100).toFixed(2));
                        var absentPercent = parseFloat(((parseInt(absent) / parseInt(attendanceTaken)) * 100).toFixed(2));
                        var onLeavePercent = parseFloat(((parseInt(onLeave) / parseInt(attendanceTaken)) * 100).toFixed(2));
                    }

                    var school_attendance = {total_students: totalStudents, attendanceTaken: attendanceTaken, present: present, absent: absent, onLeave: onLeave, presentPercentage: presentPercentage, absentPercent: absentPercent, onLeavePercent: onLeavePercent}

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send({
                            school_attendance
                        });
                    }
                }
            );
        });
    })

router.route('/attendancechartbymonth/:select_month/:student_id')
    .get(function (req, res, next) {
        var select_month = parseInt(req.params.select_month);
        var student_id = req.params.student_id;
        var date = new Date();
        var current_year = date.getFullYear();
        var current_month = date.getMonth() + 1;
        var current_date = new Date(current_year, select_month, 0)
        
        var totalDays = current_date.getDate();

        if(current_month >= 1 && current_month < 6) {
            if(req.params.select_month >= 1 && req.params.select_month < 6) {
                var year = parseInt(current_year);
            } else if(req.params.select_month >= 6 && req.params.select_month <= 12) {
                var year = parseInt(current_year - 1);
            }
        } else if(current_month >= 6 && current_month <= 12) {
            var year = parseInt(current_year);
        }
        
        var present = 0, absent = 0, onLeave = 0, holiday = 0;
        var count = 0, dataCount;
        var resultArray = [];
        var result1 = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        month: select_month,
                        year: year,
                        student_id: student_id
                    }
                },
                {
                    "$lookup": {
                        "from": "students",
                        "localField": "student_id",
                        "foreignField": "student_id",
                        "as": "student_doc"
                    }
                },
                {
                    "$unwind": "$student_doc"
                },
                {
                    "$lookup": {
                        "from": "school_classes",
                        "localField": "class_id",
                        "foreignField": "class_id",
                        "as": "class_doc"
                    }
                },
                {
                    "$unwind": "$class_doc"
                },
                {
                    "$lookup": {
                        "from": "class_sections",
                        "localField": "section_id",
                        "foreignField": "section_id",
                        "as": "section_doc"
                    }
                },
                {
                    "$unwind": "$section_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$student_doc.first_name",
                        "last_name": "$student_doc.last_name",
                        "status": "$status",
                        "gender": "$student_doc.gender",
                        "admission_no": "$student_doc.admission_no",
                        "roll_no": "$student_doc.roll_no",
                        "class_name": "$class_doc.name",
                        "section_name": "$section_doc.name",
                        "date": "$date",
                        "day": "$day",
                    }
                }
            ]).sort({ day: 1 }).toArray(function (err, result) {

                if(result.length > 0) { 
                    for(i = 1; i <= totalDays; i++) {
                        var counter = 0;
                        var counter1 = 0;
                        var doc1 = {};
                        result.forEach(function (doc, err) {
                            counter++;
                            if(doc.day === i) {
                                counter1++;
                                if (doc.status == "Present") {
                                    present += 1;
                                }
                                else if (doc.status == "Absent") {
                                    absent += 1;
                                }
                                else if (doc.status == "On Leave") {
                                    onLeave += 1;
                                }
                                else {
                                    holiday += 1;
                                }
                                doc1 = doc
                            }
                            if(counter === result.length) {
                                if(counter1 === 1) {
                                    resultArray.push(doc1)
                                } else if(counter1 === 0) {
                                    var selectMonth = req.params.select_month;
                                    if(i < 10) {
                                        var dayi = '0' + i
                                    } else {
                                        var dayi = i
                                    }
                                    if(select_month < 10) {
                                        selectMonth = '0' + selectMonth
                                    }   
                                    console.log(selectMonth)        
                                    var date = current_year + '-' + selectMonth + '-' + dayi;
                                    resultArray.push({
                                        "_id": doc._id,
                                        "student_id": doc.student_id,
                                        "first_name": doc.first_name,
                                        "last_name": doc.last_name,
                                        "status": "Attendance Not Taken",
                                        "gender": doc.gender,
                                        "admission_no": doc.admission_no,
                                        "roll_no": doc.roll_no,
                                        "class_name": doc.class_name,
                                        "section_name": doc.section_name,
                                        "date": date,
                                        "day": i,
                                    })
                                }
                            }
                        })
                    }
                    length = present + absent + onLeave + holiday;
                    presentpercent = parseFloat(((present / length) * 100).toFixed(2));
                    absentpercent = parseFloat(((absent / length) * 100).toFixed(2));
                    leavepercent = parseFloat(((onLeave / length) * 100).toFixed(2));
                    res.send({
                        attendance: resultArray,
                        count: length,
                        present: present,
                        onleave: onLeave,
                        absent: absent,
                        presentpercent: presentpercent,
                        absentpercent: absentpercent,
                        leavepercent: leavepercent,
                    });  
                } else {
                    db.collection('students').aggregate([
                        {
                            $match: {
                                student_id: student_id
                            }
                        },
                        {
                            "$lookup": {
                                "from": "school_classes",
                                "localField": "class_id",
                                "foreignField": "class_id",
                                "as": "class_doc"
                            }
                        },
                        {
                            "$unwind": "$class_doc"
                        },
                        {
                            "$lookup": {
                                "from": "class_sections",
                                "localField": "section_id",
                                "foreignField": "section_id",
                                "as": "section_doc"
                            }
                        },
                        {
                            "$unwind": "$section_doc"
                        },
                        {
                            "$project": {
                                "_id": "$_id",
                                "student_id": "$student_id",
                                "first_name": "$first_name",
                                "last_name": "$last_name",
                                "status": "Attendance Not Taken",
                                "gender": "$gender",
                                "admission_no": "$admission_no",
                                "roll_no": "$roll_no",
                                "class_name": "$class_doc.name",
                                "section_name": "$section_doc.name",
                                "date": "",
                                "day": "",
                            }
                        }
                    ]).toArray(function (err, result1) {
                        for(i = 1; i <= totalDays; i++) {    
                            var selectMonth = req.params.select_month;
                            if(i < 10) {
                                var dayi = '0' + i
                            } else {
                                var dayi = i
                            }
                            if(select_month < 10) {
                                selectMonth = '0' + selectMonth
                            }         
                            var date = current_year + '-' + selectMonth + '-' + dayi;
                            resultArray.push({
                                "_id": result1[0]._id,
                                "student_id": result1[0].student_id,
                                "first_name": result1[0].first_name,
                                "last_name": result1[0].last_name,
                                "status": "Attendance Not Taken",
                                "gender": result1[0].gender,
                                "admission_no": result1[0].admission_no,
                                "roll_no": result1[0].roll_no,
                                "class_name": result1[0].class_name,
                                "section_name": result1[0].section_name,
                                "date": date,
                                "day": i,
                            })
                        }
                        length = 0;
                        presentpercent = 0;
                        absentpercent = 0;
                        leavepercent = 0;
                        db.close();
                        res.send({
                            attendance: resultArray,
                            count: length,
                            present: present,
                            onleave: onLeave,
                            absent: absent,
                            presentpercent: presentpercent,
                            absentpercent: absentpercent,
                            leavepercent: leavepercent,
                        }); 
                    })
                }
            })
        });
    });

router.route('/sec_attendence/:select_date/:class_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var splited = class_id.split("-");
        var school_id = splited[0];
        var resultArray = [];
        var select_date = new Date(req.params.select_date);
        var present = 0, absent = 0, onLeave = 0;
        var endDate = new Date(select_date);
        var count, dataCount;
        var classArray = [];
        var resultarray = attendenceSection = [];
        var attendenceClass = sectionArray = [];
        var className;
        endDate.setDate(endDate.getDate() + 1)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var sections = db.collection('class_sections').find({ class_id });
            var data = db.collection('attendance').find({
                date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) },
                class_id: class_id
            });

            dataCount = data.count(function (e, triggerCount) {
                if (triggerCount > 0) {
                    count = triggerCount;
                }
            });

            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        date: {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        class_id: class_id

                    },
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
                    $group: {
                        _id: '$_id',
                        section_name: {
                            "$first": "$section_doc.name"
                        },
                        status: {
                            "$first": "$status"
                        },

                    }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    sectionAttendence: resultArray,
                    // count: count,
                    // sections: sectionArray
                });
            });

        });
    });

module.exports = router;


