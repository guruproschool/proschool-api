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
var waterfall = require('async-waterfall');

var router = express.Router();
var url = config.dburl;

// Add Assignments
router.route('/assignments/:section_id')
    .post(function (req, res, next) {
        var status = 1;
        var section_id = req.params.section_id;
        var lession_id = req.body.lession_id;
        var splited = lession_id.split("-");
        var school_id = splited[0];
        var subject_id = splited[0] + '-' + splited[1] + '-' + splited[2] + '-' + splited[3];

        // var chapter_name = req.params.chapter_name;
        books = [];
        var item = {
            assignment_id: 'getauto',
            section_id: section_id,
            lession_id: lession_id,
            school_id: school_id,
            assignment_title: req.body.assignment_title,
            subject_id: subject_id,
            assign_date: req.body.assign_date,
            maxMarks: req.body.maxMarks,
            due_date: req.body.due_date,
            description: req.body.description,
            submission: 'pending',
            average_marks: 0,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'assignments', function (err, autoIndex) {
                var collection = db.collection('assignments');
                collection.ensureIndex({
                    "assignment_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.assignment_title == null) {
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
                                        assignment_id: subject_id + '-AS' + id
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

// Get Assignments by lession_id
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

// Get Assignments by subject_id
router.route('/subject_assignments/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var subject_id = req.params.subject_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('assignments').find();
            var cursor = db.collection('assignments').aggregate([
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
                        "from": "assignment_marks",
                        "localField": "assignment_id",
                        "foreignField": "assignment_id",
                        "as": "assignment_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "assignment_id": "$assignment_id",
                        "assignment_title": "$assignment_title",
                        "lession_id": "$lession_id",
                        "chapter_title": "$chapter_doc.title",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "assign_date": "$assign_date",
                        "due_date": "$due_date",
                        "submission": "$submission",
                        "lession_status": "$chapter_doc.lession_status",
                        "topics": "$topic_doc",
                        "description": "$description",
                        "assignment_doc": "$assignment_doc",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                var totalMarks = 0;
                var assignmentMarks = doc.assignment_doc;
                assignmentMarks.forEach(function (assDoc, err) {
                    totalMarks += assDoc.marks
                })
                doc.avg_score = parseInt(totalMarks / assignmentMarks.length);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    assignments: resultArray
                });
            });
        });
    });

router.route('/student_assignments/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('assignments').aggregate([
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
                    "$project": {
                        "_id": "$_id",
                        "assignment_id": "$assignment_id",
                        "assignment_title": "$assignment_title",
                        "lession_id": "$lession_id",
                        "chapter_title": "$chapter_doc.title",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "assign_date": "$assign_date",
                        "due_date": "$due_date",
                        "submission": "$submission",
                        "lession_status": "$chapter_doc.lession_status",
                        "topics": "$topic_doc",
                        "description": "$description",
                        "avg_score": "$average_marks",
                    }
                }
            ])
            cursor.toArray(function (err, results) {
                assert.equal(null, err);
                var count = 0;
                results.forEach(function (doc) {

                    var topics = [];
                    doc.topics.forEach(function (topic) {
                        topics.push({ topic_name: topic.topic_name })
                    })
                    doc.topics = topics;

                    db.collection('assignment_marks').find({ assignment_id: doc.assignment_id, student_id: student_id }).toArray(function (err, result) {
                        if (result.length > 0) {
                            doc.assignment_doc = result[0];
                            doc.totalMarks = result[0].marks;
                        } else {
                            doc.assignment_doc = {
                                "_id": "",
                                "assignment_result_id": "",
                                "student_id": student_id,
                                "subject_id": subject_id,
                                "section_id": "",
                                "lession_id": doc.lession_id,
                                "school_id": "",
                                "assignment_id": doc.assignment_id,
                                "marks": 0
                            };
                            doc.totalMarks = 0;
                        }
                        count++;
                        // for(var key in doc) {
                        //     if(doc[key] === null) {
                        //         console.log(doc[key])
                        //         doc[key] = '';
                        //     }
                        // }
                        resultArray.push(doc);
                        if (count === results.length) {
                            db.close();
                            res.send({
                                assignments: resultArray
                            });
                        }
                    });
                })
            });
        });
    });

// Get Latest Assignments by section_id
router.route('/assignments_by_section/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        var subjects = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getClassSubjects(next) {

                        db.collection('subjects').find({
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
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        var Subject_assignments = [];
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var assignments = [];
                                console.log(subject_id)
                                db.collection('assignments').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            subject_id: subject_id,
                                            status: 1
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
                                            subject_id: "$subject_id",
                                            subject: "$subject_doc.name",
                                            assignment_id: "$assignment_id",
                                            assignment_title: "$assignment_title",
                                            lession_id: "$lession_id",
                                            chapter_name: "$coursework_doc.title",
                                            maxMarks: "$maxMarks",
                                            assign_date: "$assign_date",
                                            due_date: "$due_date",
                                            description: "$description",
                                            submission: "$submission"
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }

                                    if (results.length > 0) {
                                        subjectData.assignments = results;
                                    } else {
                                        subjectData.assignments = [{ assignment_title: "No Recent Assignments" }];
                                    }

                                    // if (results.length > 0) {
                                    //     var n = (results.length - 1)
                                    //     assignments.push(results[n])
                                    //     subjectData.assignments = assignments;
                                    // } else {
                                    //     subjectData.assignments = [{ assignment_title: "No Recent Assignments" }];
                                    // }

                                    if (subjectsResultLength == count) {

                                        next(null, subjectsResult);
                                    }

                                })
                            })
                        }
                    },
                    // function getSectionSubjectsData(result, next) {
                    //     var count = 0;
                    //     var subjectsResult = result;
                    //     var subjectsResultLength = result.length;
                    //     var resultArray = [];
                    //     if (subjectsResultLength == 0) {
                    //         next(null, []);
                    //     } else {
                    //         subjectsResult.forEach(function (subjectData) {
                    //             var subject_id = subjectData.subject_id;
                    //             var assign_date = assign_date;
                    //             subjectName = subjectData.name;

                    //             subjectAssignments = subjectData.assignments;
                    //             var assignments = [];

                    //             // if(subjectAssignments !== undefined) {

                    //             // }

                    //             if (subjectAssignments.length > 0) {
                    //                 for (i = 0; i < subjectAssignments.length; i++) {
                    //                     assignment_title = subjectAssignments[i].assignment_title;
                    //                     chapter_name = subjectAssignments[i].chapter_name;
                    //                     due_date = subjectAssignments[i].due_date;
                    //                     assignment_id = subjectAssignments[i].assignment_id;
                    //                     description = subjectAssignments[i].description;
                    //                     assignments.push({ assignment_id: assignment_id, assignment_title: assignment_title, chapter_name: chapter_name, due_date: due_date, description: description })
                    //                 }

                    //                 subjects.push({ subjectName: subjectName, assignments: assignments });
                    //                 console.log(subjects)
                    //             }
                    //             count++;
                    //             if (subjectsResultLength === count) {
                    //                 resultArray.push({ subjects: subjects })

                    //                 next(null, resultArray)
                    //             }
                    //         })
                    //     }
                    // }
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
    })

// Edit Assignments
router.route('/edit_assignments/:assignment_id')
    .put(function (req, res, next) {
        var myquery = { assignment_id: req.params.assignment_id };
        var req_assignment_title = req.body.assignment_title;
        var req_subject_id = req.body.subject_id;
        var req_lession_id = req.body.lession_id;
        var req_maxMarks = req.body.maxMarks;
        var req_due_date = req.body.due_date;
        var req_assign_date = req.body.assign_date;
        var req_description = req.body.description;
        console.log(req.params.assignment_id)
        mongo.connect(url, function (err, db) {
            db.collection('assignments').update(myquery, {
                $set: {
                    assignment_title: req_assignment_title,
                    subject_id: req_subject_id,
                    lession_id: req_lession_id,
                    maxMarks: req_maxMarks,
                    due_date: req_due_date,
                    assign_date: req_assign_date,
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

// Soft delete Assignments
router.route('/delete_assignments/:assignment_id')
    .put(function (req, res, next) {
        var myquery = { assignment_id: req.params.assignment_id };

        mongo.connect(url, function (err, db) {
            db.collection('assignments').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('assignment_marks').deleteMany(myquery, function (err, result) {
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

// Hard delete Assignments
router.route('/hard_delete_assignments/:assignment_id')
    .delete(function (req, res, next) {
        var myquery = { assignment_id: req.params.assignment_id };

        mongo.connect(url, function (err, db) {
            db.collection('assignments').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('assignment_marks').deleteMany(myquery, function (err, result) {
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

// Assignment Average Score
router.route('/assignment_avgScore/:assignment_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var totalMarks = 0;
        var assignment_id = req.params.assignment_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('assignment_marks').find({ assignment_id: assignment_id });
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

// Assignments by Date
router.route('/student_assignment/:date/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var select_date = req.params.date;
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSectionSubject(next) {
                        db.collection('subjects').find({
                            section_id: section_id,
                            status: 1
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
                        var Subject_assignments = [];
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                console.log(subject_id)
                                db.collection('assignments').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            subject_id: subject_id,
                                            assign_date: select_date,
                                            status: 1
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
                                            subject_id: "$subject_id",
                                            subject: "$subject_doc.name",
                                            assignment_id: "$assignment_id",
                                            assignment_title: "$assignment_title",
                                            lession_id: "$lession_id",
                                            chapter_name: "$coursework_doc.title",
                                            maxMarks: "$maxMarks",
                                            assign_date: "$assign_date",
                                            due_date: "$due_date",
                                            description: "$description"
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }

                                    subjectData.assignments = results;

                                    if (subjectsResultLength == count) {

                                        next(null, result);
                                    }

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

router.route('/assignment_marksbulk_eval/:section_id/:subject_id/:lession_id/:assignment_id')
    .post(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        var lession_id = req.params.lession_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var assignment_id = req.params.assignment_id;
        var totalMarks = 0;

        if (subject_id == null || section_id == null || !req.body.students) {
            res.end('No Data');
        } else if (req.body.students.length === 0) {
            res.end('No Students')
        } else {
            var count = 0;
            var count1 = 0;
            var count2 = 0;
            var students = req.body.students;
            mongo.connect(url, function (err, db) {

                async.waterfall(
                    [
                        function PostAssignmentMarks(next) {
                            var studentsLength = req.body.students.length;
                            students.forEach(function (studentData) {
                                if (studentData.marks !== null) {
                                    totalMarks += parseInt(studentData.marks);
                                    var item = {
                                        assignment_result_id: '',
                                        student_id: studentData.student_id,
                                        subject_id: subject_id,
                                        section_id: section_id,
                                        lession_id: lession_id,
                                        school_id: school_id,
                                        assignment_id: assignment_id,
                                        marks: parseInt(studentData.marks),
                                        status: 1
                                    };
                                    db.collection('assignment_marks').find({
                                        section_id: section_id,
                                        assignment_id: assignment_id,
                                        student_id: item.student_id
                                    }).count(function (e, triggerCount) {
                                        if (triggerCount > 0) {
                                            count2++;
                                            if (count2 == students.length) {
                                                next(null, 'All Student Marks have been Taken')
                                            }
                                        } else {
                                            autoIncrement.getNextSequence(db, 'assignment_marks', function (err, autoIndex) {
                                                var collection = db.collection('assignment_marks');
                                                collection.ensureIndex({
                                                    "assignment_result_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    if (item.subject_id == null || item.section_id == null || item.assignment_id == null || item.lession_id == null) {
                                                        next(null, 'null');;
                                                    } else {
                                                        collection.find({ assignment_id: assignment_id }).count(function (err, triggerCount) {
                                                            var id = triggerCount + 1;
                                                            item.assignment_result_id = item.student_id + '-' + item.assignment_id + '-M' + id;
                                                            collection.insertOne(item, function (err, result) {
                                                                // console.log(count + '2')
                                                                if (err) {
                                                                    console.log(err);
                                                                    next(null, 'false');
                                                                }
                                                                count++;
                                                                if ((count + count2) === studentsLength) {
                                                                    console.log(count)
                                                                    next(null, 'true');
                                                                }
                                                            });
                                                        })
                                                    }
                                                });
                                            })
                                        }
                                    });
                                }
                            });
                        },
                        function getAssignment(results, next) {
                            console.log(results)
                            if (results === 'true') {
                                var average_marks = (totalMarks / students.length);
                                db.collection('assignments').update({ assignment_id: assignment_id }, { $set: { submission: 'completed', average_marks: average_marks } }, function (err, result) {
                                    assert.equal(null, err);
                                    if (err) {
                                        next(null, 'false');
                                        // res.send('false');
                                    } else {
                                        next(null, 'true');
                                    }
                                });
                            } else if (results === 'false') {
                                next(null, 'false');
                            } else if (results === 'All Student Marks have been Taken') {
                                next(null, 'All Student Marks have been Taken');
                            } else if (results === 'null') {
                                next(null, 'null');
                            } else {
                                console.log(count)
                                console.log(students.length)
                                console.log('Hello-7')
                                next(null, 'Few Student Marks have been Taken');
                                // res.send('Few Student Marks have been Taken')
                            }
                        },
                    ],
                    function (err, result1) {
                        console.log(result1)
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
        }
    })

router.route('/assignment_marks/:school_id')
    .put(function (req, res, next) {
        var myquery = { school_id: req.params.school_id };
        mongo.connect(url, function (err, db) {
            db.collection('assignments').updateMany(myquery, {
                $set: {
                    average_marks: 0,
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


router.route('/assignment_marksbulk_eval/:assignment_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var assignment_id = req.params.assignment_id;

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
                                }
                            }
                        ]).sort({ roll_no: 1 }).toArray(function (err, results) {
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
                                var cursor = db.collection('assignment_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            assignment_id: assignment_id,
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
                                            "from": "assignments",
                                            "localField": "assignment_id",
                                            "foreignField": "assignment_id",
                                            "as": "assignment_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$assignment_doc"
                                    },
                                    {
                                        "$lookup": {
                                            "from": "coursework",
                                            "localField": "lession_id",
                                            "foreignField": "lession_id",
                                            "as": "lession_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$lession_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "assignment_result_id": "$assignment_result_id",
                                            "chapter_name": "$lession_doc.title",
                                            "subject_name": "$subject_doc.name",
                                            "assignment_name": "$assignment_doc.assignment_title",
                                            "max_marks": "$assignment_doc.maxMarks",
                                            "marks": "$marks",
                                        }
                                    },
                                    // {
                                    //     $sort: { roll_no: 1 }
                                    // }
                                ])
                                cursor.toArray(function (err, result1) {
                                    count++;
                                    if (result1.length > 0) {
                                        // result1[0].first_name = studentData.first_name;
                                        // result1[0].last_name = studentData.last_name;
                                        // result1[0].roll_no = studentData.roll_no;
                                        // result1[0].maxMarks = parseInt(result1[0].maxMarks);
                                        // result1[0].marks = parseInt(result1[0].marks);
                                        // resultArray.push(result1[0]);

                                        studentData.maxMarks = parseInt(result1[0].maxMarks);
                                        studentData.marks = parseInt(result1[0].marks);
                                        studentData.assignment_result_id = result1[0].assignment_result_id;
                                        studentData.subject_name = result1[0].subject_name;
                                        studentData.chapter_name = result1[0].chapter_name;
                                        studentData.assignment_name = result1[0].assignment_name;
                                    } else {
                                        studentData.maxMarks = '';
                                        studentData.marks = null;
                                        studentData.assignment_result_id = '';
                                        studentData.subject_name = '';
                                        studentData.chapter_name = '';
                                        studentData.assignment_name = '';

                                        // var doc = {
                                        //     _id: '',
                                        //     student_id: studentData.student_id,
                                        //     first_name: studentData.first_name,
                                        //     last_name: studentData.last_name,
                                        //     roll_no: studentData.roll_no,
                                        //     assignment_result_id: '',
                                        //     chapter_name: '',
                                        //     subject_name: '',
                                        //     assignment_name: '',
                                        //     max_marks: '',
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
                            assignment_marks: result2
                        });
                    }
                }
            );
        });
    });

router.route('/student_assignment_marks/:subject_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('assignment_marks').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
                        student_id: student_id,
                        status: 1
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
                        "from": "assignments",
                        "localField": "assignment_id",
                        "foreignField": "assignment_id",
                        "as": "assignment_doc"
                    }
                },
                {
                    "$unwind": "$assignment_doc"
                },
                {
                    "$lookup": {
                        "from": "coursework",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "lession_doc"
                    }
                },
                {
                    "$unwind": "$lession_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$student_doc.first_name",
                        "last_name": "$student_doc.last_name",
                        "chapter_name": "$lession_doc.title",
                        "subject_name": "$subject_doc.name",
                        "assignment_name": "$assignment_doc.assignment_title",
                        "marks": "$marks",
                        "maxMarks": "$assignment_doc.maxMarks",
                    }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    assignment_marks: resultArray
                });
            });
        });
    });

router.route('/assignments_day/:date/:section_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];

        var section_id = req.params.section_id;
        var student_id = req.params.student_id;
        var select_date = req.params.date;
        var assignment_doc = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            db.collection('assignments').aggregate([
                {
                    $match: {
                        section_id: section_id,
                        assign_date: select_date,
                        status: 1
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
                    "$lookup": {
                        "from": "topics",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "topic_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "assignment_id": "$assignment_id",
                        "assignment_title": "$assignment_title",
                        "lession_id": "$lession_id",
                        "chapter_title": "$chapter_doc.title",
                        "subject_id": "$subject_id",
                        "subject_name": "$subject_doc.name",
                        "maxMarks": "$maxMarks",
                        "assign_date": "$assign_date",
                        "due_date": "$due_date",
                        "submission": "$submission",
                        "lession_status": "$chapter_doc.lession_status",
                        "topics": "$topic_doc",
                        "description": "$description",
                        "avg_score": "$average_marks"
                    }
                }
            ]).sort({ subject_id: 1 }).toArray(function (err, resultt) {
                if(err) {
                    res.end('false');
                } else {
                    console.log(resultt)
                    if(resultt.length > 0) {
                        var count = 0
                        resultt.forEach(function (result) {
                            result.topics = result.topics.filter(data => data.status === 1);
                            if (result.submission === "completed") {
                                db.collection('assignment_marks').find({
                                    assignment_id: result.assignment_id,
                                    student_id: student_id,
                                    status: 1
                                }).toArray(function (err, result1) {
                                    if(result1.length > 0) {
                                        result.assignment_doc = result1[0];
                                        result.totalMarks = result1[0].marks;
                                    } else {
                                        result.assignment_doc = {
                                            "_id": "",
                                            "assignment_result_id": "",
                                            "student_id": student_id,
                                            "subject_id": result.subject_id,
                                            "section_id": section_id,
                                            "lession_id": result.lession_id,
                                            "school_id": "",
                                            "assignment_id": result.assignment_id,
                                            "marks": 0,
                                            "status": 1
                                        }
                                        result.totalMarks = 0;
                                    }
                                })                               
                            } else {
                                result.assignment_doc = {
                                    "_id": "",
                                    "assignment_result_id": "",
                                    "student_id": student_id,
                                    "subject_id": result.subject_id,
                                    "section_id": section_id,
                                    "lession_id": result.lession_id,
                                    "school_id": "",
                                    "assignment_id": result.assignment_id,
                                    "marks": 0,
                                    "status": 1
                                }
                                result.totalMarks = 0;
                            }
                            count++;
                            console.log(count)
                            if (count === resultt.length) {
                                db.close();
                                res.send(resultt);
                            }
                        })
                    } else {
                        db.close();
                        res.send([])
                    }
                }
            })
            // ]).sort({ subject_id: 1 }).forEach(function (doc, err) {
            //     assert.equal(null, err);
            //     var topics = [];
            //     doc.topics.forEach(function (topic) {
            //         if (topic.status === 1) {
            //             topics.push({ topic_name: topic.topic_name })
            //         }
            //     })
            //     doc.topics = topics;
            //     if (doc.assignment_doc) {
            //         doc.totalMarks = doc.assignment_doc.marks;
            //     } else {
            //         doc.totalMarks = 0;
            //     }
            //     resultArray.push(doc);
            // }, function () {
            //     var count = 0
            //     resultArray.forEach(function (result) {
            //         db.collection('assignment_marks').find({
            //             assignment_id: result.assignment_id,
            //             student_id: student_id,
            //             status: 1
            //         }).toArray(function (err, result1) {
            //             if(result1.length > 0) {
            //                 if (result.submission === "completed") {
            //                     result.assignment_doc = result1[0];
            //                 } else {
            //                     result.assignment_doc = {
            //                         "_id": "",
            //                         "assignment_result_id": "",
            //                         "student_id": student_id,
            //                         "subject_id": result.subject_id,
            //                         "section_id": section_id,
            //                         "lession_id": result.lession_id,
            //                         "school_id": "",
            //                         "assignment_id": result.assignment_id,
            //                         "marks": 0,
            //                         "status": 1
            //                     }
            //                 }
            //             } else {
            //                 result.assignment_doc = {
            //                     "_id": "",
            //                     "assignment_result_id": "",
            //                     "student_id": student_id,
            //                     "subject_id": result.subject_id,
            //                     "section_id": section_id,
            //                     "lession_id": result.lession_id,
            //                     "school_id": "",
            //                     "assignment_id": result.assignment_id,
            //                     "marks": 0,
            //                     "status": 1
            //                 }
            //             }
            //             count++;
            //             console.log(count)
            //             if (count === resultArray.length) {
            //                 db.close();
            //                 res.send(resultArray);
            //             }
            //         })
            //     })
            // });
        });
    });

router.route('/assignment_edit/:assignment_id/:name/:value')
    .post(function (req, res, next) {
        var assignment_id = req.params.assignment_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('assignments').update({ assignment_id }, {
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

// Modified
// Get Assignment Details By AssignmentId

router.route('/assignment_details/:assignment_id')
    .get(function (req, res, next) {
        var assignment_id = req.params.assignment_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('assignments').find({ assignment_id: assignment_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    assignment: resultArray
                });
            });
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

router.route('/bulk_upload_assignments/:section_id/:lession_id')
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
                                assignment_id: 'getauto',
                                section_id: section_id,
                                lession_id: lession_id,
                                school_id: school_id,
                                chapter_name: key.chaptername,
                                assignment_title: key.assignmenttitle,
                                subject_name: key.subjectname,
                                due_date: key.duedate,
                                description: key.description,
                                status: status,
                            };
                            mongo.connect(url, function (err, db) {
                                autoIncrement.getNextSequence(db, 'assignments', function (err, autoIndex) {

                                    var collection = db.collection('assignments');
                                    collection.ensureIndex({
                                        "assignment_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.section_id == null || item.assignment_title == null) {
                                            res.end('null');
                                        } else {
                                            item.assignment_id = 'ASMT-' + autoIndex;
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

router.route('/edit_assignments_marks/:assignment_result_id')
    .put(function (req, res, next) {
        var assignment_result_id = req.params.assignment_result_id;
        var myquery = { assignment_result_id: req.params.assignment_result_id };
        var splited = assignment_result_id.split('-');
        var assignment_id = splited[1] + '-' + splited[2] + '-' + splited[3] + '-' + splited[4] + '-' + splited[5];
        var req_marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            db.collection('assignment_marks').find({ assignment_id: assignment_id }).toArray(function (err, resultArray) {
                if (err) {
                    res.send('false')
                } else {
                    var total_marks = req_marks;
                    var resultArrayLength = resultArray.length;
                    console.log(resultArray)
                    resultArray.forEach(function (doc) {
                        if (doc.assignment_result_id !== assignment_result_id) {
                            total_marks += doc.marks;
                        }
                    })
                    var average_marks = parseInt(total_marks) / resultArrayLength;
                    db.collection('assignment_marks').update(myquery, {
                        $set: {
                            marks: req_marks
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        } else {
                            db.collection('assignments').update({ assignment_id: assignment_id }, {
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
                    });
                }
            })
        });
    });

router.route('/add_assignments_marks/:assignment_id/:school_id')
    .put(function (req, res, next) {
        var assignment_id = req.params.assignment_id;
        var school_id = req.params.school_id;
        var student_id = req.body.student_id;
        var subject_id = req.body.subject_id;
        var section_id = req.body.section_id;
        var lession_id = req.body.lession_id;
        var marks = req.body.marks;
        mongo.connect(url, function (err, db) {
            var item = {
                assignment_result_id: '',
                student_id: student_id,
                subject_id: subject_id,
                section_id: section_id,
                lession_id: lession_id,
                school_id: school_id,
                assignment_id: assignment_id,
                marks: parseInt(marks),
                status: 1
            };
            autoIncrement.getNextSequence(db, 'assignment_marks', function (err, autoIndex) {
                var data = db.collection('assignment_marks').find({
                    section_id: section_id,
                    assignment_id: assignment_id,
                    student_id: item.student_id
                }).count(function (e, triggerCount) {
                    if (triggerCount > 0) {
                        res.send('false');
                    } else {
                        var collection = db.collection('assignment_marks');
                        collection.ensureIndex({
                            "assignment_result_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.subject_id == null || item.section_id == null || item.assignment_id == null || item.marks == null) {
                                res.end('null');
                            } else {
                                collection.find({ assignment_id: assignment_id }).count(function (err, triggerCount1) {
                                    var id = triggerCount1 + 1;
                                    item.assignment_result_id = item.student_id + '-' + item.assignment_id + '-M' + id;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                            db.close();
                                            res.end('false');
                                        } else {
                                            db.collection('assignment_marks').find({ assignment_id: assignment_id }).toArray(function (err, resultArray) {
                                                if (err) {
                                                    res.send('false')
                                                } else {
                                                    var total_marks = 0;
                                                    var resultArrayLength = resultArray.length;
                                                    resultArray.forEach(function (doc) {
                                                        total_marks += doc.marks;
                                                    })
                                                    var average_marks = parseInt(total_marks) / resultArrayLength;
                                                    db.collection('assignments').update({ assignment_id: assignment_id }, {
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

router.route('/delete_assignments_marks/:assignment_result_id')
    .delete(function (req, res, next) {
        var myquery = { assignment_result_id: req.params.assignment_result_id };

        mongo.connect(url, function (err, db) {
            db.collection('assignment_marks').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/all_assignment_marks_by_subject_id/:subject_id/:section_id')
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
                                db.collection('assignment_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            section_id: section_id,
                                            subject_id: subject_id,
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "assignments",
                                            localField: "assignment_id",
                                            foreignField: "assignment_id",
                                            as: "assignments_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$assignments_doc"
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
                                            maxMarks: "$assignments_doc.maxMarks",
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
                            subject_id: subject_id,
                            status: 1
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
                                    var assignment_marks = [];

                                    for (i = 0; i < chaptersArrayLength; i++) {

                                        var assignments = [];
                                        lessionId = chaptersArray[i].lession_id;
                                        chapter_name = chaptersArray[i].title;
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {


                                            if (lessionId == assessments[j].lession_id) {
                                                //  console.log("hema");
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                assignment_title = assessments[j].assignment_title;
                                                totalMarks += marks;
                                                totalmaxMarks += maxMarks;
                                                count1++

                                                assignments.push({ assignment_title: assignment_title, marks: marks })

                                            }
                                            percentage = ((totalMarks / totalmaxMarks) * 100).toFixed(2);
                                            average = parseInt(totalMarks) / parseInt(count1);
                                        }
                                        assignment_marks.push({ lession_id: lessionId, chapter_name: chapter_name, assignments: assignments, totalMarks: totalMarks, average: average, percentage: percentage, totalAssignments: count1 })
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

router.route('/all_assignment_marks_by_section_id/:section_id')
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
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('assignment_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            section_id: section_id,
                                            status: 1
                                        },
                                    },
                                    {
                                        $lookup: {
                                            from: "assignments",
                                            localField: "assignment_id",
                                            foreignField: "assignment_id",
                                            as: "assignments_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$assignments_doc"
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
                                            maxMarks: "$assignments_doc.maxMarks",
                                            marks: "$marks"
                                        }
                                    }
                                ]).sort({ lession_id: 1 }).toArray(function (err, results) {
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
                    },
                    function getChapters(result, subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;
                        if (subjectsArrayLength == 0) {
                            next(null, [], []);
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
                                        next(null, result, subjectsResult);
                                    }
                                });
                            })

                        }
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
                                var first_name = studentData.first_name;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;

                                if (assessmentsDataLength == 0) {
                                    count++;

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

                                                var assignments = [];
                                                lessionId = chaptersArray[i].lession_id;
                                                chapter_name = chaptersArray[i].title;
                                                var totalMarks = 0;
                                                var totalmaxMarks = 0;
                                                var count1 = 0;
                                                for (j = 0; j < assessmentsDataLength; j++) {

                                                    if (lessionId == assessments[j].lession_id) {
                                                        marks = parseInt(assessments[j].marks);
                                                        if (marks === 'null' || marks === "N/A") {
                                                            marks = 0;
                                                        }
                                                        maxMarks = parseInt(assessments[j].maxMarks);
                                                        assignment_title = assessments[j].assignment_title;
                                                        totalMarks += marks;
                                                        totalmaxMarks += maxMarks;
                                                        count1++

                                                        assignments.push({ assignment_title: assignment_title, marks: marks })

                                                    }
                                                    if (assignments.length > 0) {
                                                        percentage = ((totalMarks / totalmaxMarks) * 100).toFixed(2);
                                                        average = parseInt(totalMarks) / parseInt(count1);

                                                    } else {
                                                        percentage = 0;
                                                        average = 0;
                                                    }

                                                }

                                                chapters.push({ lession_id: lessionId, chapter_name: chapter_name, assignments: assignments, totalMarks: totalMarks, average: average, percentage: percentage, totalAssignments: count1 })
                                                subjectMarks += totalMarks;
                                                subjectmaxMarks += totalmaxMarks;

                                                if (subjectmaxMarks === 0 || subjectmaxMarks === null || subjectmaxMarks === "N/A") {
                                                    var subjectpercentage = 0;
                                                } else {
                                                    var subjectpercentage = parseInt((subjectMarks / subjectmaxMarks) * 100);
                                                }
                                                console.log(subjectpercentage)
                                                if (subjectpercentage > 90 && subjectpercentage <= 100) {
                                                    var grade = 'Excellent';
                                                } else if (subjectpercentage > 70 && subjectpercentage <= 90) {
                                                    var grade = 'Good';
                                                } else if (subjectpercentage > 40 && subjectpercentage <= 70) {
                                                    var grade = 'Average';
                                                } else if (subjectpercentage >= 0 && subjectpercentage <= 40) {
                                                    var grade = 'Bad';
                                                }
                                            }
                                        } else {
                                            var subjectpercentage = 0;
                                        }

                                        subjects.push({ subject_id: subject_id, subject_name: subject_name, chapters: chapters, subjectMarks: subjectMarks, subjectmaxMarks: subjectmaxMarks, subjectpercentage: subjectpercentage, grade: grade })
                                    })

                                    count++;
                                }
                                studentsMarks.push({ student_id: student_id, student_name: studentName, roll_no: roll_no, first_name: first_name, subjects: subjects })

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

router.route('/all_assignment_marks_by_student_id/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionStudents(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('students').find({
                            student_id: student_id,
                            status: 1
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
                        var studentsResult = result[0];
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            var studentId = studentsResult.student_id;
                            db.collection('assignment_marks').aggregate([
                                {
                                    $match: {
                                        student_id: studentId,
                                        status: 1
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "assignments",
                                        localField: "assignment_id",
                                        foreignField: "assignment_id",
                                        as: "assignments_doc"
                                    }
                                },
                                {
                                    $unwind: "$assignments_doc"
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
                                        assignment_title: '$assignments_doc.assignment_title',
                                        maxMarks: "$assignments_doc.maxMarks",
                                        marks: "$marks",
                                        average_marks: "$assignments_doc.average_marks",
                                    }
                                }
                            ]).sort({ lession_id: 1 }).toArray(function (err, results) {
                                count++;
                                if (err) {
                                    next(err, null);
                                }
                                studentsResult.assessments = results
                                next(null, studentsResult);
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
                    },
                    function getChapters(result, subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;
                        if (subjectsArrayLength == 0) {
                            next(null, []);
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
                                        next(null, result, subjectsResult);
                                    }
                                });
                            })

                        }
                    },
                    function getAttendanceData(result, subjectsResult, next) {

                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;

                        var studentData = result;

                        var assessmentsDataLength = studentData.assessments.length;
                        var assessments = studentData.assessments;
                        var student_id = studentData.student_id;
                        var studentName = studentData.first_name + " " + studentData.last_name;
                        var roll_no = studentData.roll_no;

                        if (assessmentsDataLength == 0) {
                            count++;

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

                                        var assignments = [];
                                        lessionId = chaptersArray[i].lession_id;
                                        title = chaptersArray[i].title;
                                        var totalMarks = 0;
                                        var totalmaxMarks = 0;
                                        var count1 = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {

                                            if (lessionId == assessments[j].lession_id) {
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                assignment_title = assessments[j].assignment_title;
                                                average_marks = assessments[j].average_marks;
                                                totalMarks += marks;
                                                totalmaxMarks += maxMarks;
                                                count1++
                                                assignments.push({ assignment_title: assignment_title, marks: marks, average_marks: average_marks })
                                            }
                                            if (assignments.length > 0) {
                                                percentage = ((totalMarks / totalmaxMarks) * 100).toFixed(2);
                                                average = parseInt(totalMarks) / parseInt(count1);
                                            } else {
                                                percentage = 0;
                                                average = 0;
                                            }
                                        }
                                        chapters.push({ lession_id: lessionId, title: title, assignments: assignments, totalMarks: totalMarks, average: average, percentage: percentage, totalAssessments: count1 })
                                        subjectMarks += totalMarks;
                                        subjectmaxMarks += totalmaxMarks;
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
                                    }
                                } else {
                                    var subjectpercentage = 0;
                                    var grade = 'N/A';
                                }

                                subjects.push({ subject_id: subject_id, subject_name: subject_name, chapters: chapters, subjectMarks: subjectMarks, subjectmaxMarks: subjectmaxMarks, subjectpercentage: subjectpercentage, grade: grade })
                            })

                            count++;
                        }
                        studentsMarks.push({ student_id: student_id, student_name: studentName, subjects: subjects })

                        next(null, studentsMarks);
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

router.route('/assessment_marks_by_student_mobile/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var studentsResult = { student_id: student_id, assessments: [] };
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getsectionStudentsData(next) {
                        db.collection('assignment_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "assignments",
                                    localField: "assignment_id",
                                    foreignField: "assignment_id",
                                    as: "assignments_doc"
                                }
                            },
                            {
                                $unwind: "$assignments_doc"
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
                                    id: "$id",
                                    assessment: 'assignments',
                                    title: "$assignments_doc.assignment_title",
                                    maxMarks: "$assignments_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$assignments_doc.average_marks",
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            studentsResult.assessments.push(results)
                            next(null, studentsResult);
                        })
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
                    },
                    function getChapters(result, subjectsResult, next) {
                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;
                        if (subjectsArrayLength == 0) {
                            next(null, []);
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
                                        next(null, result, subjectsResult);
                                    }
                                });
                            })

                        }
                    },
                    function getStudentClassTests(result, subjectsResult, next) {
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
                                    as: "classTest_doc"
                                }
                            },
                            {
                                $unwind: "$classTest_doc"
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
                                    id: "$id",
                                    assessment: 'classtests',
                                    title: "$classTest_doc.title",
                                    maxMarks: "$classTest_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$classTest_doc.average_marks",
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, result3) {
                            if (err) {
                                next(err, null);
                            }
                            studentsResult.assessments.push(result3);
                            next(null, studentsResult, subjectsResult);
                        })
                    },
                    function getStudentProjectWorks(result, subjectsResult, next) {
                        db.collection('PW_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "projectworks",
                                    localField: "projectwork_id",
                                    foreignField: "projectwork_id",
                                    as: "projectwork_doc"
                                }
                            },
                            {
                                $unwind: "$projectwork_doc"
                            },
                            {
                                $project:
                                {
                                    section_id: "$section_id",
                                    subject_id: "$subject_id",
                                    id: "$id",
                                    assessment: 'projectworks',
                                    title: "$projectwork_doc.project_work",
                                    maxMarks: "$projectwork_doc.maxMarks",
                                    marks: "$marks",
                                    average_marks: "$projectwork_doc.average_marks",
                                }
                            }
                        ]).sort({ lession_id: 1 }).toArray(function (err, result4) {
                            if (err) {
                                next(err, null);
                            }
                            studentsResult.assessments.push(result4);
                            next(null, studentsResult, subjectsResult);
                        })
                    },
                    function getAttendanceData(result, subjectsResult, next) {

                        var count = 0;
                        var subjectsArray = subjectsResult;
                        var subjectsArrayLength = subjectsResult.length;

                        var studentData = result;

                        var assessmentsDataLength = studentData.assessments.length;
                        var assessments = studentData.assessments;
                        var student_id = studentData.student_id;
                        var studentName = studentData.first_name + " " + studentData.last_name;
                        var roll_no = studentData.roll_no;

                        if (assessmentsDataLength == 0) {
                            count++;

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

                                for (i = 0; i < chaptersArrayLength; i++) {

                                    var assignments = [];
                                    var classtests = [];
                                    var projectworks = [];
                                    lessionId = chaptersArray[i].lession_id;
                                    title = chaptersArray[i].title;
                                    var ass_totalMarks = 0;
                                    var ass_totalmaxMarks = 0;
                                    var ct_totalMarks = 0;
                                    var ct_totalmaxMarks = 0;
                                    var pw_totalMarks = 0;
                                    var pw_totalmaxMarks = 0;
                                    var ass_count = 0;
                                    var ct_count = 0;
                                    var pw_count = 0;
                                    for (j = 0; j < assessmentsDataLength; j++) {

                                        if (lessionId == assessments[j].lession_id) {

                                            if (assessments[j].assessment === 'assignments') {
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                title = assessments[j].title;
                                                average_marks = assessments[j].average_marks;
                                                ass_totalMarks += marks;
                                                ass_totalmaxMarks += maxMarks;
                                                ass_count++
                                                assignments.push({ title: title, marks: marks, average_marks: average_marks })
                                            } else if (assessments[j].assessment === 'classtests') {
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                title = assessments[j].title;
                                                average_marks = assessments[j].average_marks;
                                                ct_totalMarks += marks;
                                                ct_totalmaxMarks += maxMarks;
                                                ct_count++
                                                classtests.push({ title: title, marks: marks, average_marks: average_marks })
                                            } else if (assessments[j].assessment === 'projectworks') {
                                                marks = parseInt(assessments[j].marks);
                                                maxMarks = parseInt(assessments[j].maxMarks);
                                                title = assessments[j].title;
                                                average_marks = assessments[j].average_marks;
                                                pw_totalMarks += marks;
                                                pw_totalmaxMarks += maxMarks;
                                                pw_count++
                                                projectworks.push({ title: title, marks: marks, average_marks: average_marks })
                                            }
                                        }

                                        if (assignments.length > 0) {
                                            ass_percentage = ((ass_totalMarks / ass_totalmaxMarks) * 100).toFixed(2);
                                            ass_average = parseInt(ass_totalMarks) / parseInt(ass_count);
                                        } else {
                                            ass_percentage = 0;
                                            ass_average = 0;
                                        }

                                        if (classtests.length > 0) {
                                            ct_percentage = ((ct_totalMarks / ct_totalmaxMarks) * 100).toFixed(2);
                                            ct_average = parseInt(ct_totalMarks) / parseInt(ct_count);

                                        } else {
                                            ct_percentage = 0;
                                            ct_average = 0;
                                        }

                                        if (assignments.length > 0) {
                                            pw_percentage = ((pw_totalMarks / pw_totalmaxMarks) * 100).toFixed(2);
                                            pw_average = parseInt(pw_totalMarks) / parseInt(pw_count);

                                        } else {
                                            pw_percentage = 0;
                                            pw_average = 0;
                                        }

                                    }

                                    chapters.push({
                                        lession_id: lessionId, title: title,
                                        AssignmentMarks: ass_totalMarks, AssignmentAverage: ass_average, totalAssignments: ass_count,
                                        ClasstestMarks: ct_totalMarks, ClasstestAverage: ct_average, totalClasstests: ct_count,
                                        AssignmentMarks: pw_totalMarks, AssignmentAverage: pw_average, totalAssignments: pw_count,
                                    })

                                    // subjectMarks += totalMarks;
                                    // subjectmaxMarks += totalmaxMarks;
                                    // var subjectpercentage = ((subjectMarks / subjectmaxMarks) * 100).toFixed(2);
                                    // if (subjectpercentage > 90 && subjectpercentage <= 100) {
                                    //     var grade = 'Excellent';
                                    // } else if (subjectpercentage > 70 && subjectpercentage <= 90) {
                                    //     var grade = 'Good';
                                    // } else if (subjectpercentage > 40 && subjectpercentage <= 70) {
                                    //     var grade = 'Average';
                                    // } else if (subjectpercentage >= 0 && subjectpercentage <= 40) {
                                    //     var grade = 'Bad';
                                    // }
                                }
                                subjects.push({ subject_id: subject_id, subject_name: subject_name, chapters: chapters })
                            })
                            count++;
                        }
                        studentsMarks.push({ student_id: student_id, student_name: studentName, subjects: subjects })
                        next(null, studentsMarks);
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

router.route('/student_assignment_marks_by_chapter_id/:student_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var subject_id = req.params.subject_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getsectionStudentsData(next) {

                        db.collection('assignment_marks').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                    subject_id: subject_id,
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
                                    student_id: "$student_id",
                                    student_name: "$student_doc.first_name",
                                    lession_id: "$lession_id",
                                    subject_id: "$subject_id",
                                    subject: "$subject_doc.name",
                                    chapter_name: "$coursework_doc.title",
                                    assignment_id: "$assignment_id",
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
                        //  console.log(results);

                        var data = db.collection('coursework').find({
                            subject_id: subject_id,
                            status: 1
                        }).toArray(function (err, chaptersResult) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, results, chaptersResult);
                        });
                    }, function getAttendanceData(results, chaptersResult, next) {

                        //  console.log(results);

                        var count = 0;

                        var assignmentResult = results;
                        var assignmentResultLength = results.length;
                        var chaptersArray = chaptersResult;
                        var chaptersArrayLength = chaptersArray.length;
                        var student_id = assignmentResult[0].student_id;
                        var student_name = assignmentResult[0].student_name;
                        var subject_id = assignmentResult[0].subject_id;
                        var subject = assignmentResult[0].subject;

                        console.log(chaptersArray)
                        if (chaptersArrayLength == 0) {
                            next(null, []);
                        } else {
                            var chapter_marks = [];
                            chaptersArray.forEach(function (chapterData) {

                                var chaptersData = chapterData;
                                var chapter_name = chapterData.title;
                                var chapter_id = chapterData.lession_id;

                                console.log(chapter_name)

                                for (i = 0; i < assignmentResultLength; i++) {

                                    var count1 = 0;
                                    var assignments = [];

                                    var totalMarks = 0;
                                    var percentage = 0;

                                    chapter = assignmentResult[i].chapter_name;
                                    lession_id = assignmentResult[i].lession_id;

                                    if (chapter_id == lession_id) {

                                        marks = parseInt(assignmentResult[i].marks);
                                        assignment_id = assignmentResult[i].assignment_id;
                                        totalMarks += marks;
                                        assignments.push({ assignment_id: assignment_id, marks: marks })
                                        count1++;
                                        percentage = (totalMarks / parseInt(count1));
                                        chapter_marks.push({ chapter_name: chapter_name, lession_id: lession_id, assignments: assignments, totalMarks: totalMarks, percentage: percentage })
                                    }

                                }

                                count++;
                                // classAttendance.push(attendanceSection);

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

module.exports = router;