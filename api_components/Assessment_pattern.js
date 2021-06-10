// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var waterfall = require('async-waterfall');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var forEach = require('async-foreach').forEach;

var router = express.Router();
var url = config.dburl;

// Examination Pattern
router.route('/examination_pattern/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var classes = req.body.classes;
        var examinations = [];
        var count = 0

        mongo.connect(url, function (err, db) {
            var collection = db.collection('examination_pattern');
            collection.aggregate([
                {
                    $group: {
                        originalId: { $first: '$_id' },
                        _id: '$unique_code',
                        // examination_pattern_id: { $first: '$examination_pattern_id' },
                    }
                }, {
                    $project: {
                        _id: '$originalId',
                        id: '$_id',
                        // examination_pattern_id: '$examination_pattern_id',
                    }
                }
            ]).toArray(function (err, result) {
                console.log(result)
                var unique_code = result.length + 1;
                classes.forEach(function (cls) {
                    var assessments = [];
                    for (i = 1; i <= req.body.no_of_assessments; i++) {
                        var assessment = req.body.examination_title + '-' + i;
                        assessments.push({
                            Assessment: assessment,
                            assessment_mode: 'None',
                            max_marks: 0,
                        })
                    }
                    var item = {
                        examination_pattern_id: 'getauto',
                        unique_code: unique_code,
                        school_id: school_id,
                        class_id: cls.class_id,
                        assessment_type: req.body.assessment_type,
                        examination_title: req.body.examination_title,
                        no_of_assessments: req.body.no_of_assessments,
                        assessments: assessments,
                        total_marks: 0,
                        updated: 0,
                        status: 1
                    };

                    if (item.assessment_type == null || item.examination_title == null || item.no_of_assessments == null) {
                        res.end('null');
                    } else {
                        autoIncrement.getNextSequence(db, 'examination_pattern', function (err, autoIndex) {
                            collection.ensureIndex({
                                "examination_pattern_id" : 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                item.examination_pattern_id = 'PAT' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    count++;
                                    console.log(count)                                                          
                                    if (err) {
                                        if (err.code == 11000) {
                                            res.end('false');
                                        }
                                        res.end('false');
                                    } else {
                                        if (count === classes.length) {
                                            db.close();
                                            res.end('true');
                                        }
                                    }
                                });
                            })
                        })
                    }
                })
            })
        })
    })

router.route('/class_examination_pattern/:class_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var class_id = req.params.class_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('examination_pattern').find({ class_id: class_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    examination_pattern: resultArray
                });
            });
        });
    });

router.route('/all_examination_pattern/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('examination_pattern').find({ school_id: school_id, status: 1 });
            var cursor = db.collection('examination_pattern').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
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
                    $group: {
                        originalId: { $first: '$_id' },
                        _id: '$unique_code',
                        school_id: { $first: '$school_id' },
                        classes: { $addToSet: { 'examination_pattern_id': '$examination_pattern_id', 'class_id': '$class_id', 'name': '$class_doc.name' } },
                        examination_title: { $first: '$examination_title' },
                        no_of_assessments: { $first: '$no_of_assessments' },
                    }
                },
                {
                    $project: {
                        _id: '$originalId',
                        unique_code: '$_id',
                        school_id: '$school_id',
                        examination_title: '$examination_title',
                        no_of_assessments: '$no_of_assessments',
                        classes: '$classes',
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    examinations: resultArray
                });
            });
        });
    });

router.route('/edit_examination_pattern/:examination_pattern_id')
    .put(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var unique_code = req.body.unique_code;
        var examination_title = req.body.examination_title;
        var assessment_type = req.body.assessment_type;

        console.log(req.body)

        mongo.connect(url, function (err, db) {
            db.collection('examination_pattern').updateMany({ unique_code: unique_code }, {
                $set: {
                    examination_title: examination_title,
                    assessment_type: assessment_type
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('exam_schedule').updateMany({
                        unique_code: unique_code
                    }, {
                        $set: {
                            exam_title: examination_title,
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        } else {
                            db.collection('examination_pattern').find({unique_code: unique_code}).toArray(function (err, results) {
                                if(err) {
                                    res.end('false')
                                } else {
                                    if(results.length > 0) {
                                        results.forEach( function (doc) {
                                            var exam_id = doc.examination_pattern_id;
                                            db.collection('exams').updateMany({
                                                examination_pattern_id: exam_id
                                            }, {
                                                $set: {
                                                    exam_title: examination_title
                                                }
                                            }, function (err, result1) {
                                                if(err) {
                                                    res.send('false');
                                                } else {
                                                    db.collection('assessment_evaluation').updateMany({
                                                        examination_pattern_id: exam_id
                                                    }, {
                                                        $set: {
                                                            exam_title: examination_title
                                                        }
                                                    }, function (err, result1) {
                                                        if(err) {
                                                            res.send('false');
                                                        } else {
                                                            db.collection()
                                                            db.close();
                                                            res.send('true')
                                                        }
                                                    })
                                                }
                                            })
                                        })
                                    }
                                }
                            })
                        }
                    })
                }
            });
        });
    })

router.route('/delete_examination_pattern/:examination_pattern_id')
    .put(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var unique_code = req.body.unique_code;
        var class_id = req.body.class_id;
        var examination_title = req.body.examination_title;

        console.log(req.body)

        mongo.connect(url, function (err, db) {
            db.collection('examination_pattern').update({ examination_pattern_id: examination_pattern_id }, {
                $set: {
                    status: 0
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    console.log('Hello World')
                    db.collection('exam_schedule').update({
                        exam_title: examination_title,
                        unique_code: unique_code
                    }, {
                        $pull: {
                            "classes": { "class_id": class_id }
                        },
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        } else {
                            db.collection('exams').updateMany({
                                examination_pattern_id: examination_pattern_id
                            }, {
                                $set: {
                                    status: 0
                                }
                            }, function (err, result1) {
                                if(err) {
                                    res.send('false');
                                } else {
                                    db.close();
                                    res.send('true')
                                }
                            })
                        }
                    })
                }
            });
        });
    })

// Assessment Patterns
router.route('/assessment_pattern/:examination_pattern_id')
    .put(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var assessments = req.body.assessments;
        var no_of_assessments = assessments.length;
        var total_marks = 0;
        assessments.forEach(function (assessment) {
            total_marks += assessment.max_marks;
        })

        mongo.connect(url, function (err, db) {
            db.collection('examination_pattern').update({ examination_pattern_id: examination_pattern_id }, {
                $set: {
                    assessments: assessments,
                    total_marks: total_marks,
                    no_of_assessments: no_of_assessments,
                    updated: 1
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.end('true');
                }
            });
        });
    })

router.route('/add_assessment_pattern/:examination_pattern_id')
    .put(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var Assessment = req.body.Assessment;
        var assessment_mode = req.body.assessment_mode;
        var max_marks = req.body.max_marks;

        var assessment = {
            Assessment: Assessment,
            assessment_mode: assessment_mode,
            max_marks: max_marks
        }
        mongo.connect(url, function (err, db) {
            db.collection('examination_pattern').update({ examination_pattern_id: examination_pattern_id }, {
                $push: {
                    assessments: assessment
                },
                $inc: {
                    no_of_assessments: 1,
                    total_marks: max_marks
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                var collection = db.collection('exams')
                collection.find({ examination_pattern_id: examination_pattern_id }).toArray(function (err, result) {
                    if (result.length > 0) {
                        var examAssessments = {
                            Assessment: Assessment,
                            assessment_mode: assessment_mode,
                            max_marks: max_marks,
                            Exam_date: "",
                            Start_time: "",
                            End_time: "",
                            attendance_status: "Pending",
                        }
                        result.forEach(function (doc) {
                            var exam_paper_id = doc.exam_paper_id;
                            collection.update({ examination_pattern_id: examination_pattern_id, exam_paper_id: exam_paper_id }, {
                                $push: {
                                    exams: examAssessments
                                }
                            }, function (err, result1) {
                                if (err) {
                                    res.send('false')
                                } else {
                                    var Marks = {
                                        Assessment: Assessment,
                                        maxMarks: max_marks,
                                        marks: 0
                                    }
                                    db.collection('assessment_evaluation').updateMany({ exam_paper_id: exam_paper_id }, {
                                        $push: {
                                            Marks: Marks
                                        },
                                        $inc: {
                                            maxMarks: max_marks
                                        }
                                    }, function (err, result2) {
                                        db.close();
                                        res.end('true');
                                    })
                                }
                            })
                        })
                    } else {
                        db.close();
                        res.end('true');
                    }
                })
            });
        });
    })

router.route('/assessment_pattern/:examination_pattern_id')
    .get(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('examination_pattern').find({ examination_pattern_id: examination_pattern_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    assessment: resultArray
                });
            });
        });
    });

router.route('/delete_assessment_pattern/:examination_pattern_id')
    .put(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var assessment = req.body.assessment;
        var totalMarks = req.body.totalMarks;
        var no_of_assessments = (parseInt(req.body.no_of_assessments) - 1);
        var count = 0;

        mongo.connect(url, function (err, db) {
            db.collection('examination_pattern').update({ examination_pattern_id: examination_pattern_id },
                {
                    "$pull": {
                        "assessments": {
                            Assessment: assessment
                        }
                    },
                    $set: {
                        total_marks: totalMarks,
                        no_of_assessments: no_of_assessments
                    },
                },
                function (err, numAffected) {
                    if (numAffected.result.nModified === 1) {
                        var collection = db.collection('exams');
                        collection.find({ examination_pattern_id: examination_pattern_id }).toArray(function (err, result2) {
                            if (result2.length > 0) {
                                var exam_paper_id = result2[0].exam_paper_id;
                                collection.update({ examination_pattern_id: examination_pattern_id },
                                    {
                                        "$pull": {
                                            "exams": {
                                                Assessment: assessment
                                            }
                                        },
                                    }, function (err, result1) {
                                        if (err) {
                                            res.end('false')
                                        } else {
                                            db.collection('assessment_evaluation').find({ exam_paper_id: exam_paper_id }).toArray(function (err, result3) {
                                                if (result3.length > 0) {
                                                    result3.forEach(function (doc) {

                                                        var maxMarks = doc.maxMarks;
                                                        var Total_marks = parseInt(doc.Total_marks);
                                                        var Marks = doc.Marks;
                                                        var student_id = doc.student_id;
                                                        Marks.forEach(function (Mark) {
                                                            if (Mark.Assessment === assessment) {
                                                                Total_marks = (Total_marks - parseInt(Mark.marks));
                                                                maxMarks = (maxMarks - parseInt(Mark.maxMarks));
                                                            }
                                                        })
                                                        var percentage = (parseFloat(Total_marks) / parseFloat(maxMarks)) * 100;
                                                        if (percentage > 90 && percentage <= 100) {
                                                            var grade = "A1";
                                                            var gpa = 10;
                                                        } else if (percentage > 80 && percentage <= 90) {
                                                            var grade = "A2";
                                                            var gpa = 9;
                                                        } else if (percentage > 70 && percentage <= 80) {
                                                            var grade = "B1";
                                                            var gpa = 8;
                                                        } else if (percentage > 60 && percentage <= 70) {
                                                            var grade = "B2"
                                                            var gpa = 7;
                                                        } else if (percentage > 50 && percentage <= 60) {
                                                            var grade = "C1"
                                                            var gpa = 6;
                                                        } else if (percentage > 40 && percentage <= 50) {
                                                            var grade = "C2"
                                                            var gpa = 5;
                                                        } else if (percentage > 34 && percentage <= 40) {
                                                            var grade = "D"
                                                            var gpa = 4;
                                                        } else {
                                                            var grade = "E"
                                                            var gpa = 3;
                                                        };

                                                        db.collection('assessment_evaluation').update({ student_id: student_id, exam_paper_id: exam_paper_id },
                                                            {
                                                                "$pull": {
                                                                    "Marks": {
                                                                        Assessment: assessment
                                                                    }
                                                                },
                                                                $set: {
                                                                    maxMarks: maxMarks,
                                                                    Total_marks: Total_marks,
                                                                    Grade: grade,
                                                                    GPA: gpa
                                                                }
                                                            }, function () {
                                                                count++;
                                                                if (count === result3.length) {
                                                                    console.log('Hero')
                                                                    db.close();
                                                                    res.send('true')
                                                                }
                                                            }
                                                        )
                                                    })
                                                } else {
                                                    db.close();
                                                    res.send('true');
                                                }
                                            })
                                        }
                                    }
                                )
                            } else {
                                db.close();
                                res.send('true')
                            }
                        })
                    } else {
                        db.close();
                        res.send('false')
                    }
                });

        });
    })

module.exports = router;