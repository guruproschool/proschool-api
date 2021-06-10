// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;
var url1 = config.loginUrl;

// Add Teachers

router.route('/teachers/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        subjects = [];

        var item = {
            teacher_id: 'getauto',
            school_id: school_id,
            employee_id: req.body.employee_id,
            added_on: req.body.added_on,
            status: status,
        };
        var subjects = {
            subject_id: req.body.subject_id,
            subject_name: req.body.subject_name
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'teacher_subjects', function (err, autoIndex) {
                var collection = db.collection('teacher_subjects');
                collection.ensureIndex({
                    "teacher_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.school_id == null || item.employee_id == null || subjects.subject_name == null) {
                        res.end('null');
                    } else {
                        collection.find({ school_id: school_id }).count(function (err, triggerCount) {
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
                                        teacher_id: school_id + '-TE' + id
                                    },
                                    $push: {
                                        subjects
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

    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('teachers').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    teachers: resultArray
                });
            });
        });
    });

router.route('/teacherslistbyschoolid/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var job_category = "teaching";
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').aggregate([
                { $match: { school_id: school_id, job_category: job_category, status: 1 } },
                {
                    "$project": {
                        "employee_id": "$employee_id",
                        "teacher_name": "$first_name"
                    }
                }
                // {
                //     $group: {
                //         _id: '$school_id', teacher_names: { $push: '$first_name' }
                //     }
                // }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    teachers: resultArray
                });
            });
        });
    });

router.route('/addorupdatesubjectstoteacher/:school_id/:section_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var teacher_id = req.body.teacher_id;
        var subject_id = req.body.subject_id;
        var section_id = req.params.section_id;
        var splited = section_id.split('-');
        console.log(req.body.teacher_id)
        var class_id = splited[0] + '-' + splited[1];

        var subjects = [];
        var item = {
            teacher_subject_id: 'getauto',
            school_id: school_id,
            teacher_id: req.body.teacher_id,
            status: status,
        };
        subjects = {
            section_id: section_id,
            subject_id: req.body.subject_id,
            teacher_id: teacher_id,
            class_id: class_id,
        };

        mongo.connect(url, function (err, db) {
            var collection = db.collection('teacher_subjects');

            collection.find({
                "teacher_id": teacher_id
            }).toArray(function (err, results) {
                if (err) {
                    res.send('false1')
                }

                if (results.length == 0) {
                    autoIncrement.getNextSequence(db, 'teacher_subjects', function (err, autoIndex) {
                        collection.ensureIndex({
                            "teacher_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.school_id == null || item.teacher_id == null || subjects.section_id == null) {
                                res.end('null');
                            } else {
                                collection.find({ school_id: school_id }).count(function (err, triggerCount) {
                                    var id = triggerCount + 1;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            if (err.code == 11000) {
                                                res.end('false2');
                                            }
                                            res.end('false3');
                                        }
                                        collection.update({
                                            _id: item._id
                                        }, {
                                            $set: {
                                                teacher_subject_id: school_id + '-TE' + id,
                                            },
                                            $push: {
                                                subjects
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
                } else {
                    collection.update({
                        "teacher_id": teacher_id
                    }, {
                        "$addToSet": {
                            "subjects": {
                                subject_id: req.body.subject_id,
                                section_id: section_id,
                                teacher_id: teacher_id,
                                class_id: class_id,
                            }
                        }
                    },
                        function (err, numAffected) {
                            if (err) {
                                res.send('false4')
                            }

                            if (numAffected.result.nModified == 1) {
                                res.send('true')
                            } else {
                                res.send('false5')
                            }
                        });
                }
            });
        });
    });

// delete subjects from teacher
router.route('/deleteassignedsubjects/:subject_id/:teacher_id')
    .put(function (req, res, next) {
        var teacher_id = req.params.teacher_id;
        var subject_id = req.params.subject_id;
        mongo.connect(url, function (err, db) {
            var collection = db.collection('teacher_subjects');

            collection.update({
                "teacher_id": teacher_id
            }, {
                "$pull": {
                    "subjects": {
                        subject_id: subject_id

                    }
                }
            },
                function (err, numAffected) {
                    if (numAffected.result.nModified == 1) {
                        db.close();
                        res.send('true')
                    } else {
                        db.close();
                        res.send('false')

                    }
                });

        });
    });

// List assigined subjects to teachers by school id 
router.route('/listsubjectstoteacher/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        //var employee_id = req.body.employee_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('teacher_subjects').aggregate([
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "teacher_id",
                        "foreignField": "employee_id",
                        "as": "teacher_doc"
                    }
                },
                {
                    "$unwind": "$teacher_doc"
                },
                {
                    "$unwind": "$subjects"
                },
                {
                    "$lookup": {
                        "from": "subjects",
                        "localField": "subjects.subject_id",
                        "foreignField": "subject_id",
                        "as": "subjects_doc"
                    }
                },
                {
                    "$unwind": "$subjects_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "teacher_id": "$teacher_id",
                        "teacher_name": "$teacher_doc.first_name",
                        "school_id": "$school_id",
                        "employee_id": "$employee_id",
                        "teacher_subject_id": "$teacher_subject_id",
                        "teacher_id": "$teacher_id",
                        "subject_id": "$subjects_doc.subject_id",
                        "subject_id": "$subjects.subject_id",
                        "subjects": [{
                            "subjects": "$subjects_doc.name"

                        }]

                    }
                }
            ]);

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    teachers: resultArray
                });
            });
        });
    });

router.route('/teacher_schedule/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var resultArray = [];
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
        var current_date = year + '-' + month + '-' + day;

        var weekday = [];
        weekday[0] = "sunday";
        weekday[1] = "monday";
        weekday[2] = "tuesday";
        weekday[3] = "wednesday";
        weekday[4] = "thursday";
        weekday[5] = "friday";
        weekday[6] = "saturday";

        var Day = weekday[d.getDay()];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getTimetable(next) {
                        db.collection('timetable').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id,
                                    day: Day,
                                    status: 1
                                },
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
                                $project:
                                {
                                    "id": "$timetable_id",
                                    "type": "Timetable",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                    "class": "$class_doc.name",
                                    "section": "$section_doc.name",
                                    "schedule": "$subject_doc.name",
                                }
                            }
                        ]).sort({start_time: 1}).forEach(function (doc, err) {
                            assert.equal(null, err);
                            doc.venue = doc.class + ' ' + doc.section;
                            delete doc.class;
                            delete doc.section;
                            // delete doc.subject;
                            resultArray.push(doc)
                        }, function () {
                            next(null, resultArray);
                        })
                    },
                    function getEvents(results, next) {

                        var cursor = db.collection('schoolevents').aggregate([
                            {
                                $match: {
                                    employees: { $elemMatch: { attendee: employee_id } },
                                    date: current_date,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                {
                                    "id": "$school_event_id",
                                    "type": "Event",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                    "schedule": "$event_title",
                                }
                            }
                        ]);
                        cursor.forEach(function (doc, err) {
                            console.log(doc)
                            doc.venue = "";
                            assert.equal(null, err);
                            resultArray.push(doc)
                        }, function () {
                            next(null, resultArray);
                        })
                    },
                    function getSchedule(results, next) {
                        var count = 0;
                        var scheduleResult = results;
                        var scheduleResultLength = results.length;
                        console.log(scheduleResult)
                        if (scheduleResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in scheduleResult) {
                                lookupObject[scheduleResult[i]["start_time"]] = scheduleResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
                        }
                    }
                ],
                function (err, newArray) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send(newArray);

                    }
                }
            );
        });
    });

router.route('/student_assessment_marks_by_subject_id/:student_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var subject_id = req.params.subject_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getStudentMarksData(next) {

                        db.collection('assessment_evaluation').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                    subjectId: subject_id
                                },
                            },
                            {
                                $lookup: {
                                    from: "subjects",
                                    localField: "subjectId",
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
                                $project:
                                {
                                    section_id: "$section_id",
                                    student_id: "$student_id",
                                    student_name: "$student_doc.first_name",
                                    subject_id: "$subjectId",
                                    subject: "$subject_doc.name",
                                    exam_title: "$exam_title",
                                    assessment_id: "$assessment_id",
                                    maxMarks: "$maxMarks",
                                    marks: "$Marks",
                                    totalMarks: "$Total_marks"
                                }
                            }
                        ]).sort({ exam_title: 1 }).toArray(function (err, results) {
                            //  console.log(results);

                            if (err) {
                                next(err, null);
                            }

                            next(null, results);

                        })

                    }, function getSubjectMarksData(results, next) {
                        // console.log(scheduleResult);
                        //  console.log(results);
                        var count = 0;
                        var assessmentResult = results;
                        var assessmentResultLength = results.length;
                        subject_name = assessmentResult.subject;
                        var exam_marks = [];

                        var percentage = 0;
                        var grade = "";

                        for (i = 0; i < assessmentResultLength; i++) {

                            exam_title = assessmentResult[i].exam_title;
                            totalMarks = parseInt(assessmentResult[i].totalMarks);
                            max_marks = parseInt(assessmentResult[i].maxMarks);

                            percentage = (totalMarks / max_marks) * 100;
                            if (percentage > 90 && percentage <= 100) {
                                grade = "A1";
                            } else if (percentage > 80 && percentage <= 90) {
                                grade = "A2";
                            } else if (percentage > 70 && percentage <= 80) {
                                grade = "B1";
                            } else if (percentage > 60 && percentage <= 70) {
                                grade = "B2";
                            } else if (percentage > 50 && percentage <= 60) {
                                grade = "C1";
                            } else if (percentage > 40 && percentage <= 50) {
                                grade = "C2";
                            } else if (percentage > 34 && percentage <= 40) {
                                grade = "D";
                            } else if (percentage >= 0 && percentage <= 34) {
                                grade = "E";
                            } else {
                                grade = "N/A";
                            }

                            count++;
                            exam_marks.push({ exam_title: exam_title, totalMarks: totalMarks, max_marks: max_marks, percentage: percentage, grade: grade })

                        }

                        if (assessmentResultLength == count) {

                            studentsMarks.push({ student_id: student_id, subject_name: subject_name, exam_marks: exam_marks })
                            next(null, studentsMarks);
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

router.route('/teacherClassesList/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var status = 1;
        var classesList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSubjects(next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            {
                                "$unwind": "$subjects"
                            },
                            {
                                "$lookup": {
                                    "from": "school_classes",
                                    "localField": "subjects.class_id",
                                    "foreignField": "class_id",
                                    "as": "class_doc"
                                }
                            },
                            {
                                "$unwind": "$class_doc"
                            },
                            {
                                "$project": {
                                    "class_id": "$subjects.class_id",
                                    "name": "$class_doc.name",
                                    "status": "$class_doc.status",
                                }
                            }
                        ]);
                        cursor.sort({ class_id: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else {
                                if(result.length > 0) {
                                    result = result.filter(data => data.status === 1);
                                }
                                next(null, result);
                            }
                        });
                    },
                    function getClassTeacher(result, next) {
                        var cursor = db.collection('class_sections').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id
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
                                "$project": {
                                    "class_id": "$class_id",
                                    "name": "$class_doc.name",
                                    "status": "$class_doc.status",
                                }
                            }
                        ]);
                        cursor.sort({ class_id: 1 }).toArray(function (err, result1) {
                            if (err) {
                                next(err, null);
                            }
                            result1.forEach(function (doc) {
                                if(doc.status === 1) {
                                    result.push(doc)
                                }
                            })
                            next(null, result);
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in subjectsResult) {
                                lookupObject[subjectsResult[i]["class_id"]] = subjectsResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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
                        res.send({
                            school_classes: result1
                        });
                    }
                }
            )
        });
    });

router.route('/ClassteacherClassesList/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var status = 1;
        var classesList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSubjects(next) {
                        var cursor = db.collection('class_sections').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id
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
                                "$project": {
                                    "class_id": "$class_doc.class_id",
                                    "class_name": "$class_doc.name",
                                    "section_id": "$section_id",
                                    "section_name": "$name",
                                    "status": "$status"
                                }
                            }
                        ]);
                        cursor.sort({ class_id: 1 }).toArray(function (err, result) {
                            //console.log(result)
                            if (err) {
                                next(err, null);
                            } else {
                                if(result.length > 0) {
                                    result = result.filter(data => data.status === 1);
                                }
                                next(null, result);
                            }
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var classesResult = result;
                        var classesResultLength = result.length;
                        if (classesResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in classesResult) {
                                lookupObject[classesResult[i]["class_id"]] = classesResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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
                        res.send({
                            class_teacher: result1
                        });
                    }
                }
            )
        });
    });

router.route('/teacherSectionsList/:employee_id/:class_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var class_id = req.params.class_id;
        var status = 1;
        var resultArray = [];
        var sectionsList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSubjects(next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            { $unwind: '$subjects' },
                            {
                                $match: {
                                    'subjects.class_id': class_id,
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "class_sections",
                                    "localField": "subjects.section_id",
                                    "foreignField": "section_id",
                                    "as": "sections_doc"
                                }
                            },
                            {
                                "$unwind": "$sections_doc"
                            },
                            {
                                "$lookup": {
                                    "from": "school_classes",
                                    "localField": "subjects.class_id",
                                    "foreignField": "class_id",
                                    "as": "class_doc"
                                }
                            },
                            {
                                "$unwind": "$class_doc"
                            },
                            {
                                "$lookup": {
                                    "from": "employee",
                                    "localField": "teacher_id",
                                    "foreignField": "employee_id",
                                    "as": "employee_doc"
                                }
                            },
                            {
                                "$unwind": "$employee_doc"
                            },
                            {
                                "$project": {
                                    "section_id": "$subjects.section_id",
                                    "name": "$sections_doc.name",
                                    "class_name": "$class_doc.name",
                                    "teacher_name": "$employee_doc.first_name",
                                    "status": "$sections_doc.status"
                                }
                            }
                        ]);
                        cursor.sort({ section_id: 1 }).toArray(function (err, result) {
                            console.log(result)
                            if (err) {
                                next(err, null);
                            } else {
                                result = result.filter(data => data.status === 1);
                                next(null, result);
                            }
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        // console.log(subjectsResult)
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in subjectsResult) {
                                lookupObject[subjectsResult[i]["section_id"]] = subjectsResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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

                        res.send({
                            class_sections: result1
                        });

                    }
                }
            )
        });
    });

router.route('/teacherSectionsList_by_school/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var status = 1;
        var resultArray = [];
        var sectionsList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSections(next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            { $unwind: '$subjects' },
                            {
                                "$lookup": {
                                    "from": "class_sections",
                                    "localField": "subjects.section_id",
                                    "foreignField": "section_id",
                                    "as": "sections_doc"
                                }
                            },
                            {
                                "$unwind": "$sections_doc"
                            },
                            {
                                "$lookup": {
                                    "from": "school_classes",
                                    "localField": "subjects.class_id",
                                    "foreignField": "class_id",
                                    "as": "class_doc"
                                }
                            },
                            {
                                "$unwind": "$class_doc"
                            },
                            {
                                "$project": {
                                    "section_id": "$subjects.section_id",
                                    "section_name": "$sections_doc.name",
                                    "class_id": "$subjects.class_id",
                                    "class_name": "$class_doc.name",
                                    "status": "$sections_doc.status",
                                }
                            }
                        ]);
                        cursor.sort({ section_id: 1 }).toArray(function (err, result) {
                            console.log(result)
                            if (err) {
                                next(err, null);
                            } else {
                                result = result.filter(data => data.status === 1);
                                next(null, result);
                            }
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var sectionsResult = result;
                        var sectionsResultLength = result.length;
                        console.log(sectionsResult)
                        if (sectionsResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in sectionsResult) {
                                lookupObject[sectionsResult[i]["section_id"]] = sectionsResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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

                        res.send({
                            class_sections: result1
                        });

                    }
                }
            )
        });
    });

router.route('/ClassteacherSectionsList/:employee_id/:class_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var class_id = req.params.class_id;
        var status = 1;
        var resultArray = [];
        var sectionsList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSubjects(next) {
                        var cursor = db.collection('class_sections').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id,
                                    class_id: class_id
                                }
                            },
                            {
                                "$project": {
                                    "section_id": "$section_id",
                                    "section_name": "$name",
                                }
                            }
                        ]);
                        cursor.sort({ section_id: 1 }).toArray(function (err, result) {
                            console.log(result)
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};
                            for (var i in subjectsResult) {
                                lookupObject[subjectsResult[i]["section_id"]] = subjectsResult[i];
                            }
                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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
                        res.send({
                            class_sections: result1
                        });
                    }
                }
            )
        });
    });

router.route('/teacherSubjectsList/:employee_id/:section_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var section_id = req.params.section_id;
        var status = 1;
        var resultArray = [];
        var subjectsList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSubjects(next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            { $unwind: '$subjects' },
                            {
                                $match: {
                                    'subjects.section_id': section_id,
                                }
                            },
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
                                    "subject_id": "$subjects.subject_id",
                                    "subject_name": "$subject_doc.name",
                                    "textbook": "$subject_doc.textbook",
                                    "author": "$subject_doc.author",
                                    "publisher": "$subject_doc.publisher"
                                }
                            }
                        ]);
                        cursor.toArray(function (err, result) {
                            console.log(result)
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        // console.log(subjectsResult)
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                subjectsList.push({ 
                                    subject_id: subjectData.subject_id, 
                                    name: subjectData.subject_name, 
                                    textbook: subjectData.textbook, 
                                    author: subjectData.author, 
                                    publisher: subjectData.publisher 
                                })
                                count++
                            })
                            if (subjectsResultLength == count) {
                                next(null, subjectsList)
                            }
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

                        res.send({
                            subjects: result1
                        });

                    }
                }
            )
        });
    });

router.route('/listsubjectstoteacher_by_subjectId/:subject_id')
    .get(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //  var cursor = db.collection('teacher_subjects').find({ subjects: { $elemMatch: { subject_id: subject_id } } });
            var cursor = db.collection('teacher_subjects').aggregate([
                {
                    $match: {
                        'subjects': {
                            $elemMatch: { subject_id: subject_id }
                        }

                    }
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "teacher_id",
                        foreignField: "employee_id",
                        as: "teacher_doc"
                    }
                },
                { "$unwind": "$teacher_doc" },
                {
                    "$project": {
                        "_id": "$_id",
                        "teacher_id": "$teacher_id",
                        "teacher_name": "$teacher_doc.first_name",
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    teachers: resultArray
                });
            });
        });
    });

router.route('/all_assessment_marks_by_section_subject/:subject_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var studentsMarks = [];
        var examScheduleList = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionStudents(next) {
                        db.collection('students').find({
                            section_id: section_id,
                            status: 1
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
                        console.log(studentsResult)
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            subjectId: subject_id,
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "subjects",
                                            localField: "subjectId",
                                            foreignField: "subject_id",
                                            as: "subject_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$subject_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            subject_id: "$subjectId",
                                            subject: "$subject_doc.name",
                                            exam_title: "$exam_title",
                                            maxMarks: "$maxMarks",
                                            marks: "$Marks",
                                            totalMarks: "$Total_marks",
                                            grade: "$Grade",
                                            GPA: "$GPA",
                                        }
                                    }
                                ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    console.log(results)
                                    studentData.assessments = results

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult);
                                    }

                                })
                            })
                        }
                    },
                    function getSchoolExamSchedules(result, next) {

                        var data = db.collection('exam_schedule').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, scheduleResult) {
                            if (err) {
                                next(err, null);
                            }
                            examScheduleList = scheduleResult;
                            next(null, result, scheduleResult);
                        });
                    }, function getAttendanceData(result, scheduleResult, next) {

                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        var scheduleArray = scheduleResult;
                        var scheduleArrayLength = scheduleArray.length;
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
                                    var exam_marks = [];

                                    for (i = 0; i < scheduleArrayLength; i++) {

                                        var subjects = [];
                                        examTitle = scheduleArray[i].exam_title;
                                        var totalAllMarks = 0;
                                        var totalMaxMarks = 0;
                                        var totalPerrcentage = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {
                                            var percentage = 0;
                                            if (examTitle == assessments[j].exam_title) {

                                                if (Number.isInteger(parseInt(assessments[j].totalMarks))) {
                                                    totalMarks = parseInt(assessments[j].totalMarks);
                                                } else {
                                                    totalMarks = 0;
                                                };

                                                subject_name = assessments[j].subject;

                                                if (Number.isInteger(parseInt(assessments[j].maxMarks))) {
                                                    max_marks = parseInt(assessments[j].maxMarks);
                                                } else {
                                                    max_marks = 0;
                                                };
                                                totalAllMarks += totalMarks;
                                                totalMaxMarks += max_marks;
                                                percentage = (parseInt(totalMarks) / parseInt(max_marks)) * parseInt(100);
                                                var grade;
                                                if (percentage > 90 && percentage <= 100) {
                                                    grade = "A1";
                                                } else if (percentage > 80 && percentage <= 90) {
                                                    grade = "A2";
                                                } else if (percentage > 70 && percentage <= 80) {
                                                    grade = "B1";
                                                } else if (percentage > 60 && percentage <= 70) {
                                                    grade = "B2";
                                                } else if (percentage > 50 && percentage <= 60) {
                                                    grade = "C1";
                                                } else if (percentage > 40 && percentage <= 50) {
                                                    grade = "C2";
                                                } else if (percentage > 34 && percentage <= 40) {
                                                    grade = "D";
                                                } else if (percentage < 35 && percentage >= 0) {
                                                    grade = "E";
                                                };

                                                subjects.push({ subject_name: subject_name, max_marks: max_marks, total_marks: totalMarks, totalAllMarks: totalAllMarks, grade: grade })
                                            }
                                        }
                                        var totalPerrcentage = (parseInt(totalAllMarks) / parseInt(totalMaxMarks)) * parseInt(100);
                                        var finalGrade = "";
                                        if (totalPerrcentage > 90 && totalPerrcentage <= 100) {
                                            finalGrade = "A1";
                                        } else if (totalPerrcentage > 80 && totalPerrcentage <= 90) {
                                            finalGrade = "A2";
                                        } else if (totalPerrcentage > 70 && totalPerrcentage <= 80) {
                                            finalGrade = "B1";
                                        } else if (totalPerrcentage > 60 && totalPerrcentage <= 70) {
                                            finalGrade = "B2";
                                        } else if (totalPerrcentage > 50 && totalPerrcentage <= 60) {
                                            finalGrade = "C1";
                                        } else if (totalPerrcentage > 40 && totalPerrcentage <= 50) {
                                            finalGrade = "C2";
                                        } else if (totalPerrcentage > 34 && totalPerrcentage <= 40) {
                                            finalGrade = "D";
                                        } else if (totalPerrcentage >= 0 && totalPerrcentage <= 34) {
                                            finalGrade = "E";
                                        }

                                        exam_marks.push({ exam_title: examTitle, subjects: subjects, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, grade: finalGrade })
                                    }
                                    count++;
                                }
                                studentsMarks.push({ student_id: student_id, student_name: studentName, exam_marks: exam_marks })
                                console.log(studentsMarks)
                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
                        }
                    }, function (result1, next) {
                        var finalObj = [];
                        examScheduleList.forEach(function (scheduleList) {
                            var gradesData = [{ grade: "A1", count: 0, students: [] },
                            { grade: "A2", count: 0, students: [] },
                            { grade: "B1", count: 0, students: [] },
                            { grade: "B2", count: 0, students: [] },
                            { grade: "C1", count: 0, students: [] },
                            { grade: "C2", count: 0, students: [] },
                            { grade: "D", count: 0, students: [] },
                            { grade: "E", count: 0, students: [] }];

                            if (result1.length > 0) {
                                result1.forEach(function (student) {
                                    if (student.exam_marks) {
                                        if (student.exam_marks.length > 0) {
                                            student.exam_marks.forEach(function (examMarks) {
                                                if (scheduleList.exam_title == examMarks.exam_title) {
                                                    if (examMarks.grade == "A1") {
                                                        gradesData[0].count++;
                                                        gradesData[0].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "A2") {
                                                        gradesData[1].count++;
                                                        gradesData[1].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "B1") {
                                                        gradesData[2].count++;
                                                        gradesData[2].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "B2") {
                                                        gradesData[3].count++;
                                                        gradesData[3].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "C1") {
                                                        gradesData[4].count++;
                                                        gradesData[4].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "C2") {
                                                        gradesData[5].count++;
                                                        gradesData[5].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }
                                                    if (examMarks.grade == "D") {
                                                        gradesData[6].count++;
                                                        gradesData[6].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }

                                                    if (examMarks.grade == "E") {
                                                        gradesData[7].count++;
                                                        gradesData[7].students.push({ student_id: student.student_id, student_name: student.student_name });
                                                    }

                                                }

                                            })

                                        } else {


                                        }
                                    } else { }



                                })

                            }


                            finalObj.push({ exam_title: scheduleList.exam_title, data: gradesData, totalCount: gradesData[0].count + gradesData[1].count + gradesData[2].count + gradesData[3].count + gradesData[4].count + gradesData[5].count + gradesData[6].count + gradesData[7].count });

                        })

                        next(null, finalObj);

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

router.route('/teacher_class_schedule/:select_date/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var select_date = req.params.select_date;
        var subjects = [];
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('teacher_subjects').find({ teacher_id: employee_id });
            cursor.toArray(function (err, result) {
                if (err) {
                    res.send('false')
                } else {
                    if (result.length > 0) {
                        subjects = result[0].subjects;
                        var count = 0;
                        subjects.forEach(function (sub) {
                            var subject_id = sub.subject_id;
                            var section_id = sub.section_id;
                            var class_id = sub.class_id;
                            db.collection('coursework').aggregate([
                                {
                                    $match: {
                                        subject_id: subject_id,
                                        start_date: { $lte: select_date },
                                        end_date: { $gte: select_date },
                                        status: 1
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "subjects",
                                        localField: "subject_id",
                                        foreignField: "subject_id",
                                        as: "subject_doc"
                                    }
                                },
                                { $unwind: "$subject_doc" },
                                {
                                    $lookup: {
                                        from: "class_sections",
                                        localField: "subject_doc.section_id",
                                        foreignField: "section_id",
                                        as: "section_doc"
                                    }
                                },
                                { $unwind: "$section_doc" },
                                {
                                    $lookup: {
                                        from: "school_classes",
                                        localField: "section_doc.class_id",
                                        foreignField: "class_id",
                                        as: "class_doc"
                                    }
                                },
                                { $unwind: "$class_doc" },
                                {
                                    $project:
                                    {
                                        lession_id: "$lession_id",
                                        title: "$title",
                                        subject_id: "$subject_id",
                                        subject_name: "$subject_doc.name",
                                        class_name: "$class_doc.name",
                                        section_name: "$section_doc.name",
                                        lession_status: "$lession_status",
                                        no_of_topics: "$no_of_topics",
                                        completed_topics: "$completed_topics",
                                    }
                                }
                            ]).toArray(function (err, result1) {
                                count++;
                                console.log(result1)
                                if (err) {
                                    res.send('false')
                                } else if (result1.length > 0) {
                                    result1.forEach(function (res) {
                                        res.completion_percentage = parseFloat(((parseInt(res.completed_topics) / parseInt(res.no_of_topics)) * 100).toFixed(2));
                                        resultArray.push(res)
                                    })
                                } else if (count === subjects.length) {
                                    db.close();
                                    res.send({
                                        class_schedules: resultArray
                                    });
                                }
                            })
                        })
                    } else {
                        res.send({
                            class_schedules: {
                                lession_id: "",
                                title: "No Schedule",
                                subject_id: "",
                                subject_name: "No Title",
                                class_name: "",
                                section_name: "",
                                lession_status: "Not Applicable",
                                no_of_topics: 0,
                                completed_topics: 0,
                            }
                        })
                    }
                }
            });
        });
    })

router.route('/teacher_evaluation_by_section/:employee_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var employee_id = req.params.employee_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var evaluation = [];
        var subject_evaluation = [];
        var exam_efficiency = 0;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionSubjects(next) {
                        db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            {
                                $unwind: '$subjects'
                            },
                            {
                                $match: {
                                    'subjects.section_id': section_id,
                                }
                            },
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
                                    "subject_id": "$subjects.subject_id",
                                    "subject_name": "$subject_doc.name",
                                    "textbook": "$subject_doc.textbook",
                                    "author": "$subject_doc.author",
                                    "publishing": "$subject_doc.publishing"
                                }
                            }
                        ]).toArray(function (err, subjectresult) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, subjectresult);
                        });
                    },
                    function getSectionSubjects(subjectresult, next) {

                        db.collection('exam_schedule').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, scheduleResult) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, subjectresult, scheduleResult);
                        });
                    },
                    function getsectionStudentsData(subjectresult, scheduleResult, next) {
                        var count = 0;
                        var subjectsResult = subjectresult;
                        var subjectsResultLength = subjectresult.length;
                        var scheduleResult = scheduleResult;
                        var scheduleResultLength = scheduleResult.length;
                        if (subjectsResultLength == 0 || scheduleResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subjectId = subjectData.subject_id;
                                var subject_name = subjectData.subject_name;
                                var totalEfficiency = 0;
                                var exam_count = 0;
                                var count1 = 0;

                                scheduleResult.forEach(function (scheduleData) {
                                    var exam_title = scheduleData.exam_title;
                                    var totalMarks = 0;
                                    var MaxMarks = 0;
                                    var efficiency = 0;

                                    db.collection('assessment_evaluation').aggregate([
                                        {
                                            $match: {
                                                subjectId: subjectId,
                                                exam_title: exam_title
                                            },
                                        },
                                        {
                                            $lookup: {
                                                from: "subjects",
                                                localField: "subjectId",
                                                foreignField: "subject_id",
                                                as: "subject_doc"
                                            }
                                        },
                                        {
                                            $unwind: "$subject_doc"
                                        },
                                        {
                                            $project:
                                            {
                                                section_id: "$section_id",
                                                subject_id: "$subjectId",
                                                subject: "$subject_doc.name",
                                                exam_title: "$exam_title",
                                                maxMarks: "$maxMarks",
                                                marks: "$Marks",
                                                totalMarks: "$Total_marks",
                                            }
                                        }
                                    ]).toArray(function (err, result) {
                                        count1++;
                                        if (err) {
                                            next(err, null);
                                        }

                                        if (result.length > 0) {
                                            result.forEach(function (doc) {
                                                totalMarks += doc.totalMarks;
                                                MaxMarks += doc.maxMarks;
                                            })
                                            exam_count++;
                                            efficiency += parseInt((totalMarks / MaxMarks) * 100);
                                        } else {
                                            efficiency += 0;
                                        }
                                        scheduleData.efficiency = efficiency;
                                        totalEfficiency += efficiency;

                                        if (scheduleResultLength === count1) {
                                            subjectData.examResults = scheduleResult;
                                            if (exam_count > 0) {
                                                subjectData.totalEfficiency = (totalEfficiency / exam_count)
                                            } else {
                                                subjectData.totalEfficiency = 0;
                                            }
                                        }

                                        count++;
                                        if ((subjectsResultLength * scheduleResultLength) == count) {
                                            next(null, subjectsResult)
                                        }
                                    });
                                })

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
            );
        });
    });

router.route('/teacher_contentDelivery_by_section/:employee_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var employee_id = req.params.employee_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var evaluation = [];
        var subject_evaluation = [];
        var exam_efficiency = 0;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionSubjects(next) {
                        db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    teacher_id: employee_id
                                }
                            },
                            {
                                $unwind: '$subjects'
                            },
                            {
                                $match: {
                                    'subjects.section_id': section_id,
                                }
                            },
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
                                    "subject_id": "$subjects.subject_id",
                                    "subject_name": "$subject_doc.name",
                                    "textbook": "$subject_doc.textbook",
                                    "author": "$subject_doc.author",
                                    "publishing": "$subject_doc.publishing"
                                }
                            }
                        ]).toArray(function (err, subjectresult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, subjectresult);
                        });
                    },
                    function getsectionStudentsData(subjectresult, next) {
                        var count = 0;
                        var subjectsResult = subjectresult;
                        var subjectsResultLength = subjectresult.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subjectId = subjectData.subject_id;
                                var totalEfficiency = 0;
                                db.collection('coursework').find({
                                    subject_id: subjectId,
                                    status: 1
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    var lession_count = 0;
                                    var efficiency = 0;
                                    if (results.length > 0) {
                                        results.forEach(function (doc) {
                                            var completion_date = new Date(doc.completion_date);
                                            var start_date = new Date(doc.start_date);
                                            var end_date = new Date(doc.end_date);
                                            var started_date = new Date(started_date);
                                            var current_date = new Date();

                                            if (doc.lession_status === 'completed') {
                                                if (completion_date.getTime() <= end_date.getTime()) {
                                                    doc.delivery_efficiency = 100
                                                } else if (completion_date.getTime() > end_date.getTime()) {
                                                    doc.delivery_efficiency = parseFloat((((end_date.getTime() - start_date.getTime()) / (completion_date.getTime() - start_date.getTime())) * 100).toFixed(2));
                                                }
                                                lession_count++;
                                            } else if (doc.lession_status === 'started') {
                                                if (current_date.getTime() <= end_date.getTime()) {
                                                    doc.delivery_efficiency = parsparseFloateInt(((doc.completed_topics / doc.no_of_topics) * 100).toFixed(2))
                                                } else if (current_date.getTime() > end_date.getTime()) {
                                                    var completion_percentage = ((doc.completed_topics / doc.no_of_topics) * 100).toFixed(2);
                                                    var planned_completion_time = (completion_percentage * (end_date.getTime() - start_date.getTime())) / 100;
                                                    var actual_completion_time = (current_date.getTime() - start_date.getTime());
                                                    doc.delivery_efficiency = parseFloat(((planned_completion_time / actual_completion_time) * 100).toFixed(2));
                                                }
                                                lession_count++;
                                            } else if (doc.lession_status === 'pending') {
                                                doc.delivery_efficiency = 0;
                                            }
                                            console.log(doc.delivery_efficiency)
                                            efficiency += parseFloat(doc.delivery_efficiency);
                                        })
                                        console.log(efficiency)
                                        console.log(lession_count)
                                        if (efficiency === "NaN" || lession_count === "NaN" || lession_count === 0) {
                                            totalEfficiency = 0;
                                        } else {
                                            totalEfficiency = (efficiency / lession_count).toFixed(2);
                                        }
                                        subjectData.chapters = results;
                                        subjectData.totalEfficiency = totalEfficiency;
                                    } else {
                                        subjectData.chapters = [];
                                        subjectData.totalEfficiency = 0;
                                    }
                                    if ((subjectsResultLength) == count) {
                                        next(null, subjectsResult)
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
            );
        });
    });

router.route('/employeeId_by_teacherId/:teacher_id')
    .get(function (req, res, next) {
        var teacher_id = req.params.teacher_id;
        var status = 1;
        var resultArray = [];
        teacher_id = teacher_id.toUpperCase();
        console.log(teacher_id);
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('teachers').find({ teacher_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    teachers: resultArray
                });
            });
        });
    });

router.route('/staff_by_category/:job_category/:school_id')
    .get(function (req, res, next) {
        var job_category = req.params.job_category;
        var school_id = req.params.school_id;
        var result = [];
        var cursor;
        //  console.log(job_category);

        mongo.connect(url1, function (err, db) {
            async.waterfall(
                [
                    function getlogins(next) {
                        if (job_category == "teaching") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "teacher" });
                        } else if (job_category == "non-teaching") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "non-teaching" });
                        } else if (job_category == "adminstrative") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "adminstrative" });
                        }
                        cursor.forEach(function (doc, err) {
                            result.push(doc);
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeeName(result, next) {
                        var count = 0;
                        var loginResult = result;
                        var loginResultLength = result.length;
                        if (loginResultLength == 0) {
                            next(null, []);
                        } else {
                            loginResult.forEach(function (loginData) {
                                var employee_id = loginData.employee_id;
                                mongo.connect(url, function (err, db) {
                                    db.getSiblingDB(url).collection('employee').find({
                                        employee_id: employee_id
                                    }).toArray(function (err, results) {
                                        count++;
                                        if (err) {
                                            next(err, null);
                                        }
                                        loginData.employee_name = results[0].first_name

                                        if (loginResultLength == count) {
                                            next(null, loginResult);
                                        }
                                    });
                                });
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
                            studentFee: result1
                        });

                    }
                }
            );
        });
    });

router.route('/Staff_information/:job_category/:school_id')
    .get(function (req, res, next) {
        var job_category = req.params.job_category;
        var school_id = req.params.school_id;
        var resultArray = [];
        var cursor;
        async.waterfall(
            [
                function getStaffLogins(next) {
                    mongo.connect(url1, function (err, db) {
                        assert.equal(null, err);
                        if (job_category == "teaching") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "teacher" });
                        } else if (job_category == "non-teaching") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "non-teacher" });
                        } else if (job_category == "administrative") {
                            cursor = db.collection('users').find({ school_id: school_id, role: "administrator" });
                        }
                        if (cursor) {
                            cursor.toArray(function (err, result) {
                                if (err) {
                                    next(err, null);
                                }
                                console.log(result)
                                next(null, result);
                            });
                        } else {
                            next(null, []);
                        }
                    });
                },
                function getStaffAttendance(result, next) {
                    var count = 0;
                    var usersResult = result;
                    var usersResultLength = result.length;
                    if (usersResultLength == 0) {
                        next(null, []);
                    } else {
                        usersResult.forEach(function (userData) {
                            var employee_id = userData.uniqueId;
                            var date = new Date();
                            var endDate = new Date();
                            endDate.setDate(endDate.getDate() + 1);
                            mongo.connect(url, function (err, db) {
                                db.collection('employee').find({
                                    employee_id: employee_id,
                                    status: 1
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if(results.length > 0) {
                                        resultArray.push({
                                            login: userData.login,
                                            first_name: results[0].first_name,
                                            last_name: results[0].last_name,
                                            role: userData.role,
                                            school_id: userData.school_id
                                        })
                                    }
                                    if (usersResultLength == count) {
                                        next(null, resultArray);
                                    }
                                })
                            })
                        })
                    }
                },
                function (err, result1) {
                    if (err) {
                        res.send({
                            employees: err
                        });
                    } else {
                        res.send({
                            employees: result1
                        });
                    }
                }
            ])
    });

module.exports = router;
