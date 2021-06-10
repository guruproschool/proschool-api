// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var forEach = require('async-foreach').forEach;
var async = require('async');

var router = express.Router();
var url = config.dburl;

// Add ClassTests
router.route('/classTests/:section_id/:subject_id')
    .post(function (req, res, next) {
        var status = 1;
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var splited = subject_id.split("-");
        var school_id = splited[0];
        var d = new Date();
        var month = d.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var day = d.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var year = d.getFullYear();
        var assign_date = year + '-' + month + '-' + day;
        var date_split = req.body.date.split("-");
        var date1 = date_split[0];
        var Month = parseInt(date_split[1]);
        var Year = date_split[4];

        // var chapter_name = req.params.chapter_name;
        books = [];
        var item = {
            classTest_id: 'getauto',
            section_id: section_id,
            subject_id: subject_id,
            lession_id: req.body.lession_id,
            school_id: school_id,
            title: req.body.title,
            date: req.body.date,
            assign_date: assign_date,
            maxMarks: req.body.maxMarks,
            day: day,
            month: Month,
            year: year,
            submission: 'pending',
            average_marks: 0,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'classTests', function (err, autoIndex) {
                var collection = db.collection('classTests');
                collection.ensureIndex({
                    "classTest_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.title == null) {
                        res.end('null');
                    } else {
                        collection.find({ subject_id: subject_id }).count(function (err, triggerCount) {
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
                                        classTest_id: subject_id + '-CT' + id
                                    }
                                }, function (err, result) {
                                    db.close();
                                    res.end('true');
                                });
                            });
                        })
                    }
                });
            });
        });
    })

router.route('/classTests/:section_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var subject_id = req.params.subject_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('classTests').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "subjects",
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "subject_doc"
                    }
                },
                {
                    "$unwind": "$subject_doc"
                },
                {
                    "$lookup": {
                        "from": "coursework",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "chapter_doc"
                    }
                },
                {
                    "$unwind": "$chapter_doc"
                },
                {
                    "$lookup": {
                        "from": "topics",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "topic_doc"
                    }
                },
                {
                    "$lookup": {
                        "from": "CT_marks",
                        "localField": "classTest_id",
                        "foreignField": "classTest_id",
                        "as": "classTest_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "section_id": "$section_id",
                        "classTest_id": "$classTest_id",
                        "classTest_title": "$title",
                        "lession_id": "$lession_id",
                        "chapter_title": "$chapter_doc.title",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "test_date": "$date",
                        "submission": "$submission",
                        "lession_status": "$chapter_doc.lession_status",
                        "topics": "$topic_doc",
                        "classTest_doc": "$classTest_doc",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                console.log(doc)
                var totalMarks = 0;
                var classtestMarks = doc.classTest_doc;
                classtestMarks.forEach(function (ctDoc, err) {
                    totalMarks += ctDoc.marks
                })
                doc.avg_score = parseInt(totalMarks / classtestMarks.length);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    classTests: resultArray
                });
            });
        });
    });

router.route('/student_classTests/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('classTests').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "subjects",
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "subject_doc"
                    }
                },
                {
                    "$unwind": "$subject_doc"
                },
                {
                    "$lookup": {
                        "from": "coursework",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "chapter_doc"
                    }
                },
                {
                    "$unwind": "$chapter_doc"
                },
                {
                    "$lookup": {
                        "from": "topics",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "topic_doc"
                    }
                },
                {
                    "$lookup": {
                        "from": "CT_marks",
                        "localField": "classTest_id",
                        "foreignField": "classTest_id",
                        "as": "classTest_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "section_id": "$section_id",
                        "classTest_id": "$classTest_id",
                        "classTest_title": "$title",
                        "lession_id": "$lession_id",
                        "chapter_title": "$chapter_doc.title",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "test_date": "$date",
                        "submission": "$submission",
                        "lession_status": "$chapter_doc.lession_status",
                        "topics": "$topic_doc",
                        "description": "$description",
                        "classTest_doc": "$classTest_doc",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var topics = [];
                doc.topics.forEach(function (topic, err) {
                    topics.push({ topic_name: topic.topic_name })
                })
                doc.topics = topics;
                var classTotal = 0;
                doc.classTest_doc.forEach(function (ctDoc, err) {
                    classTotal += ctDoc.marks
                })
                doc.avg_score = parseInt(classTotal / doc.classTest_doc.length);
                var classtestMarks = doc.classTest_doc.filter(data => data.student_id === student_id);
                if (classtestMarks.length > 0) {
                    doc.totalMarks = classtestMarks[0].marks;
                } else {
                    doc.totalMarks = 0;
                }
                doc.classTest_doc = classtestMarks;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    classTests: resultArray
                });
            });
        });
    });

// router.route('/student_classTests/:subject_id/:student_id')
//     .get(function (req, res, next) {
//         var resultArray = [];

//         var subject_id = req.params.subject_id;
//         var student_id = req.params.student_id;
//         mongo.connect(url, function (err, db) {
//             assert.equal(null, err);
//             var cursor = db.collection('classTests').aggregate([
//                 {
//                     $match: {
//                         subject_id: subject_id,
//                         status: 1
//                     }
//                 },
//                 {
//                     "$lookup": {
//                         "from": "subjects",
//                         "localField": "subject_id",
//                         "foreignField": "subject_id",
//                         "as": "subject_doc"
//                     }
//                 },
//                 {
//                     "$unwind": "$subject_doc"
//                 },
//                 {
//                     "$lookup": {
//                         "from": "coursework",
//                         "localField": "lession_id",
//                         "foreignField": "lession_id",
//                         "as": "chapter_doc"
//                     }
//                 },
//                 {
//                     "$unwind": "$chapter_doc"
//                 },
//                 {
//                     "$lookup": {
//                         "from": "topics",
//                         "localField": "lession_id",
//                         "foreignField": "lession_id",
//                         "as": "topic_doc"
//                     }
//                 },
//                 {
//                     "$project": {
//                         "_id": "$_id",
//                         "section_id": "$section_id",
//                         "classTest_id": "$classTest_id",
//                         "classTest_title": "$title",
//                         "lession_id": "$lession_id",
//                         "chapter_title": "$chapter_doc.title",
//                         "subject_id": "$subject_id",
//                         "subject_name": "$subject_doc.name",
//                         "maxMarks": "$maxMarks",
//                         "test_date": "$date",
//                         "submission": "$submission",
//                         "lession_status": "$chapter_doc.lession_status",
//                         "topics": "$topic_doc",
//                         "description": "$description",
//                     }
//                 }
//             ])
//             cursor.toArray(function (err, results) {
//                 assert.equal(null, err);
//                 var count = 0;
//                 results.forEach(function(doc) {

//                     var topics = [];
//                     doc.topics.forEach(function (topic) {
//                         topics.push({ topic_name: topic.topic_name })
//                     })
//                     doc.topics = topics;

//                     db.collection('CT_marks').find({classTest_id: doc.classTest_id, student_id: student_id}).toArray(function(err, result) {
//                         if(result.length > 0) {
//                             doc.classTest_doc = result[0];
//                             doc.totalMarks = result[0].marks;
//                         } else {
//                             doc.classTest_doc = {
//                                 "_id": "",
//                                 "classTest_result_id": "",
//                                 "student_id": student_id,
//                                 "subject_id": subject_id,
//                                 "section_id": "",
//                                 "school_id": "",
//                                 "classTest_id": doc.classTest_id,
//                                 "marks": 0,
//                             };
//                             doc.totalMarks = 0;
//                         }
//                         count++;
//                         resultArray.push(doc);
//                         console.log(doc);
//                         if(count === results.length) {
//                             console.log('Hello' + 3)
//                             db.close();
//                             res.send({
//                                 classTests: resultArray
//                             });
//                         }
//                     });
//                 })
//             });
//         });
//     });

// Edit ClassTest
router.route('/edit_classTests/:classTest_id')
    .put(function (req, res, next) {
        var myquery = { classTest_id: req.params.classTest_id };
        var req_title = req.body.title;
        var req_lession_id = req.body.lession_id;
        var req_date = req.body.date;
        var req_maxMarks = req.body.maxMarks;

        mongo.connect(url, function (err, db) {
            db.collection('classTests').update(myquery, {
                $set: {
                    title: req_title,
                    date: req_date,
                    maxMarks: req_maxMarks,
                    lession_id: req_lession_id
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.send('true');
                }
            });
        });
    });

// Soft Delete ClassTest
router.route('/delete_classTests/:classTest_id')
    .put(function (req, res, next) {
        var myquery = { classTest_id: req.params.classTest_id };

        mongo.connect(url, function (err, db) {
            db.collection('classTests').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('CT_marks').deleteMany(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete ClassTest
router.route('/hard_delete_classTests/:classTest_id')
    .delete(function (req, res, next) {
        var myquery = { classTest_id: req.params.classTest_id };

        mongo.connect(url, function (err, db) {
            db.collection('classTests').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('CT_marks').deleteOne(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/classTest_details/:classTest_id')
    .get(function (req, res, next) {
        var classTest_id = req.params.classTest_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('classTests').find({ classTest_id: classTest_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    classTest: resultArray
                });
            });
        });
    });

    // ClassTest Average Score
router.route('/classtest_avgScore/:classTest_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var totalMarks = 0;
        var classTest_id = req.params.classTest_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('CT_marks').find({ classTest_id: classTest_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                totalMarks += doc.marks;
                resultArray.push(doc);
            }, function () {
                console.log(totalMarks);
                console.log(resultArray.length)
                var avg_score = parseInt(totalMarks / resultArray.length)
                db.close();
                res.send({
                    avg_score: avg_score
                });
            });
        });
    });

router.route('/classTests_marksbulk_eval/:section_id/:subject_id/:classTest_id')
    .post(function (req, res, next) {

        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var classTest_id = req.params.classTest_id;
        var totalMarks = 0;
        if (subject_id == null || section_id == null || !req.body.students) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.students.length > 0) {
                forEach(req.body.students, function (key, value) {
                    totalMarks += parseInt(key.marks);
                    var item = {
                        classTest_result_id: '',
                        student_id: key.student_id,
                        subject_id: subject_id,
                        section_id: section_id,
                        school_id: school_id,
                        classTest_id: classTest_id,
                        marks: parseInt(key.marks),
                        status: 1
                    };

                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'CT_marks', function (err, autoIndex) {
                            var data = db.collection('CT_marks').find({
                                section_id: section_id,
                                classTest_id: classTest_id,
                                student_id: item.student_id
                            }).count(function (e, triggerCount) {
                                if (triggerCount > 0) {
                                    count++;
                                    if (count == req.body.students.length) {
                                        res.send('false');
                                    }
                                } else {
                                    var collection = db.collection('CT_marks');
                                    collection.ensureIndex({
                                        "classTest_result_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.subject_id == null || item.section_id == null || item.classTest_id == null || item.marks == null) {
                                            res.end('null');
                                        } else {
                                            collection.find({ classTest_id: classTest_id }).count(function (err, triggerCount1) {
                                                var id = triggerCount1 + 1;
                                                item.classTest_result_id = item.student_id + '-' + item.classTest_id + '-M' + id;
                                                collection.insertOne(item, function (err, result) {
                                                    count++;
                                                    if (err) {
                                                        console.log(err);
                                                        // if (err.code == 11000) {

                                                        //     res.end('false');
                                                        // }
                                                        db.close();
                                                        res.end('false');
                                                    } else {
                                                        if (count == req.body.students.length) {
                                                            var average_marks = (totalMarks / req.body.students.length).toFixed(2);
                                                            mongo.connect(url, function (err, db) {
                                                                db.collection('classTests').update({ classTest_id: classTest_id }, { $set: { submission: 'completed', average_marks: average_marks } }, function (err, result) {
                                                                    assert.equal(null, err);
                                                                    if (err) {
                                                                        res.send('false');
                                                                    } else {
                                                                        db.close();
                                                                        res.send('true');
                                                                    }
                                                                });
                                                            });
                                                        }
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
    })

router.route('/classTests_marksbulk_eval/:classTest_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var classTest_id = req.params.classTest_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                    status: 1
                                }
                            },
                            {
                                "$project": {
                                    "student_id": "$student_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "roll_no": "$roll_no",
                                    "section_id": "$section_id"
                                }
                            }
                        ]).sort({roll_no: 1}).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function getSchoolTermFee(results, next) {
                        var studentsResult = results;
                        var studentsResultLength = results.length;
                        var count = 0;
                        if (studentsResultLength === 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                var cursor = db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            classTest_id: classTest_id,
                                            status: 1
                                        }
                                    },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$lookup": {
                                            "from": "classTests",
                                            "localField": "classTest_id",
                                            "foreignField": "classTest_id",
                                            "as": "classTests_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$classTests_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "classTest_result_id": "$classTest_result_id",
                                            "subject_name": "$subject_doc.name",
                                            "title": "$classTests_doc.title",
                                            "max_marks": "$classTests_doc.maxMarks",
                                            "marks": "$marks",
                                        }
                                    },
                                    {
                                        $sort: { roll_no: 1 }
                                    }
                                ])
                                cursor.toArray(function (err, result1) {
                                    count++;
                                    if (result1.length > 0) {
                                        studentData.maxMarks = parseInt(result1[0].maxMarks);
                                        studentData.marks = parseInt(result1[0].marks);
                                        studentData.classTest_result_id = result1[0].classTest_result_id;
                                        studentData.subject_name = result1[0].subject_name;
                                        studentData.title = result1[0].title;

                                        // result1[0].first_name = studentData.first_name;
                                        // result1[0].last_name = studentData.last_name;
                                        // result1[0].roll_no = studentData.roll_no;
                                        // result1[0].section_id = studentData.section_id;
                                        // result1[0].maxMarks = parseInt(result1[0].maxMarks);
                                        // result1[0].marks = parseInt(result1[0].marks);
                                        // resultArray.push(result1[0]);
                                    } else {
                                        studentData.maxMarks = '';
                                        studentData.marks = null;
                                        studentData.classTest_result_id = '';
                                        studentData.subject_name = '';
                                        studentData.title = '';

                                        // var doc = {
                                        //     _id: '',
                                        //     student_id: studentData.student_id,
                                        //     first_name: studentData.first_name,
                                        //     last_name: studentData.last_name,
                                        //     roll_no: studentData.roll_no,
                                        //     section_id: studentData.section_id,
                                        //     classTest_result_id: '',
                                        //     subject_name: '',
                                        //     title: '',
                                        //     maxMarks: '',
                                        //     marks: null,
                                        // };
                                        // resultArray.push(doc);
                                    }
                                    if (count === studentsResultLength) {
                                        db.close();
                                        next(null, studentsResult);
                                    }
                                });
                            })
                        }
                    },
                ],
                function (err, result2) {
                    console.log(result2)
                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send({
                            CT_marks: result2
                        });
                    }
                }
            );
        });
    });

router.route('/classTests_by_month/:subject_id/:section_id/:select_month')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        var select_month = parseInt(req.params.select_month);
        var date = new Date();
        var firstDay = 1 + '-' + select_month + '-' + date.getFullYear();
        var lastDay = 1 + '-' + select_month + 1 + '-' + date.getFullYear();
        var studentsMarks = []

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassTestsbyMonth(result, next) {
                        db.collection('classTests').find({
                            subject_id: subject_id,
                            month: select_month
                        }).toArray(function (err, results) {
                            console.log(results)
                            if (err) {
                                next(err, null);
                            }
                            console.log(results)
                            next(null, result, results);
                        });
                    },
                    function getsectionStudentsData(result, results, next) {
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            subject_id: subject_id,
                                            student_id: studentId
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "subjects",
                                            localField: "subject_id",
                                            foreignField: "subject_id",
                                            as: "subjects_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$subjects_doc"
                                    },
                                    {
                                        $lookup: {
                                            from: "classTests",
                                            localField: "classTest_id",
                                            foreignField: "classTest_id",
                                            as: "classTest_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$classTest_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            student_id: "$student_id",
                                            subject_id: "$subject_id",
                                            subject_name: "$subjects_doc.name",
                                            classTest_id: "$classTest_id",
                                            classTest_title: "$classTest_doc.title",
                                            date: "$classTest_doc.date",
                                            maxMarks: "$classTest_doc.maxMarks",
                                            marks: "$marks",
                                        }
                                    }
                                ]).toArray(function (err, result1) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.ClassTests = result1;

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult, results);
                                    }

                                })
                            })
                        }
                    }, function getAttendanceData(result, results, next) {

                        var count = 0;
                        var studentResult = result;
                        var studentsResultLength = result.length;
                        var classTestsResult = results;
                        var classTestsResultLength = results.length;
                        if (studentsResultLength == 0 || classTestsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                sectionAttendence = [];
                                attendenceClass = [];
                                var studentClassTests = [];
                                var studentClassTest = studentData.ClassTests;
                                var studentClassTestsLength = studentClassTest.length;
                                var totalMarks = 0;
                                var totalMaxMarks = 0;
                                var average = 0;
                                var percentage = 0;
                                if (studentClassTestsLength > 0) {
                                    for (i = 0; i < studentClassTestsLength; i++) {
                                        for (j = 0; j < classTestsResultLength; j++) {
                                            if (studentClassTest[i].classTest_id == classTestsResult[j].classTest_id) {
                                                totalMarks += parseFloat(studentClassTest[i].marks);
                                                totalMaxMarks += parseFloat(studentClassTest[i].maxMarks);
                                                var classTest_title = studentClassTest[i].classTest_title;
                                                var date = studentClassTest[i].date;
                                                var maxMarks = studentClassTest[i].maxMarks;
                                                var marks = studentClassTest[i].marks;
                                                var subject_name = studentClassTest[i].subject_name;

                                                studentClassTests.push({ subject_name: subject_name, classTest_title: classTest_title, maxMarks: maxMarks, marks: marks, date: date })
                                            }
                                        }
                                    }
                                    average = parseFloat((totalMarks / studentClassTestsLength));
                                    percentage = Math.round((totalMarks / totalMaxMarks) * 100);
                                }

                                var studentsData = studentData;
                                var student_id = studentData.student_id;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;
                                var section_id = studentData.section_id;
                                count++;
                                studentsMarks.push({ section_id: section_id, student_id: student_id, student_name: studentName, roll_no: roll_no, classTests: studentClassTests, totalMarks: totalMarks, totalMaxMarks: totalMaxMarks, average: average, percentage: percentage })
                                if (studentsResultLength == count) {
                                    var sort_by = function (field, reverse, primer) {

                                        var key = primer ?
                                            function (x) { return primer(x[field]) } :
                                            function (x) { return x[field] };

                                        reverse = !reverse ? 1 : -1;

                                        return function (a, b) {
                                            return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
                                        }
                                    }
                                    studentsMarks = studentsMarks.sort(sort_by('totalMarks', true, parseInt));
                                    next(null, studentsMarks);
                                }
                            });
                        }
                    }
                ],
                function (err, result2) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            classTestsMarks: result2
                        });

                    }
                }
            );
        });
    });

router.route('/classTests_tillDate/:subject_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        // var select_month = parseInt(req.params.select_month);
        // var date = new Date();
        // var firstDay = 1 + '-' + select_month - 1 + '-' + date.getFullYear();
        // var lastDay = 1 + '-' + select_month + '-' + date.getFullYear();
        var studentsMarks = []

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassTestsbyMonth(result, next) {
                        db.collection('classTests').find({
                            subject_id: subject_id,
                        }).toArray(function (err, results) {
                            console.log(results)
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, results);
                        });
                    },
                    function getsectionStudentsData(result, results, next) {
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            subject_id: subject_id,
                                            student_id: studentId
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "subjects",
                                            localField: "subject_id",
                                            foreignField: "subject_id",
                                            as: "subjects_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$subjects_doc"
                                    },
                                    {
                                        $lookup: {
                                            from: "classTests",
                                            localField: "classTest_id",
                                            foreignField: "classTest_id",
                                            as: "classTest_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$classTest_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            student_id: "$student_id",
                                            subject_id: "$subject_id",
                                            subject_name: "$subjects_doc.name",
                                            classTest_id: "$classTest_id",
                                            classTest_title: "$classTest_doc.title",
                                            date: "$classTest_doc.date",
                                            month: "$classTest_doc.month",
                                            maxMarks: "$classTest_doc.maxMarks",
                                            marks: "$marks",
                                        }
                                    }
                                ]).toArray(function (err, result1) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.ClassTests = result1;

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult, results);
                                    }

                                })
                            })
                        }
                    }, function getAttendanceData(result, results, next) {

                        var count = 0;
                        var studentResult = result;
                        var studentsResultLength = result.length;
                        var classTestsResult = results;
                        var classTestsResultLength = results.length;
                        if (studentsResultLength == 0 || classTestsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                sectionAttendence = [];
                                attendenceClass = [];
                                var studentClassTests = studentData.ClassTests;
                                var studentClassTestsLength = studentClassTests.length;
                                var totalMarks = 0;
                                var totalMaxMarks = 0;
                                var average = 0;
                                var percentage = 0;
                                if (studentClassTestsLength > 0) {
                                    for (i = 0; i < studentClassTestsLength; i++) {
                                        for (j = 0; j < classTestsResultLength; j++) {
                                            if (studentClassTests[i].classTest_id == classTestsResult[j].classTest_id) {
                                                var classTest_title = classTestsResult[j].title;
                                                var assigned_date = classTestsResult[j].date;
                                                studentClassTests[i].classTest_title = classTest_title;
                                                studentClassTests[i].assigned_date = assigned_date;
                                            }
                                        }
                                        totalMarks += parseFloat(studentClassTests[i].marks);
                                        totalMaxMarks += parseFloat(studentClassTests[i].maxMarks)
                                        average = parseFloat((totalMarks / studentClassTestsLength));
                                        percentage = Math.round((totalMarks / totalMaxMarks) * 100);
                                    }
                                }

                                var studentsData = studentData;
                                var student_id = studentData.student_id;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;
                                var section_id = studentData.section_id;
                                count++;
                                studentsMarks.push({ section_id: section_id, student_id: student_id, student_name: studentName, roll_no: roll_no, classTests: studentClassTests, totalMarks: totalMarks, totalMaxMarks: totalMaxMarks, average: average, percentage: percentage })
                                if (studentsResultLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
                        }
                    }
                ],
                function (err, result2) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            classTestsMarks: result2
                        });

                    }
                }
            );
        });
    });

router.route('/classTests_tillDate/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionStudents(next) {
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassTestsbyMonth(result, next) {
                        db.collection('subjects').find({
                            section_id: section_id,
                        }).toArray(function (err, subResults) {

                            if (err) {
                                next(err, null);
                            }
                            next(null, result, subResults);
                        });
                    },
                    // function getClassTestsbyMonth(result, subResults, next) {
                    //     var subjectResults = subResults;
                    //     var subjectResultsLength = subResults.length;
                    //     var count = 0;
                    //     if(subjectResultsLength == 0) {
                    //         next(null, [])
                    //     } else {
                    //         subjectResults.forEach(function (subjectData) {
                    //             var subject_id = subjectData.subject_id;

                    //             db.collection('classTests').find({
                    //                 subject_id: subject_id,
                    //             }).toArray(function (err, results) {
                    //                 console.log(results)
                    //                 if (err) {
                    //                     next(err, null);
                    //                 }
                    //                 subjectData.classTests = results
                    //                 count++;
                    //                 if(subjectResultsLength == count) {
                    //                     next(null, result, subjectResults);
                    //                 }
                    //             });
                    //         })
                    //     }
                    // },
                    function getsectionStudentsData(result, subResults, next) {
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        var subjectResults = subResults;
                        var subjectResultsLength = subResults.length;
                        var studentsMarks = []
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {

                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                var student_name = studentData.first_name + ' ' + studentData.last_name;
                                var subjectslist = [];
                                var studentdata = {}
                                var count1 = 0;
                                subjectResults.forEach(function (subjectData) {
                                    var subject_id = subjectData.subject_id;
                                    var totalMarks = 0;
                                    var ctMarks = 0;
                                    var subjectdata = {}
                                    db.collection('CT_marks').aggregate([
                                        {
                                            $match: {
                                                subject_id: subject_id,
                                                student_id: studentId
                                            },
                                        },
                                        {
                                            $lookup: {
                                                from: "subjects",
                                                localField: "subject_id",
                                                foreignField: "subject_id",
                                                as: "subjects_doc"
                                            }
                                        },
                                        {
                                            $unwind: "$subjects_doc"
                                        },
                                        {
                                            $lookup: {
                                                from: "classTests",
                                                localField: "classTest_id",
                                                foreignField: "classTest_id",
                                                as: "classTest_doc"
                                            }
                                        },
                                        {
                                            $unwind: "$classTest_doc"
                                        },
                                        {
                                            $project:
                                            {
                                                section_id: "$section_id",
                                                student_id: "$student_id",
                                                subject_id: "$subject_id",
                                                subject_name: "$subjects_doc.name",
                                                classTest_id: "$classTest_id",
                                                classTest_title: "$classTest_doc.title",
                                                date: "$classTest_doc.date",
                                                month: "$classTest_doc.month",
                                                maxMarks: "$classTest_doc.maxMarks",
                                                marks: "$marks",
                                            }
                                        }
                                    ]).toArray(function (err, result1) {

                                        count1++;
                                        if (err) {
                                            next(err, null);
                                        }
                                        result1.forEach(function (doc) {
                                            totalMarks += doc.maxMarks;
                                            ctMarks += doc.marks;
                                        })
                                        var ctpercentage = ((ctMarks / totalMarks) * 100).toFixed(2);
                                        subjectdata.subject_id = subject_id;
                                        subjectdata.name = subjectData.name;
                                        subjectdata.ClassTests = result1;
                                        subjectdata.totalMarks = totalMarks;
                                        subjectdata.ctMarks = ctMarks;
                                        subjectdata.ctpercentage = ctpercentage;
                                        subjectslist.push(subjectdata);

                                        if (subjectResultsLength == count1) {
                                            studentdata.student_id = studentId;
                                            studentdata.student_name = student_name;
                                            studentdata.subjects = subjectslist
                                        }
                                        studentsMarks.push(studentdata)
                                    })

                                })
                                count++;
                                console.log(count)
                                console.log(studentsMarks)
                                if (studentsResultLength == count) {

                                    next(null, studentsMarks);
                                }

                            })
                        }
                    },
                    // }, function getAttendanceData(result, results, next) {

                    //     var count = 0;
                    //     var studentResult = result;
                    //     var studentsResultLength = result.length;
                    //     var classTestsResult = results;
                    //     var classTestsResultLength = results.length;
                    //     if (studentsResultLength == 0 || classTestsResultLength == 0) {
                    //         next(null, []);
                    //     } else {
                    //         studentResult.forEach(function (studentData) {
                    //             sectionAttendence = [];
                    //             attendenceClass = [];
                    //             var studentClassTests = studentData.ClassTests;
                    //             var studentClassTestsLength = studentClassTests.length;
                    //             var totalMarks = 0;
                    //             var totalMaxMarks = 0;
                    //             var average = 0;
                    //             var percentage = 0;
                    //             if (studentClassTestsLength > 0) {
                    //                 for (i = 0; i < studentClassTestsLength; i++) {
                    //                     for (j = 0; j < classTestsResultLength; j++) {
                    //                         if (studentClassTests[i].classTest_id == classTestsResult[j].classTest_id) {
                    //                             var classTest_title = classTestsResult[j].title;
                    //                             var assigned_date = classTestsResult[j].date;
                    //                             studentClassTests[i].classTest_title = classTest_title;
                    //                             studentClassTests[i].assigned_date = assigned_date;
                    //                         }
                    //                     }
                    //                     totalMarks += parseFloat(studentClassTests[i].marks);
                    //                     totalMaxMarks += parseFloat(studentClassTests[i].maxMarks)
                    //                     average = parseFloat((totalMarks / studentClassTestsLength));
                    //                     percentage = Math.round((totalMarks / totalMaxMarks) * 100);
                    //                 }
                    //             }

                    //             var studentsData = studentData;
                    //             var student_id = studentData.student_id;
                    //             var studentName = studentData.first_name + " " + studentData.last_name;
                    //             var roll_no = studentData.roll_no;
                    //             var section_id = studentData.section_id;
                    //             count++;
                    //             studentsMarks.push({ section_id: section_id, student_id: student_id, student_name: studentName, roll_no: roll_no, classTests: studentClassTests, totalMarks: totalMarks, totalMaxMarks: totalMaxMarks, average: average, percentage: percentage })
                    //             if (studentsResultLength == count) {
                    //                 next(null, studentsMarks);
                    //             }
                    //         });
                    //     }
                    // }
                ],
                function (err, result2) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            classTestsMarks: result2
                        });

                    }
                }
            );
        });
    });

router.route('/all_classTests_marks_by_section_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionStudents(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('students').find({
                            section_id: section_id,
                            status: 1
                        }).sort({roll_no: 1}).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getsectionStudentsData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            section_id: section_id,
                                            status: 1
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "classTests",
                                            localField: "classTest_id",
                                            foreignField: "classTest_id",
                                            as: "classTests_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$classTests_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            subject_id: "$subject_id",
                                            classTest_id: "$classTest_id",
                                            classTest_title: "$classTests_doc.title",
                                            maxMarks: "$classTests_doc.maxMarks",
                                            marks: "$marks"
                                        }
                                    }
                                ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.assessments = results
                                    console.log(studentData)

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getSubjects(result, next) {

                        db.collection('subjects').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, subjectsResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, subjectsResult);
                        });
                    }, function getAttendanceData(result, subjectsResult, next) {

                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;

                        if (studentDataLength == 0) {
                            next(null, []);
                        } else {

                            studentResult.forEach(function (studentData) {

                                var studentsData = studentData;

                                var assessmentsDataLength = studentData.assessments.length;
                                var assessments = studentData.assessments;
                                var student_id = studentData.student_id;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;

                                if (assessmentsDataLength == 0) {
                                    count++;

                                } else {
                                    var subjectlist = [];

                                    subjectsArray.forEach(function (subjectData) {
                                        var subject_id = subjectData.subject_id;
                                        var subject_name = subjectData.name;
                                        var subjectMarks = 0;
                                        var subjectmaxMarks = 0;

                                        var classtests = [];
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;

                                        for (j = 0; j < assessmentsDataLength; j++) {

                                            if (subject_id == assessments[j].subject_id) {
                                                //  console.log("hema");
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                classTest_title = assessments[j].classTest_title;
                                                totalMarks += marks;
                                                totalmaxMarks += maxMarks;
                                                count1++

                                                classtests.push({ classTest_title: classTest_title, marks: marks, maxMarks: maxMarks })

                                            }
                                        }

                                        if (classtests.length > 0) {
                                            var percentage = parseInt((totalMarks / totalmaxMarks) * 100);
                                            var average = parseInt(totalMarks) / parseInt(count1);

                                        } else {
                                            var percentage = 0;
                                            var average = 'N/A';
                                        }

                                        if (percentage > 90 && percentage <= 100) {
                                            var grade = 'Excellent';
                                        } else if (percentage > 70 && percentage <= 90) {
                                            var grade = 'Good';
                                        } else if (percentage > 40 && percentage <= 70) {
                                            var grade = 'Average';
                                        } else if (percentage >= 0 && percentage <= 40) {
                                            var grade = 'Bad';
                                        }
                                        subjectlist.push({ subject_id: subject_id, subject_name: subject_name, classtests: classtests, subjectMarks: totalMarks, subjectmaxMarks: totalmaxMarks, average: average, subjectpercentage: percentage, grade: grade, totalclasstests: count1 })
                                    })
                                    count++;
                                }
                                studentsMarks.push({ student_id: student_id, student_name: studentName, roll_no: roll_no, subjects: subjectlist })
                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
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

                        res.send({
                            students: result1
                        });

                    }
                }
            );
        });
    });

router.route('/all_classtest_marks_by_student_id/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getsectionStudentsData(next) {
                        db.collection('CT_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                    status: 1
                                },
                            },
                            {
                                $lookup: {
                                    from: "students",
                                    localField: "student_id",
                                    foreignField: "student_id",
                                    as: "students_doc"
                                }
                            },
                            {
                                $unwind: "$students_doc"
                            },
                            {
                                $lookup: {
                                    from: "classTests",
                                    localField: "classTest_id",
                                    foreignField: "classTest_id",
                                    as: "classTests_doc"
                                }
                            },
                            {
                                $unwind: "$classTests_doc"
                            },
                            {
                                $lookup: {
                                    from: "coursework",
                                    localField: "classTests_doc.lession_id",
                                    foreignField: "lession_id",
                                    as: "coursework_doc"
                                }
                            },
                            {
                                $unwind: "$coursework_doc"
                            },
                            {
                                $project:
                                {
                                    first_name: "$students_doc.first_name",
                                    last_name: "$students_doc.last_name",
                                    section_id: "$section_id",
                                    subject_id: "$subject_id",
                                    lession_id: "$classTests_doc.lession_id",
                                    chapter: "$coursework_doc.title",
                                    title: "$classTests_doc.title",
                                    maxMarks: "$classTests_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$classTests_doc.average_marks",
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        })
                    },
                    function getSubjects(results, next) {
                        db.collection('subjects').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "coursework",
                                    localField: "subject_id",
                                    foreignField: "subject_id",
                                    as: "coursework_doc"
                                }
                            },
                            {
                                $project:
                                {
                                    section_id: "$section_id",
                                    subject_id: "$subject_id",
                                    name: "$name",
                                    chapters: "$coursework_doc",
                                }
                            }
                        ]).toArray(function (err, subjectsResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results, subjectsResult);
                        });
                    },
                    function getAttendanceData(results, subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;

                        var assessmentsDataLength = results.length;
                        var assessments = results;

                        if (assessmentsDataLength === 0) {
                            next(null, [])
                        } else {
                            var subjects = [];
                            subjectsArray.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var subject_name = subjectData.name;
                                var chaptersArray = subjectData.chapters;
                                var chaptersArrayLength = chaptersArray.length;
                                var chapters = [];
                                var subjectMarks = 0;
                                var subjectmaxMarks = 0;

                                if (chaptersArrayLength > 0) {
                                    for (i = 0; i < chaptersArrayLength; i++) {
                                        var lessionId = chaptersArray[i].lession_id;
                                        var title = chaptersArray[i].title;
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;
                                        var classtests = [];
                                        for (j = 0; j < assessmentsDataLength; j++) {
                                            if (lessionId == assessments[j].lession_id) {
                                                var marks = parseInt(assessments[j].marks);
                                                var maxMarks = parseInt(assessments[j].maxMarks);
                                                var classtest_title = assessments[j].title;
                                                var average_marks = assessments[j].average_marks;
                                                totalMarks += marks;
                                                totalmaxMarks += maxMarks;
                                                count1++
                                                classtests.push({ title: classtest_title, marks: marks, average_marks: average_marks })

                                            }
                                        }
                                        if (classtests.length > 0) {
                                            var percentage = ((totalMarks / totalmaxMarks) * 100).toFixed(2);
                                            var average = parseInt(totalMarks) / parseInt(count1);
                                        } else {
                                            var percentage = 0;
                                            var average = 0;
                                        }
                                        chapters.push({ lession_id: lessionId, title: title, classtests: classtests, totalMarks: totalMarks, average: average, percentage: percentage, totalAssessments: count1 })
                                        subjectMarks += totalMarks;
                                        subjectmaxMarks += totalmaxMarks;
                                    }
                                }
                                count++;
                                var subjectpercentage = ((subjectMarks / subjectmaxMarks) * 100).toFixed(2);
                                if (subjectpercentage > 90 && subjectpercentage <= 100) {
                                    var grade = 'Excellent';
                                } else if (subjectpercentage > 70 && subjectpercentage <= 90) {
                                    var grade = 'Good';
                                } else if (subjectpercentage > 40 && subjectpercentage <= 70) {
                                    var grade = 'Average';
                                } else if (subjectpercentage >= 0 && subjectpercentage <= 40) {
                                    var grade = 'Bad';
                                } else {
                                    var subjectpercentage = 0;
                                    var grade = 'N/A';
                                }
                                subjects.push({ subject_id: subject_id, subject_name: subject_name, chapters: chapters, subjectMarks: subjectMarks, subjectmaxMarks: subjectmaxMarks, subjectpercentage: subjectpercentage, grade: grade })

                                if (count === subjectsArrayLength) {
                                    studentsMarks.push({ student_id: student_id, student_name: results[0].first_name + ' ' + results[0].last_name, subjects: subjects })
                                    next(null, studentsMarks);
                                }
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
                        res.send({
                            students: result1
                        });
                    }
                }
            );
        });
    });

router.route('/all_classtest_marks_by_student_id/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSubjects(next) {
                        db.collection('subjects').find({
                            section_id: section_id
                        }).toArray(function (err, subjectsResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, subjectsResult);
                        });
                    },
                    function getChapters(subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;
                        if (subjectsArrayLength == 0) {
                            next(null, result, subjectsResult);
                        } else {
                            subjectsArray.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                db.collection('coursework').find({
                                    subject_id: subject_id,
                                    status: 1
                                }).toArray(function (err, chaptersResult) {
                                    if (err) {
                                        next(err, null);
                                    }
                                    count++;
                                    subjectData.chapters = chaptersResult;
                                    if (count == subjectsArrayLength) {
                                        next(null, subjectsResult);
                                    }
                                });
                            })
                        }
                    },
                    function getsectionStudentsData(subjectsResult, next) {
                        db.collection('CT_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "classTests",
                                    localField: "classTest_id",
                                    foreignField: "classTest_id",
                                    as: "classTests_doc"
                                }
                            },
                            {
                                $unwind: "$classTests_doc"
                            },
                            {
                                $lookup: {
                                    from: "coursework",
                                    localField: "lession_id",
                                    foreignField: "lession_id",
                                    as: "coursework_doc"
                                }
                            },
                            {
                                $unwind: "$coursework_doc"
                            },
                            {
                                $project:
                                {
                                    section_id: "$section_id",
                                    subject_id: "$subject_id",
                                    lession_id: "$lession_id",
                                    chapter: "$coursework_doc.title",
                                    title: "$classTests_doc.title",
                                    maxMarks: "$classTests_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$classTests_doc.average_marks",
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            studentsResult = results
                            next(null, studentsResult, subjectsResult);
                        })
                    },
                    function getAssessments(result, subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;

                        if (subjectsArrayLength === 0) {
                            next(null, [])
                        } else {
                            subjectsArray.forEach(function (subjectData) {
                                var subjectId = subjectData.subject_id;
                                var chapters = [];
                                var chaptersArray = subjectData.chapters;
                                for (i = 0; i < chaptersArray.length; i++) {
                                    var lessionId = chaptersArray[i].lession_id;
                                    for (j = 0; j < result.length; j++) {
                                        var lession_id = result[j].lession_id;
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;
                                        var classtests = [];
                                        if (lessionId === lession_id) {
                                            var marks = parseInt(assessments[j].marks);
                                            var maxMarks = parseInt(assessments[j].maxMarks);
                                            var title = assessments[j].title;
                                            var average_marks = assessments[j].average_marks;
                                            totalMarks += marks;
                                            totalmaxMarks += maxMarks;
                                            count1++
                                            classtests.push({ title: title, marks: marks, average_marks: average_marks })
                                        }
                                        if (j === (result.length - 1)) {
                                            if (classtests.length > 0) {
                                                var percentage = ((totalMarks / totalmaxMarks) * 100).toFixed(2);
                                                var average = parseInt(totalMarks) / parseInt(count1);
                                            } else {
                                                var percentage = 0;
                                                var average = 0;
                                            }
                                            subjectMarks += totalMarks;
                                            subjectmaxMarks += totalmaxMarks;
                                            chapters.push({ lession_id: lessionId, title: title, classtests: classtests, totalMarks: totalMarks, average: average, percentage: percentage, totalAssessments: count1 })
                                        }
                                    }
                                    if (i === (chaptersArrayLength - 1)) {
                                        if (subjectMarks === 0 || subjectmaxMarks === 0) {
                                            var subjectpercentage = 0;
                                            var grade = 'N/A';
                                        } else {
                                            var subjectpercentage = ((subjectMarks / subjectmaxMarks) * 100).toFixed(2);
                                        }
                                        if (subjectpercentage > 90 && subjectpercentage <= 100) {
                                            var grade = 'Excellent';
                                        } else if (subjectpercentage > 70 && subjectpercentage <= 90) {
                                            var grade = 'Good';
                                        } else if (subjectpercentage > 40 && subjectpercentage <= 70) {
                                            var grade = 'Average';
                                        } else if (subjectpercentage >= 0 && subjectpercentage <= 40) {
                                            var grade = 'Bad';
                                        }
                                        subjects.push({ subject_id: subject_id, subject_name: subject_name, chapters: chapters, subjectMarks: subjectMarks, subjectmaxMarks: subjectmaxMarks, subjectpercentage: subjectpercentage, grade: grade })
                                    }
                                }
                                count++;
                                if (count === subjectsArrayLength) {
                                    studentsMarks.push({ student_id: student_id, student_name: studentName, subjects: subjects })
                                    next(null, studentsMarks);
                                }
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
                        res.send({
                            students: result1
                        });
                    }
                }
            );
        });
    });

router.route('/student_CT_marks/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('CT_marks').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
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
                        "from": "subjects",
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "subject_doc"
                    }
                },
                {
                    "$unwind": "$subject_doc"
                },
                {
                    "$lookup": {
                        "from": "classTests",
                        "localField": "classTest_id",
                        "foreignField": "classTest_id",
                        "as": "classTests_doc"
                    }
                },
                {
                    "$unwind": "$classTests_doc"
                },
                // {
                //     "$lookup": {
                //         "from": "coursework",
                //         "localField": "lession_id",
                //         "foreignField": "lession_id",
                //         "as": "lession_doc"
                //     }
                // },
                // {
                //     "$unwind": "$lession_doc"
                // },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$student_doc.first_name",
                        "last_name": "$student_doc.last_name",
                        "date": "$classTests_doc.date",
                        "subject_name": "$subject_doc.name",
                        "title": "$classTests_doc.title",
                        "marks": "$marks",
                        "maxMarks": "$classTests_doc.maxMarks",
                    }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    CT_marks: resultArray
                });
            });
        });
    });

router.route('/student_CT_marksPercentage/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('CT_marks').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
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
                        "from": "subjects",
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "subject_doc"
                    }
                },
                {
                    "$unwind": "$subject_doc"
                },
                {
                    "$lookup": {
                        "from": "classTests",
                        "localField": "classTest_id",
                        "foreignField": "classTest_id",
                        "as": "classTests_doc"
                    }
                },
                {
                    "$unwind": "$classTests_doc"
                },
                // {
                //     "$lookup": {
                //         "from": "coursework",
                //         "localField": "lession_id",
                //         "foreignField": "lession_id",
                //         "as": "lession_doc"
                //     }
                // },
                // {
                //     "$unwind": "$lession_doc"
                // },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$student_doc.first_name",
                        "last_name": "$student_doc.last_name",
                        // "chapter_name": "$lession_doc.title",
                        "subject_name": "$subject_doc.name",
                        "title": "$classTests_doc.title",
                        "maxMarks": "$classTests_doc.maxMarks",
                        "marks": "$marks",
                    }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    CT_marks: resultArray
                });
            });
        });
    });

router.route('/student_classTest/:date/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        //   var student_id = req.params.student_id;
        var date = req.params.date;
        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionSubject(next) {
                        db.collection('subjects').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionSubjectsData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;

                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        var Subject_assignments = [];
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                // console.log(subject_id);
                                db.collection('classTests').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            subject_id: subject_id,
                                            date: date,
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "subjects",
                                            localField: "subject_id",
                                            foreignField: "subject_id",
                                            as: "subject_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$subject_doc"
                                    },
                                    {
                                        $lookup: {
                                            from: "coursework",
                                            localField: "lession_id",
                                            foreignField: "lession_id",
                                            as: "coursework_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$coursework_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            subject_id: "$subjectId",
                                            subject: "$subject_doc.name",
                                            classTest_id: "$classTest_id",
                                            title: "$title",
                                            chapter_name: "$coursework_doc.title",
                                            date: "$date"
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    subjectData.classTests = results;

                                    if (subjectsResultLength == count) {

                                        next(null, result);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getSectionSubjectsData(result, next) {
                        //   console.log(studentResult);
                        //   console.log(result);
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        var subjects = [];
                        var resultArray = [];
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var date = date;
                                subjectName = subjectData.name;
                                subjectclassTests = subjectData.classTests;
                                var classTests = [];

                                if (subjectclassTests.length > 0) {
                                    for (i = 0; i < subjectclassTests.length; i++) {
                                        title = subjectclassTests[i].title;
                                        date = subjectclassTests[i].date;
                                        classTest_id = subjectclassTests[i].classTest_id;
                                        classTests.push({ classTest_id: classTest_id, title: title, date: date })


                                    }
                                }
                                subjects.push({ subjectName: subjectName, classTests: classTests });
                                count++;


                                if (count == subjectsResult.length) {
                                    resultArray.push({ subjects: subjects })

                                    next(null, resultArray)
                                }

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

                        res.send({
                            daily_CT: result1
                        });

                    }
                }
            );
        });
    });

//  Modified
// Assignments bulk upload via excel sheet

var storage = multer.diskStorage({ //multers disk storage settings
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
    }
});

var upload = multer({ //multer settings
    storage: storage,
    fileFilter: function (req, file, callback) { //file filter
        if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

router.route('/bulk_upload_classTests/:section_id/:lession_id')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
        var lession_id = req.params.lession_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var status = 1;
        var exceltojson;
        upload(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            /** Check the extension of the incoming file and 
             *  use the appropriate module
             */
            if (req.file.originalname.split('.')[req.file.originalname.split('.').length - 1] === 'xlsx') {
                exceltojson = xlsxtojson;
            } else {
                exceltojson = xlstojson;
            }
            //  console.log(req.file.path);
            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    res.json({ data: result });
                    // console.log(result[0]);
                    var test = result;
                    var count = 0;

                    if (test.length > 0) {
                        test.forEach(function (key, value) {

                            var item = {
                                classTest_id: 'getauto',
                                section_id: section_id,
                                lession_id: lession_id,
                                school_id: school_id,
                                chapter_name: key.chaptername,
                                title: key.title,
                                subject_name: key.subjectname,
                                date: key.date,
                                status: status
                            };
                            mongo.connect(url, function (err, db) {
                                autoIncrement.getNextSequence(db, 'classTests', function (err, autoIndex) {

                                    var collection = db.collection('classTests');
                                    collection.ensureIndex({
                                        "classTest_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.section_id == null || item.title == null) {
                                            res.end('null');
                                        } else {
                                            item.classTest_id = subject_id + 'CT-' + autoIndex;
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

                                                if (count == test.length) {
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


                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

router.route('/edit_classTests_marks/:classTest_result_id')
    .put(function (req, res, next) {
        var classTest_result_id = req.params.classTest_result_id;
        var myquery = { classTest_result_id: req.params.classTest_result_id };
        var splited = classTest_result_id.split('-');
        var classTest_id = splited[1] + '-' + splited[2] + '-' + splited[3] + '-' + splited[4] + '-' + splited[5];
        var req_marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            db.collection('CT_marks').find({classTest_id: classTest_id}).toArray(function (err, resultArray) {
                if(err) {
                    res.send('false')
                } else {
                    var total_marks = req_marks;
                    var resultArrayLength = resultArray.length;
                    resultArray.forEach(function (doc) {
                        if(doc.classTest_result_id !== classTest_result_id) {
                            total_marks += doc.marks;
                        }
                    })
                    var average_marks = parseInt(total_marks) / resultArrayLength;
                    db.collection('CT_marks').update(myquery, {
                        $set: {
                            marks: req_marks
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        } else {
                            db.collection('classTests').update({classTest_id: classTest_id}, {
                                $set: {
                                    average_marks: average_marks
                                }
                            }, function(err, result2) {
                                if(err) {
                                    res.send('false')
                                } else {
                                    db.close();
                                    res.send('true');
                                }
                            })
                        }
                    });
                }
            })
        });
    });

router.route('/add_classTests_marks/:classTest_id/:school_id')
    .put(function (req, res, next) {
        var classTest_id = req.params.classTest_id;
        var school_id = req.params.school_id;
        var student_id = req.body.student_id;
        var subject_id = req.body.subject_id;
        var section_id = req.body.section_id;
        var lession_id = req.body.lession_id;
        var marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            var item = {
                classTest_result_id: '',
                student_id: student_id,
                subject_id: subject_id,
                section_id: section_id,
                lession_id: lession_id,
                school_id: school_id,
                classTest_id: classTest_id,
                marks: parseInt(marks),
                status: 1
            };
            console.log(item)
            autoIncrement.getNextSequence(db, 'CT_marks', function (err, autoIndex) {
                var data = db.collection('CT_marks').find({
                    section_id: section_id,
                    classTest_id: classTest_id,
                    student_id: item.student_id
                }).count(function (e, triggerCount) {
                    if (triggerCount > 0) {
                        res.send('false');
                    } else {
                        var collection = db.collection('CT_marks');
                        collection.ensureIndex({
                            "classTest_result_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.subject_id == null || item.section_id == null || item.classTest_id == null || item.marks == null) {
                                res.end('null');
                            } else {
                                collection.find({ classTest_id: classTest_id }).count(function (err, triggerCount1) {
                                    var id = triggerCount1 + 1;
                                    item.classTest_result_id = item.student_id + '-' + item.classTest_id + '-M' + id;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                            db.close();
                                            res.end('false');
                                        } else {
                                            db.collection('CT_marks').find({ classTest_id: classTest_id }).toArray(function (err, resultArray) {
                                                if (err) {
                                                    res.send('false')
                                                } else {
                                                    var total_marks = 0;
                                                    var resultArrayLength = resultArray.length;
                                                    resultArray.forEach(function (doc) {
                                                        total_marks += doc.marks;
                                                    })
                                                    var average_marks = parseInt(total_marks) / resultArrayLength;
                                                    db.collection('classTests').update({ classTest_id: classTest_id }, {
                                                        $set: {
                                                            average_marks: average_marks
                                                        }
                                                    }, function (err, result2) {
                                                        if (err) {
                                                            res.send('false')
                                                        } else {
                                                            db.close();
                                                            res.send('true');
                                                        }
                                                    })
                                                }
                                            })
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

router.route('/delete_classTests_marks/:classTest_result_id')
    .delete(function (req, res, next) {
        var myquery = { classTest_result_id: req.params.classTest_result_id };

        mongo.connect(url, function (err, db) {
            db.collection('CT_marks').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/CT_marks_by_chapter_id/:subject_id/:lession_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var lession_id = req.params.lession_id;
        var studentsMarks = []


        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionStudents(next) {
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getsectionStudentsData(result, next) {
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {

                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            subject_id: subject_id,
                                            section_id: section_id,
                                            student_id: studentId,
                                            lession_id: lession_id
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "classTests",
                                            localField: "classTest_id",
                                            foreignField: "classTest_id",
                                            as: "classTests_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$classTests_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            student_id: "$student_id",
                                            subject_id: "$subjectId",
                                            lession_id: "$lession_id",
                                            assignment_id: "$classTest_id",
                                            title: "$classTests_doc.title",
                                            marks: "$marks",
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.assessments = results

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult);
                                    }

                                })
                            })
                        }
                    }, function getAttendanceData(result, next) {

                        var count = 0;
                        var studentResult = result;
                        var studentDataLength = result.length;
                        if (studentDataLength == 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                sectionAttendence = [];
                                attendenceClass = [];

                                var studentsData = studentData;

                                var assessmentsDataLength = studentData.assessments.length;
                                var student_id = studentData.student_id;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;
                                count++;
                                studentsMarks.push({ student_id: student_id, student_name: studentName, roll_no: roll_no, assessments: studentData.assessments })

                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
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

                        res.send({
                            students: result1
                        });

                    }
                }
            );
        });
    });

router.route('/all_CT_marks_by_subject_id/:subject_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var studentsMarks = [];


        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionStudents(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getsectionStudentsData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            section_id: section_id,
                                            subject_id: subject_id
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "classTests",
                                            localField: "classTest_id",
                                            foreignField: "classTest_id",
                                            as: "classTests_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$classTests_doc"
                                    },
                                    {
                                        $lookup: {
                                            from: "coursework",
                                            localField: "lession_id",
                                            foreignField: "lession_id",
                                            as: "coursework_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$coursework_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            subject_id: "$subjectId",
                                            lession_id: "$lession_id",
                                            chapter: "$coursework_doc.title",
                                            assignment_id: "$assignment_id",
                                            assignment_title: "$assignments_doc.assignment_title",
                                            marks: "$marks"
                                        }
                                    }
                                ]).sort({ lession_id: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.assessments = results
                                    console.log(studentData)

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getChapters(result, next) {

                        var data = db.collection('coursework').find({
                            subject_id: subject_id
                        }).toArray(function (err, chaptersResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, result, chaptersResult);
                        });
                    }, function getAttendanceData(result, chaptersResult, next) {

                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        var chaptersArray = chaptersResult;
                        var chaptersArrayLength = chaptersArray.length;

                        if (studentDataLength == 0) {
                            next(null, []);
                        } else {

                            studentResult.forEach(function (studentData) {

                                var studentsData = studentData;

                                var assessmentsDataLength = studentData.assessments.length;
                                var assessments = studentData.assessments;
                                var student_id = studentData.student_id;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;


                                if (assessmentsDataLength == 0) {
                                    count++;

                                } else {
                                    var CT_marks = [];

                                    for (i = 0; i < chaptersArrayLength; i++) {

                                        var Chapters = [];
                                        lessionId = chaptersArray[i].lession_id;
                                        chapter_name = chaptersArray[i].title;
                                        var totalMarks = 0;
                                        var count1 = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {


                                            if (lessionId == assessments[j].lession_id) {
                                                //  console.log("hema");
                                                marks = parseInt(assessments[j].marks);
                                                title = assessments[j].title;
                                                totalMarks += marks;
                                                count1++

                                                Chapters.push({ title: title, marks: marks })

                                            }
                                            percentage = parseInt(totalMarks) / parseInt(count1);
                                        }
                                        CT_marks.push({ lession_id: lessionId, chapter_name: chapter_name, Chapters: Chapters, totalMarks: totalMarks, percentage: percentage })
                                    }

                                    count++;
                                }
                                // count++;
                                studentsMarks.push({ student_id: student_id, student_name: studentName, assignment_marks: assignment_marks })



                                // classAttendance.push(attendanceSection);

                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
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

                        res.send({
                            students: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_CT_marks_by_chapter_id/:student_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var subject_id = req.params.subject_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getsectionStudentsData(next) {

                        db.collection('CT_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                    subject_id: subject_id
                                },
                            },
                            {
                                $lookup: {
                                    from: "subjects",
                                    localField: "subject_id",
                                    foreignField: "subject_id",
                                    as: "subject_doc"
                                }
                            },
                            {
                                $unwind: "$subject_doc"
                            },
                            {
                                $lookup: {
                                    from: "students",
                                    localField: "student_id",
                                    foreignField: "student_id",
                                    as: "student_doc"
                                }
                            },
                            {
                                $unwind: "$student_doc"
                            },
                            {
                                $lookup: {
                                    from: "classTests",
                                    localField: "classTest_id",
                                    foreignField: "classTest_id",
                                    as: "classTests_doc"
                                }
                            },
                            {
                                $unwind: "$classTests_doc"
                            },
                            {
                                $project:
                                {
                                    section_id: "$section_id",
                                    student_id: "$student_id",
                                    student_name: "$student_doc.first_name",
                                    lession_id: "$classTests_doc.lession_id",
                                    subject_id: "$subject_id",
                                    subject: "$subject_doc.name",
                                    // chapter_name: "$classTests_doc.title",
                                    classTest_id: "$classTest_id",
                                    marks: "$marks"
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, results) {

                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        })
                    },
                    function getChapters(results, next) {

                        var data = db.collection('coursework').find({
                            subject_id: subject_id
                        }).toArray(function (err, chaptersResult) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, results, chaptersResult);
                        });
                    }, function getAttendanceData(results, chaptersResult, next) {

                        var count = 0;

                        var classTestsResult = results;
                        var classTestsResultLength = results.length;
                        var chaptersArray = chaptersResult;
                        var chaptersArrayLength = chaptersArray.length;
                        var student_id = classTestsResult[0].student_id;
                        var student_name = classTestsResult[0].student_name;
                        var subject_id = classTestsResult[0].subject_id;
                        var subject = classTestsResult[0].subject;

                        if (chaptersArrayLength == 0) {
                            next(null, []);
                        } else {
                            var chapter_marks = [];
                            chaptersArray.forEach(function (chapterData) {

                                var chaptersData = chapterData;
                                var chapter_name = chapterData.title;
                                var chapter_id = chapterData.lession_id;

                                for (i = 0; i < classTestsResultLength; i++) {

                                    var count1 = 0;
                                    var classTests = [];

                                    var totalMarks = 0;
                                    var percentage = 0;

                                    chapter = classTestsResult[i].chapter_name;
                                    lession_id = classTestsResult[i].lession_id;

                                    if (chapter_id == lession_id) {

                                        marks = parseInt(classTestsResult[i].marks);
                                        classTest_id = classTestsResult[i].classTest_id;
                                        totalMarks += marks;
                                        classTests.push({ classTest_id: classTest_id, marks: marks })
                                        count1++;
                                        percentage = (totalMarks / parseInt(count1));
                                        chapter_marks.push({ chapter_name: chapter_name, lession_id: lession_id, classTests: classTests, totalMarks: totalMarks, percentage: percentage })
                                    }
                                }

                                count++;

                                if (chaptersArrayLength == count) {
                                    studentsMarks.push({ student_id: student_id, student_name: student_name, subject_id: subject_id, subject: subject, chapter_marks: chapter_marks })
                                    next(null, studentsMarks);
                                }
                            });
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

                        res.send({
                            students: result1
                        });

                    }
                }
            );
        });
    });

router.route('/edit_classtest/:school_id')
    .put(function (req, res, next) {
        var myquery = { school_id: req.params.school_id };

        mongo.connect(url, function (err, db) {
            db.collection('classTests').updateMany(myquery, {
                $set: {
                    average_score: 0,
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

router.route('/edit_projectwork/:school_id')
    .put(function (req, res, next) {
        var myquery = { school_id: req.params.school_id };

        mongo.connect(url, function (err, db) {
            db.collection('projectworks').updateMany(myquery, {
                $set: {
                    average_score: 0,
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

module.exports = router;