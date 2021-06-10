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

// Add Project Works
router.route('/projectworks/:section_id/:subject_id/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var school_id = req.params.school_id;
        var d = new Date(req.body.assign_date);
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

        // var chapter_name = req.params.chapter_name;
        books = [];
        var item = {
            projectwork_id: 'getauto',
            school_id: school_id,
            section_id: section_id,
            subject_id: subject_id,
            project_work: req.body.project_work,
            maxMarks: req.body.maxMarks,
            assign_date: assign_date,
            due_date: req.body.due_date,
            description: req.body.description,
            day: day,
            month: month,
            year: year,
            submission: 'pending',
            average_marks: 0,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'projectworks', function (err, autoIndex) {
                var collection = db.collection('projectworks');
                collection.ensureIndex({
                    "projectwork_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.project_work == null || item.maxMarks == null) {
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
                                        projectwork_id: subject_id + '-PW' + id
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

        var subject_id = req.params.subject_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('assignments').find();
            var cursor = db.collection('projectworks').aggregate([
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
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "chapter_doc"
                    }
                },
                {
                    "$lookup": {
                        "from": "PW_marks",
                        "localField": "projectwork_id",
                        "foreignField": "projectwork_id",
                        "as": "projectwork_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "section_id": "$section_id",
                        "projectwork_id": "$projectwork_id",
                        "project_work": "$project_work",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "assign_date": "$assign_date",
                        "due_date": "$due_date",
                        "submission": "$submission",
                        "chapters": "$chapter_doc",
                        "description": "$description",
                        "projectwork_doc": "$projectwork_doc",
                    }
                }
            ]).sort({ _id: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var totalMarks = 0;
                var projectworkMarks = doc.projectwork_doc;
                projectworkMarks.forEach(function (pwDoc, err) {
                    totalMarks += pwDoc.marks
                })
                doc.avg_score = parseInt(totalMarks / projectworkMarks.length);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    projectworks: resultArray
                });
            });
        });
    });

// Get ProjectWorks by lession_id
router.route('/assignments/:lession_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var lession_id = req.params.lession_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('assignments').find();
            var cursor = db.collection('assignments').aggregate([
                {
                    $match: {
                        lession_id: lession_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "coursework",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "chapter_doc"
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    assignments: resultArray
                });
            });
        });
    });

// Edit Project Work
router.route('/edit_projectworks/:projectwork_id')
    .put(function (req, res, next) {
        var myquery = { projectwork_id: req.params.projectwork_id };
        var req_project_work = req.body.project_work;
        var req_maxMarks = req.body.maxMarks;
        var req_assign_date = req.body.assign_date;
        var req_due_date = req.body.due_date;
        var req_description = req.body.description;

        mongo.connect(url, function (err, db) {
            db.collection('projectworks').update(myquery, {
                $set: {
                    project_work: req_project_work,
                    maxMarks: req_maxMarks,
                    assign_date: req_assign_date,
                    due_date: req_due_date,
                    description: req_description
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

// Soft Delete Project Work
router.route('/delete_projectworks/:projectwork_id')
    .put(function (req, res, next) {
        var myquery = { projectwork_id: req.params.projectwork_id };

        mongo.connect(url, function (err, db) {
            db.collection('projectworks').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('PW_marks').deleteMany(myquery, function (err, result) {
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

// Hard Delete Project Work
router.route('/hard_delete_projectworks/:projectwork_id')
    .delete(function (req, res, next) {
        var myquery = { projectwork_id: req.params.projectwork_id };

        mongo.connect(url, function (err, db) {
            db.collection('projectworks').delete(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('PW_marks').deleteMany(myquery, function (err, result) {
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

router.route('/projectwork_details/:projectwork_id')
    .get(function (req, res, next) {
        var projectwork_id = req.params.projectwork_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('projectworks').find({ projectwork_id: projectwork_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    projectwork: resultArray
                });
            });
        });
    });

// ProjectWork Average Score
router.route('/projectwork_avgScore/:projectwork_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var totalMarks = 0;
        var projectwork_id = req.params.projectwork_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('PW_marks').find({ projectwork_id: projectwork_id });
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

router.route('/projectworks_marksbulk_eval/:section_id/:subject_id/:projectwork_id')
    .post(function (req, res, next) {

        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var projectwork_id = req.params.projectwork_id;
        var totalMarks = 0;
        if (subject_id == null || section_id == null || !req.body.students) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.students.length > 0) {
                forEach(req.body.students, function (key, value) {
                    totalMarks += parseInt(key.marks);
                    var item = {
                        projectwork_result_id: '',
                        student_id: key.student_id,
                        subject_id: subject_id,
                        section_id: section_id,
                        school_id: school_id,
                        projectwork_id: projectwork_id,
                        marks: parseInt(key.marks),
                        status: 1
                    };

                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'PW_marks', function (err, autoIndex) {
                            var data = db.collection('PW_marks').find({
                                section_id: section_id,
                                projectwork_id: projectwork_id,
                                student_id: item.student_id
                            }).count(function (e, triggerCount) {
                                if (triggerCount > 0) {
                                    count++;
                                    if (count == req.body.students.length) {
                                        res.send('false1');
                                    }
                                } else {
                                    var collection = db.collection('PW_marks');
                                    collection.ensureIndex({
                                        "projectwork_result_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.subject_id == null || item.section_id == null || item.projectwork_id == null || item.marks == null) {
                                            res.end('null');
                                        } else {
                                            collection.find({ projectwork_id: item.projectwork_id }).count(function (err, triggerCount) {
                                                var id = triggerCount + 1;
                                                item.projectwork_result_id = item.student_id + '-' + item.projectwork_id + '-M' + id;
                                                collection.insertOne(item, function (err, result) {
                                                    if (err) {
                                                        console.log(err);
                                                        if (err.code == 11000) {

                                                            res.end('false2');
                                                        }
                                                        res.end('false3');
                                                    }
                                                    count++;
                                                    db.close();

                                                    if (count == req.body.students.length) {
                                                        var average_marks = (totalMarks / req.body.students.length);
                                                        console.log(average_marks)
                                                        mongo.connect(url, function (err, db) {
                                                            db.collection('projectworks').update({ projectwork_id: projectwork_id }, { $set: { submission: 'completed', average_marks: average_marks } }, function (err, result) {
                                                                assert.equal(null, err);
                                                                if (err) {
                                                                    res.send('false4');
                                                                }
                                                            });
                                                        });
                                                        db.close();
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
    })

router.route('/projectworks_marksbulk_eval/:projectwork_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var projectwork_id = req.params.projectwork_id;

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
                                var cursor = db.collection('PW_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            projectwork_id: projectwork_id,
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
                                            "from": "projectworks",
                                            "localField": "projectwork_id",
                                            "foreignField": "projectwork_id",
                                            "as": "projectworks_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$projectworks_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "projectwork_result_id": "$projectwork_result_id",
                                            "section_id": "$section_id",
                                            "subject_name": "$subject_doc.name",
                                            "project_work": "$projectworks_doc.project_work",
                                            "maxMarks": "$projectworks_doc.maxMarks",
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
                                        studentData.projectwork_result_id = result1[0].projectwork_result_id;
                                        studentData.subject_name = result1[0].subject_name;
                                        studentData.project_work = result1[0].project_work;
                                        
                                        // result1[0].first_name = studentData.first_name;
                                        // result1[0].last_name = studentData.last_name;
                                        // result1[0].roll_no = studentData.roll_no;
                                        // result1[0].maxMarks = parseInt(result1[0].maxMarks);
                                        // result1[0].marks = parseInt(result1[0].marks);
                                        // resultArray.push(result1[0]);
                                    } else {
                                        studentData.maxMarks = '';
                                        studentData.marks = null;
                                        studentData.projectwork_result_id = '';
                                        studentData.subject_name = '';
                                        studentData.project_work = '';

                                        // var doc = {
                                        //     _id: '',
                                        //     student_id: studentData.student_id,
                                        //     first_name: studentData.first_name,
                                        //     last_name: studentData.last_name,
                                        //     roll_no: studentData.roll_no,
                                        //     section_id: studentData.section_id,
                                        //     projectwork_result_id: '',
                                        //     subject_name: '',
                                        //     project_work: '',
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
                            PW_marks: result2
                        });
                    }
                }
            );
        });
    });

router.route('/student_projectworks/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('projectworks').aggregate([
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
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "chapter_doc"
                    }
                },
                {
                    "$lookup": {
                        "from": "PW_marks",
                        "localField": "projectwork_id",
                        "foreignField": "projectwork_id",
                        "as": "projectwork_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "section_id": "$section_id",
                        "projectwork_id": "$projectwork_id",
                        "project_work": "$project_work",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "due_date": "$due_date",
                        "assign_date": "$assign_date",
                        "submission": "$submission",
                        "description": "$description",
                        "chapters": "$chapter_doc",
                        "projectwork_doc": "$projectwork_doc",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                console.log(doc)
                var chapters = [];
                doc.chapters.forEach(function (chap, err) {
                    chapters.push({ title: chap.title })
                })
                doc.chapters = chapters;
                var classTotal = 0;
                if (doc.projectwork_doc.length > 0) {
                    doc.projectwork_doc.forEach(function (pwDoc, err) {
                        classTotal += pwDoc.marks;
                    })
                } else {
                    console.log('NO Projectworks')
                    doc.projectwork_doc.push({
                        "_id": "",
                        "projectwork_result_id": "",
                        "student_id": student_id,
                        "subject_id": subject_id,
                        "section_id": "",
                        "school_id": "",
                        "projectwork_id": doc.projectwork_id,
                        "marks": null

                    })
                }

                doc.avg_score = parseInt(classTotal / doc.projectwork_doc.length);
                var projectworkMarks = doc.projectwork_doc.filter(data => data.student_id === student_id);
                if (projectworkMarks.length > 0) {
                    doc.totalMarks = projectworkMarks[0].marks;
                } else {
                    doc.totalMarks = 0;
                }
                doc.projectwork_doc = projectworkMarks;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    projectworks: resultArray
                });
            });
        });
    });

router.route('/student_projectwork/:date/:section_id')
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
                        var count = 0;

                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                db.collection('projectworks').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            subject_id: subject_id,
                                            assign_date: date,
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
                                            classTest_id: "$projectwork_id",
                                            title: "$project_work",
                                            chapter_name: "$coursework_doc.title",
                                            assign_date: "$assign_date"
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    subjectData.projectworks = results;

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
                                var assign_date = date;
                                subjectName = subjectData.name;
                                subjectprojectworks = subjectData.projectworks;
                                var projectworks = [];

                                if (subjectprojectworks.length > 0) {
                                    for (i = 0; i < subjectprojectworks.length; i++) {
                                        title = subjectprojectworks[i].title;
                                        date = subjectprojectworks[i].assign_date;
                                        projectwork_id = subjectprojectworks[i].projectwork_id;
                                        projectworks.push({ projectwork_id: projectwork_id, title: title, date: date })
                                    }
                                }
                                subjects.push({ subjectName: subjectName, projectworks: projectworks });
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
                            daily_PW: result1
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

router.route('/bulk_upload_projectworks/:section_id/:lession_id')
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
                                autoIncrement.getNextSequence(db, 'projectworks', function (err, autoIndex) {
                                    var collection = db.collection('projectworks');
                                    collection.ensureIndex({
                                        "projectwork_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.section_id == null || item.projectwork == null) {
                                            res.end('null');
                                        } else {
                                            item.projectwork_id = subject_id + 'CT-' + autoIndex;
                                            collection.insertOne(item, function (err, result) {
                                                if (err) {
                                                    console.log(err);
                                                    if (err.code == 11000) {

                                                        res.end('false');
                                                    }
                                                    res.end('false');
                                                }
                                                count++;                                                
                                                if (count == test.length) {
                                                    db.close();
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

router.route('/edit_projectworks_marks/:projectwork_result_id')
    .put(function (req, res, next) {
        var projectwork_result_id = req.params.projectwork_result_id;
        var myquery = { projectwork_result_id: req.params.projectwork_result_id };
        var splited = projectwork_result_id.split('-');
        var projectwork_id = splited[1] + '-' + splited[2] + '-' + splited[3] + '-' + splited[4] + '-' + splited[5];
        var req_marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            db.collection('PW_marks').find({projectwork_id: projectwork_id}).toArray(function (err, resultArray) {
                if(err) {
                    res.send('false')
                } else {
                    var total_marks = req_marks;
                    var resultArrayLength = resultArray.length;
                    resultArray.forEach(function (doc) {
                        if(doc.projectwork_result_id !== projectwork_result_id) {
                            total_marks += doc.marks;
                        }
                    })
                    var average_marks = parseInt(total_marks) / resultArrayLength;
                    db.collection('PW_marks').update(myquery, {
                        $set: {
                            marks: req_marks
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        } else {
                            db.collection('projectworks').update({projectwork_id: projectwork_id}, {
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

router.route('/add_projectworks_marks/:projectwork_id/:school_id')
    .put(function (req, res, next) {
        var projectwork_id = req.params.projectwork_id;
        var school_id = req.params.school_id;
        var student_id = req.body.student_id;
        var subject_id = req.body.subject_id;
        var section_id = req.body.section_id;
        var marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            var item = {
                projectwork_result_id: '',
                student_id: student_id,
                subject_id: subject_id,
                section_id: section_id,
                school_id: school_id,
                projectwork_id: projectwork_id,
                marks: parseInt(marks),
                status: 1
            };
            console.log(item)
            autoIncrement.getNextSequence(db, 'PW_marks', function (err, autoIndex) {
                var data = db.collection('PW_marks').find({
                    section_id: section_id,
                    projectwork_id: projectwork_id,
                    student_id: item.student_id
                }).count(function (e, triggerCount) {
                    if (triggerCount > 0) {
                        res.send('false');
                    } else {
                        var collection = db.collection('PW_marks');
                        collection.ensureIndex({
                            "projectwork_result_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.subject_id == null || item.section_id == null || item.projectwork_id == null || item.marks == null) {
                                res.end('null');
                            } else {
                                collection.find({ projectwork_id: projectwork_id }).count(function (err, triggerCount1) {
                                    var id = triggerCount1 + 1;
                                    item.projectwork_result_id = item.student_id + '-' + item.projectwork_id + '-M' + id;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                            db.close();
                                            res.end('false');
                                        } else {
                                            db.collection('PW_marks').find({ projectwork_id: projectwork_id }).toArray(function (err, resultArray) {
                                                if (err) {
                                                    res.send('false')
                                                } else {
                                                    var total_marks = 0;
                                                    var resultArrayLength = resultArray.length;
                                                    resultArray.forEach(function (doc) {
                                                        total_marks += doc.marks;
                                                    })
                                                    var average_marks = parseInt(total_marks) / resultArrayLength;
                                                    db.collection('projectworks').update({ projectwork_id: projectwork_id }, {
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

router.route('/CT_marks_by_chapter_id/:subject_id/:lession_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var lession_id = req.params.lession_id;
        var studentsMarks = [];
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

router.route('/all_projectworks_marks_by_section_id/:section_id')
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
                                db.collection('PW_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            section_id: section_id,
                                            status: 1
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "projectworks",
                                            localField: "projectwork_id",
                                            foreignField: "projectwork_id",
                                            as: "projectworks_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$projectworks_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            project_work_id: "$projectworks_doc.project_work_id",
                                            project_work: "$projectworks_doc.project_work",
                                            projectwork_result_id: "$projectwork_result_id",
                                            section_id: "$section_id",
                                            subject_id: "$subject_id",
                                            due_date: "$due_date",
                                            maxMarks: "$projectworks_doc.maxMarks",
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

                                        var projectworks = [];
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;

                                        for (j = 0; j < assessmentsDataLength; j++) {

                                            if (subject_id == assessments[j].subject_id) {
                                                //  console.log("hema");
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                project_work = assessments[j].project_work;
                                                due_date = assessments[j].due_date;
                                                totalMarks += marks;
                                                totalmaxMarks += maxMarks;
                                                count1++

                                                projectworks.push({ project_work: project_work, marks: marks, maxMarks: maxMarks, due_date: due_date })

                                            }
                                        }

                                        if (projectworks.length > 0) {
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

                                        subjectlist.push({ subject_id: subject_id, subject_name: subject_name, projectworks: projectworks, subjectMarks: totalMarks, subjectmaxMarks: totalmaxMarks, average: average, subjectpercentage: percentage, grade: grade, totalprojectworks: count1 })

                                    })

                                    count++;
                                }
                                // count++;
                                studentsMarks.push({ student_id: student_id, student_name: studentName, roll_no: roll_no, subjects: subjectlist })

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

router.route('/all_projectworks_marks_by_student_id/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getsectionStudentsData(next) {
                        db.collection('PW_marks').aggregate([
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
                                    from: "projectworks",
                                    localField: "projectwork_id",
                                    foreignField: "projectwork_id",
                                    as: "projectworks_doc"
                                }
                            },
                            {
                                $unwind: "$projectworks_doc"
                            },
                            {
                                $project:
                                {
                                    first_name: "$students_doc.first_name",
                                    last_name: "$students_doc.last_name",
                                    section_id: "$section_id",
                                    subject_id: "$subject_id",
                                    title: "$projectworks_doc.project_work",
                                    maxMarks: "$projectworks_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$projectworks_doc.average_marks",
                                }
                            }
                        ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        })
                    },
                    function getSubjects(results, next) {
                        db.collection('subjects').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, subjectsResult) {
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
                                var projectworks = [];
                                var subjectMarks = 0;
                                var subjectmaxMarks = 0;
                                var count1 = 0;
                                for (j = 0; j < assessmentsDataLength; j++) {
                                    if (subject_id == assessments[j].subject_id) {
                                        var marks = parseInt(assessments[j].marks);
                                        var maxMarks = parseInt(assessments[j].maxMarks);
                                        var title = assessments[j].title;
                                        var average_marks = assessments[j].average_marks;
                                        subjectMarks += marks;
                                        subjectmaxMarks += maxMarks;
                                        count1++
                                        projectworks.push({ title: title, marks: marks, average_marks: average_marks })
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
                                subjects.push({ subject_id: subject_id, subject_name: subject_name, projectworks: projectworks, subjectMarks: subjectMarks, subjectmaxMarks: subjectmaxMarks, subjectpercentage: subjectpercentage, grade: grade })
                     
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

module.exports = router;