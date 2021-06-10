// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;

// Add Exams
router.route('/exams/:section_id/:examination_pattern_id/:subject_id/:school_id')
    .post(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var school_id = req.params.school_id;
        var section_id = req.params.section_id;
        var examination_pattern_id = req.params.examination_pattern_id;
        var exampattern = req.body.exams;
        var exams = exampattern[0].assessments;
        var examination_pattern_id = exampattern[0].examination_pattern_id;
        var item = {
            exam_paper_id: 'getauto',
            subject_id: subject_id,
            section_id: section_id,
            examination_pattern_id: examination_pattern_id,
            school_id: school_id,
            exams: exams,
            status: 1,
        };
        console.log(item)
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'exams', function (err, autoIndex) {
                var collection = db.collection('exams');
                collection.ensureIndex({
                    "exam_paper_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.subject_id == null || item.examination_pattern_id == null || item.exams == []) {
                        res.end('null');
                    } else {
                        collection.find({ subject_id: subject_id, examination_pattern_id: item.examination_pattern_id, status: 1 }).count(function (err, triggerCount1) {
                            if (triggerCount1 > 0) {
                                res.send({ data: 'Exam is already Scheduled' })
                            } else {
                                collection.find({ section_id: section_id }).count(function (err, triggerCount) {
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
                                                exam_paper_id: section_id + '-EX' + id
                                            }
                                        }, function (err, result) {
                                            db.close();
                                            res.end('true');
                                        });
                                    });
                                })
                            }
                        })
                    }
                });
            });
        });

    })

// GET Exam Papers for Web
router.route('/exams/:examination_pattern_id/:section_id')
    .get(function (req, res, next) {

        var examination_pattern_id = req.params.examination_pattern_id;
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getExamPapers(next) {
                        var cursor = db.collection('exams').aggregate([{
                            $match: {
                                examination_pattern_id: examination_pattern_id,
                                section_id: section_id,
                                status: 1
                            }
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "subject_id",
                                foreignField: "subject_id",
                                as: "subjects"
                            }
                        },
                        {
                            $unwind: "$subjects"
                        },

                        {
                            $group: {
                                _id: '$_id',
                                "exam_paper_id": { "$first": "$exam_paper_id" },
                                "subject_id": { "$first": "$subject_id" },
                                "examination_pattern_id": { "$first": "$examination_pattern_id" },
                                "exams": { "$first": "$exams" },
                                "section_id": { "$first": "$section_id" },
                                "subject_name": { "$first": "$subjects.name" },
                            }
                        }
                        ]).sort({ 'exams.Exam_date': 1, 'exams.Start_time': 1 });
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getExamStatus(result, next) {
                        var count = 0;
                        var ExamPaperResult = result;
                        var ExamPaperResultLength = result.length;
                        if (ExamPaperResultLength == 0) {
                            next(null, []);
                        } else {
                            ExamPaperResult.forEach(function (examData) {
                                var subject_id = examData.subject_id;
                                var examination_pattern_id = examData.examination_pattern_id;
                                db.collection('assessment_evaluation').find({
                                    subjectId: subject_id,
                                    examination_pattern_id: examination_pattern_id,
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        examData.exam_status = 'completed';
                                    } else {
                                        examData.exam_status = 'pending';
                                    }
                                    count++;
                                    if (ExamPaperResultLength === count) {
                                        next(null, ExamPaperResult);
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
                        res.send({ exams: result1 });
                    }
                }
            )
        });
    });

// GET Exam Papers for Mobile
router.route('/exams_mobile/:examination_pattern_id/:section_id')
    .get(function (req, res, next) {
        var examination_pattern_id = req.params.examination_pattern_id;
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getStudents(next) {
                        db.collection('students').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, result1) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result1);
                        });
                    },
                    function getExamPapers(result1, next) {
                        var cursor = db.collection('exams').aggregate([{
                            $match: {
                                examination_pattern_id: examination_pattern_id,
                                section_id: section_id,
                                status: 1
                            }
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "subject_id",
                                foreignField: "subject_id",
                                as: "subjects"
                            }
                        },
                        {
                            $unwind: "$subjects"
                        },
                        {
                            "$project": {
                                "exam_paper_id": "$exam_paper_id",
                                "subject_id": "$subject_id",
                                "examination_pattern_id": "$examination_pattern_id",
                                "exams": "$exams",
                                "section_id": "$section_id",
                                "subject_name": "$subjects.name",
                            }
                        }
                        ]).sort({ 'exams.Exam_date': 1, 'exams.Start_time': 1 });
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null, null);
                            } else {
                                next(null, result1, result);
                            }
                        });
                    },
                    function getExamAttendance(result1, result, next) {
                        var count1 = 0;
                        var studentsResultLength = result1.length;
                        var ExamPaperResult = result;
                        var ExamPaperResultLength = result.length;
                        if (studentsResultLength === 0 || ExamPaperResultLength === 0) {
                            next(null, [], []);
                        } else if (studentsResultLength === null || ExamPaperResultLength === null) {
                            next(null, null);
                        } else {
                            ExamPaperResult.forEach(function (examData) {
                                if (examData.exams.length === 0) {
                                    next(null, result1, ExamPaperResult);
                                } else {
                                    var examination_pattern_id = examData.examination_pattern_id;
                                    var subject_id = examData.subject_id;
                                    examData.exams.forEach(function (assMData) {
                                        var Assessment = assMData.Assessment;
                                        db.collection('ExamAttendance').aggregate([
                                            {
                                                $match: {
                                                    section_id: section_id,
                                                    subject_id: subject_id,
                                                    examination_pattern_id: examination_pattern_id,
                                                }
                                            },
                                            { $unwind: '$exams' },
                                            {
                                                $match: {
                                                    'exams.Assessment': Assessment,
                                                }
                                            },
                                            {
                                                "$project": {
                                                    "status": "$exams.status"
                                                }
                                            }
                                        ]).toArray(function (err, result2) {
                                            if (err) {
                                                next(err, null);
                                            }
                                            if (result2.length === studentsResultLength) {
                                                assMData.attendance_status = 'Attendance Taken';
                                            } else {
                                                assMData.attendance_status = 'Attendance Not Taken';
                                            }
                                        });
                                    })
                                    count1++;
                                    if (ExamPaperResultLength === count1) {
                                        next(null, result1, ExamPaperResult);
                                    }
                                }
                            })
                        }
                    },
                    function getExamStatus(result1, result2, next) {
                        var count = 0;
                        var studentsResultLength = result1.length;
                        var ExamPaperResult = result2;
                        var ExamPaperResultLength = result2.length;
                        if (studentsResultLength === 0 || ExamPaperResultLength === 0) {
                            next(null, []);
                        } else if (studentsResultLength === null || ExamPaperResultLength === null) {
                            next(null, null);
                        } else {
                            ExamPaperResult.forEach(function (examData) {
                                var subject_id = examData.subject_id;
                                var examination_pattern_id = examData.examination_pattern_id;
                                examData.exams.forEach(function (assM, err) {
                                    var pending_Ass = 0;
                                    assM.total_score = 0;
                                    assM.exam_status = 'pending';
                                    if (assM.Exam_date === "") {
                                        assM.Exam_date = null;
                                        assM.Start_time = null;
                                        assM.End_time = null;
                                        assM.avg_score = 0;
                                        pending_Ass++;
                                    }
                                })
                                db.collection('assessment_evaluation').find({
                                    subjectId: subject_id,
                                    examination_pattern_id: examination_pattern_id,
                                }).toArray(function (err, results) {
                                    var completed_Ass = 0;
                                    var pending_Ass = 0;
                                    examData.exams.forEach(function (assM, err) {
                                        if (assM.exam_status === 'completed') {
                                            assM.total_score = 0;
                                            completed_Ass++;
                                        } else if (assM.exam_status === 'pending') {
                                            assM.total_score = 0;
                                            pending_Ass++;
                                        }
                                    })
                                    if (results.length > 0) {
                                        results.forEach(function (doc, err) {
                                            var assessments = doc.Marks;
                                            // examData.exams
                                            var completed_Ass = 0;
                                            for (i = 0; i < assessments.length; i++) {
                                                if (assessments[i].Assessment === examData.exams[i].Assessment) {
                                                    examData.exams[i].total_score += parseInt(assessments[i].marks);
                                                    examData.exams[i].exam_status = 'completed';
                                                    examData.exams[i].avg_score = parseInt(examData.exams[i].total_score / studentsResultLength);
                                                    completed_Ass++;
                                                }
                                            }
                                            examData.completion_status = parseFloat(completed_Ass / examData.exams.length) * 100;
                                            if (examData.completion_status === 100) {
                                                examData.exam_status = 'completed';
                                            } else {
                                                examData.exam_status = 'pending';
                                            }
                                        })
                                    } else {
                                        examData.exam_status = 'pending';
                                        examData.completion_status = 0;
                                    }
                                    count++;
                                    if (ExamPaperResultLength === count) {
                                        next(null, ExamPaperResult);
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
                        res.send({ exams: result1 });
                    }
                }
            )
        });
    });

// GET Exam Papers for Parents Mobile 
router.route('/exams_mobile/:examination_pattern_id/:student_id/:section_id')
    .get(function (req, res, next) {

        var examination_pattern_id = req.params.examination_pattern_id;
        var student_id = req.params.student_id;
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getExamPapers(next) {
                        var cursor = db.collection('exams').aggregate([{
                            $match: {
                                examination_pattern_id: examination_pattern_id,
                                section_id: section_id,
                                status: 1
                            }
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "subject_id",
                                foreignField: "subject_id",
                                as: "subjects"
                            }
                        },
                        {
                            $unwind: "$subjects"
                        },

                        {
                            $group: {
                                _id: '$_id',
                                "exam_paper_id": { "$first": "$exam_paper_id" },
                                "subject_id": { "$first": "$subject_id" },
                                "examination_pattern_id": { "$first": "$examination_pattern_id" },
                                "exams": { "$first": "$exams" },
                                "section_id": { "$first": "$section_id" },
                                "subject_name": { "$first": "$subjects.name" },
                            }
                        }
                        ]).sort({ 'exams.Exam_date': 1, 'exams.Start_time': 1 });
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getExamAttendance(result, next) {
                        var count1 = 0;
                        var ExamPaperResult = result;
                        var ExamPaperResultLength = result.length;
                        if (ExamPaperResultLength == 0) {
                            next(null, []);
                        } else {
                            ExamPaperResult.forEach(function (examData) {
                                examData.exams.forEach(function (assMData) {
                                    var exam_date = assMData.Exam_date;
                                    var subject_id = examData.subject_id;
                                    db.collection('ExamAttendance').find({
                                        subject_id: subject_id,
                                        student_id: student_id,
                                        examination_pattern_id: examination_pattern_id,
                                    }).toArray(function (err, result2) {
                                        if (err) {
                                            next(err, null);
                                        }
                                        console.log(result2)
                                        if (result2.length > 0) {
                                            if (result2[0].exams.length === examData.exams.length) {
                                                assMData.attendance_status = 'Attendance Taken';
                                            } else if (result2.exams.length < examData.exams.length) {
                                                assMData.attendance_status = 'Attendance Partially Taken';
                                            }
                                        } else {
                                            assMData.attendance_status = 'Attendance Not Taken';
                                        }
                                    });
                                })
                                count1++;
                                if (ExamPaperResultLength === count1) {
                                    next(null, ExamPaperResult);
                                }
                            })
                        }
                    },
                    function getExamStatus(result, next) {
                        var count = 0;
                        var ExamPaperResult = result;
                        var ExamPaperResultLength = result.length;
                        if (ExamPaperResultLength == 0) {
                            next(null, []);
                        } else {
                            ExamPaperResult.forEach(function (examData) {
                                var subject_id = examData.subject_id;
                                var examination_pattern_id = examData.examination_pattern_id;
                                examData.exams.forEach(function (assM, err) {
                                    assM.total_score = 0;
                                    assM.exam_status = 'pending';
                                })
                                db.collection('assessment_evaluation').find({
                                    subjectId: subject_id,
                                    student_id: student_id,
                                    examination_pattern_id: examination_pattern_id,
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        results.forEach(function (doc, err) {
                                            var assessments = doc.Marks;
                                            examData.exams
                                            for (i = 0; i < assessments.length; i++) {
                                                if (assessments[i].Assessment === examData.exams[i].Assessment) {
                                                    examData.exams[i].total_score = parseInt(assessments[i].marks);
                                                    examData.exams[i].exam_status = 'completed';
                                                }
                                            }
                                        })
                                        var completed_Ass = 0;
                                        var pending_Ass = 0;
                                        examData.exams.forEach(function (assM, err) {
                                            if (assM.exam_status === 'completed') {
                                                completed_Ass++;
                                            } else if (assM.exam_status === 'pending') {
                                                pending_Ass++;
                                            }
                                        })
                                        examData.exam_status = 'completed';
                                        examData.completion_status = parseFloat(completed_Ass / examData.exams.length) * 100;

                                    } else {
                                        examData.exam_status = 'pending';
                                        examData.completion_status = 0;
                                    }

                                    count++;
                                    if (ExamPaperResultLength === count) {
                                        next(null, ExamPaperResult);
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
                        res.send({ exams: result1 });
                    }
                }
            )
        });
    });

// GET Exam Paper Details
router.route('/exams/:exam_paper_id')
    .put(function (req, res, next) {
        var myquery = { exam_paper_id: req.params.exam_paper_id };
        var exams = req.body.exams;

        console.log(exams)

        mongo.connect(url, function (err, db) {
            db.collection('exams').update(myquery, {
                $set: {
                    exams: exams,
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
    })

// GET Exam Papers by Subject and Examination
router.route('/exams/:examination_pattern_id/:section_id/:subject_id')
    .get(function (req, res, next) {

        var examination_pattern_id = req.params.examination_pattern_id;
        var subject_id = req.params.subject_id;
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getExamPapers(next) {
                        var cursor = db.collection('exams').aggregate([
                            {
                                $match: {
                                    examination_pattern_id: examination_pattern_id,
                                    section_id: section_id,
                                    subject_id: subject_id,
                                    status: 1
                                }
                            },
                            {
                                $lookup: {
                                    from: "subjects",
                                    localField: "subject_id",
                                    foreignField: "subject_id",
                                    as: "subjects"
                                }
                            },
                            {
                                $unwind: "$subjects"
                            },
                            {
                                $lookup: {
                                    from: "examination_pattern",
                                    localField: "examination_pattern_id",
                                    foreignField: "examination_pattern_id",
                                    as: "patterns"
                                }
                            },
                            {
                                $unwind: "$patterns"
                            },
                            {
                                $group: {
                                    _id: '$_id',
                                    "exam_paper_id": { "$first": "$exam_paper_id" },
                                    "subject_id": { "$first": "$subject_id" },
                                    "subject_name": { "$first": "$subjects.name" },
                                    "assessments": { "$first": "$exams" },
                                    "patterns": { "$first": "$patterns.assessments" },
                                }
                            }
                        ]).sort({ 'exams.Exam_date': 1, 'exams.Start_time': 1 });
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else {
                                if (result.length > 0) {
                                    var counter = 0;
                                    var maxMarks = 0;
                                    result[0].assessments.forEach(function (exam) {
                                        var exam_date = new Date(exam.Exam_date);
                                        var current_date = new Date();
                                        if (exam_date.getTime() > current_date.getTime()) {
                                            counter++;
                                        }
                                    })
                                    result[0].patterns.forEach(function (ass) {
                                        maxMarks += ass.max_marks;
                                    })
                                    result[0].maxMarks = maxMarks;
                                    if (counter > 0) {
                                        result[0].exam_status = 'Pending';
                                    } else {
                                        result[0].exam_status = 'Completed';
                                    }
                                    delete result[0].patterns;
                                }
                                next(null, result);
                            }
                        });
                    },
                    function getStudentsAttendance(result, next) {
                        if (result.length > 0) {
                            var count = 0;
                            db.collection('students').find({
                                section_id: section_id,
                                status: 1
                            }).count(function (err, count1) {
                                var totalcount = 0;
                                result[0].assessments.forEach(function (exam) {
                                    var Assessment = exam.Assessment;
                                    db.collection('ExamAttendance').aggregate([
                                        {
                                            $match: {
                                                section_id: section_id,
                                                subject_id: subject_id,
                                                examination_pattern_id: examination_pattern_id,
                                            }
                                        },
                                        { $unwind: '$exams' },
                                        {
                                            $match: {
                                                'exams.Assessment': Assessment,
                                            }
                                        },
                                        {
                                            "$project": {
                                                "status": "$exams.status"
                                            }
                                        }
                                    ]).toArray(function (err, resultt) {
                                        count++;
                                        if (err) {
                                            res.end('false')
                                        } else {
                                            if (count1 === resultt.length) {
                                                totalcount += 1;
                                                exam.attendance_status = "Taken";
                                            } else {
                                                totalcount += 0;
                                                exam.attendance_status = "Pending";
                                            }
                                        }
                                        if (count === result[0].assessments.length) {
                                            if (result[0].assessments.length === totalcount) {
                                                result[0].attendance_status = "Taken";
                                            } else {
                                                result[0].attendance_status = "Pending";
                                            }
                                            next(null, result)
                                        }
                                    })
                                })
                            })
                        } else {
                            next(null, result)
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

// POST Assessment Marks by Subject and Examination for Web
router.route('/assessment_marksbulk_eval/:examination_pattern_id/:section_id/:subjectId')
    .post(function (req, res, next) {

        var subjectId = req.params.subjectId;
        var section_id = req.params.section_id;
        var examination_pattern_id = req.params.examination_pattern_id;
        var splited = section_id.split("-");
        var school_id = splited[0];

        var assessmentMarks = [];
        console.log(req.body);

        var marksArray = req.body.studentsMarks;
        var exam_paper_id = marksArray[0].exam_paper_id;

        var marksArrayLength = marksArray.length;
        var studentAssessmentMarks = [];


        for (i = 0; i < marksArrayLength; i++) {

            studentId = marksArray[i].student_id;
            assMarks = marksArray[i].assMarks;
            assMarksLength = assMarks.length;
            var Marks = [];
            var Total_maxMarks = 0;
            var Total_marks = 0;
            var percentage = 0;

            for (j = 0; j < assMarksLength; j++) {

                marks = assMarks[j].marks;
                innerCode = assMarks[j].Assessment;
                ind_maxMarks = assMarks[j].maxMarks;
                var ind_marks = {};
                ind_marks["Assessment"] = innerCode;
                ind_marks["maxMarks"] = ind_maxMarks;
                if (marks == null || marks == "" || marks == undefined) {
                    ind_marks["marks"] = 0;
                    Total_marks += 0;
                } else {
                    ind_marks["marks"] = marks;
                    Total_marks += parseFloat(marks);
                }
                Total_maxMarks += parseFloat(ind_maxMarks);
                Marks.push(ind_marks);
            }

            percentage = (parseFloat(Total_marks) / parseFloat(Total_maxMarks)) * 100;

            if (percentage > 90 && percentage <= 100) {
                grade = "A1", gpa = 10;
            } else if (percentage > 80 && percentage <= 90) {
                grade = "A2", gpa = 9;
            } else if (percentage > 70 && percentage <= 80) {
                grade = "B1", gpa = 8;
            } else if (percentage > 60 && percentage <= 70) {
                grade = "B2", gpa = 7;
            } else if (percentage > 50 && percentage <= 60) {
                grade = "C1", gpa = 6;
            } else if (percentage > 40 && percentage <= 50) {
                grade = "C2", gpa = 5;
            } else if (percentage > 34 && percentage <= 40) {
                grade = "D", gpa = 4;
            } else {
                grade = "E", gpa = 3;
            };
            studentAssessmentMarks.push({ student_id: studentId, Marks: Marks, Total_marks: Total_marks, Total_maxMarks: Total_maxMarks, grade: grade, GPA: gpa })
        }
        //  console.log(studentAssessmentMarks);

        if (examination_pattern_id == null || section_id == null) {
            res.end('null');
        } else {
            var count = 0;
            if (studentAssessmentMarks.length > 0) {
                forEach(studentAssessmentMarks, function (key, value) {

                    var item = {
                        assessment_result_id: '',
                        school_id: school_id,
                        student_id: key.student_id,
                        section_id: section_id,
                        subjectId: subjectId,
                        examination_pattern_id: examination_pattern_id,
                        exam_paper_id: exam_paper_id,
                        maxMarks: key.Total_maxMarks,
                        Marks: key.Marks,
                        Total_marks: key.Total_marks,
                        Grade: key.grade,
                        GPA: key.GPA
                    };

                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'assessment_evaluation', function (err, autoIndex) {
                            var data = db.collection('assessment_evaluation').find({
                                section_id: section_id,
                                examination_pattern_id: examination_pattern_id,
                                subjectId: subjectId,
                                student_id: item.student_id
                            }).count(function (e, triggerCount) {

                                if (triggerCount > 0) {
                                    count++;
                                    if (count == studentAssessmentMarks.length) {
                                        console.log({ 'count1': count })
                                        res.send('false');
                                    }
                                } else {
                                    console.log({ 'count2': count })
                                    var collection = db.collection('assessment_evaluation');
                                    collection.ensureIndex({
                                        "assessment_result_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.section_id == null || item.examination_pattern_id == null || item.Marks == null || item.subjectId == null) {
                                            res.end('null');
                                        } else {
                                            collection.find({ exam_paper_id: exam_paper_id, student_id: item.student_id }).count(function (err, triggerCount) {
                                                var id = triggerCount + 1;
                                                item.assessment_result_id = exam_paper_id + '-' + item.student_id + '-M' + id;
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

                                                    if (count == studentAssessmentMarks.length) {
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

// POST Assessment Marks by Subject and Examination for Mobile
router.route('/assessment_marksbulk_eval_mobile/:exam_paper_id/:examination_pattern_id/:section_id/:subjectId')
    .post(function (req, res, next) {
        var resultArray = [];

        var subjectId = req.params.subjectId;
        var section_id = req.params.section_id;
        var examination_pattern_id = req.params.examination_pattern_id;
        var exam_paper_id = req.params.exam_paper_id;
        var splited = section_id.split("-");
        var school_id = splited[0];

        var marksArray = req.body.students;
        var marksArrayLength = marksArray.length;

        if (examination_pattern_id == null || section_id == null) {
            res.end('null');
        } else {
            if (marksArrayLength > 0) {
                var count = 0;
                marksArray.forEach(function (key) {
                    var studentId = key.student_id;
                    var assMarks = key.assMarks;
                    var Marks = [];
                    var Total_maxMarks = assMarks.maxMarks;
                    var Total_marks = assMarks.marks;
                    Marks.push(assMarks);
                    console.log(Total_maxMarks)
                    console.log(assMarks.maxMarks)

                    var percentage = (parseFloat(Total_marks) / parseFloat(Total_maxMarks)) * 100;

                    if (percentage > 90 && percentage <= 100) {
                        grade = "A1", gpa = 10;
                    } else if (percentage > 80 && percentage <= 90) {
                        grade = "A2", gpa = 9;
                    } else if (percentage > 70 && percentage <= 80) {
                        grade = "B1", gpa = 8;
                    } else if (percentage > 60 && percentage <= 70) {
                        grade = "B2", gpa = 7;
                    } else if (percentage > 50 && percentage <= 60) {
                        grade = "C1", gpa = 6;
                    } else if (percentage > 40 && percentage <= 50) {
                        grade = "C2", gpa = 5;
                    } else if (percentage > 34 && percentage <= 40) {
                        grade = "D", gpa = 4;
                    } else {
                        grade = "E", gpa = 3;
                    };

                    var item = {
                        assessment_result_id: '',
                        school_id: school_id,
                        student_id: studentId,
                        section_id: section_id,
                        subjectId: subjectId,
                        examination_pattern_id: examination_pattern_id,
                        exam_paper_id: exam_paper_id,
                        maxMarks: Total_maxMarks,
                        Marks: Marks,
                        Total_marks: Total_marks,
                        Grade: grade,
                        GPA: gpa
                    };

                    mongo.connect(url, function (err, db) {
                        assert.equal(null, err);
                        db.collection('assessment_evaluation').find({
                            examination_pattern_id: examination_pattern_id,
                            subjectId: subjectId,
                            student_id: studentId
                        }).toArray(function (err, resultArray) {
                            if (err) {
                                res.send('false')
                            } else {
                                var collection = db.collection('assessment_evaluation');
                                if (resultArray.length === 0) {
                                    autoIncrement.getNextSequence(db, 'assessment_evaluation', function (err, autoIndex) {
                                        collection.ensureIndex({
                                            "assessment_result_id": 1,
                                        }, {
                                            unique: true
                                        }, function (err, result) {
                                            if (item.section_id == null || item.examination_pattern_id == null || item.Marks == null || item.subjectId == null) {
                                                res.end('null');
                                            } else {
                                                collection.find({ exam_paper_id: exam_paper_id, student_id: studentId }).count(function (err, triggerCount) {
                                                    var id = triggerCount + 1;
                                                    item.assessment_result_id = exam_paper_id + '-' + studentId + '-M' + id;
                                                    collection.insertOne(item, function (err, result) {
                                                        if (err) {
                                                            if (err.code == 11000) {
                                                                res.end('false');
                                                            }
                                                            res.end('false');
                                                        }
                                                        count++;
                                                        db.close();
                                                        if (count == marksArray.length) {
                                                            res.end('true');
                                                        }
                                                    });
                                                })
                                            }
                                        });
                                    });
                                } else if (resultArray.length > 0) {
                                    var counter = 0;
                                    resultArray[0].Marks.forEach(function (doc1, err) {
                                        if (doc1.Assessment === assMarks.Assessment) {
                                            counter++;
                                        }
                                    })
                                    if (counter === 0) {
                                        var stu_TotalMarks = resultArray[0].Total_marks + assMarks.marks;
                                        var stu_maxMarks = resultArray[0].maxMarks + assMarks.maxMarks;
                                        var stu_percentage = (parseFloat(stu_TotalMarks) / parseFloat(stu_maxMarks)) * 100;

                                        if (stu_percentage > 90 && stu_percentage <= 100) {
                                            stu_grade = "A1", stu_gpa = 10;
                                        } else if (stu_percentage > 80 && stu_percentage <= 90) {
                                            stu_grade = "A2", stu_gpa = 9;
                                        } else if (stu_percentage > 70 && stu_percentage <= 80) {
                                            stu_grade = "B1", stu_gpa = 8;
                                        } else if (stu_percentage > 60 && stu_percentage <= 70) {
                                            stu_grade = "B2", stu_gpa = 7;
                                        } else if (stu_percentage > 50 && stu_percentage <= 60) {
                                            stu_grade = "C1", stu_gpa = 6;
                                        } else if (stu_percentage > 40 && stu_percentage <= 50) {
                                            stu_grade = "C2", stu_gpa = 5;
                                        } else if (stu_percentage > 34 && stu_percentage <= 40) {
                                            stu_grade = "D", stu_gpa = 4;
                                        } else {
                                            stu_grade = "E", stu_gpa = 3;
                                        };
                                        collection.update({ assessment_result_id: resultArray[0].assessment_result_id },
                                            {
                                                $push: {
                                                    Marks: assMarks,
                                                },
                                                $set: {
                                                    Total_marks: stu_TotalMarks,
                                                    maxMarks: stu_maxMarks,
                                                    Grade: stu_grade,
                                                    GPA: stu_gpa,
                                                }
                                            }, function (err, result) {
                                                count++;
                                                assert.equal(null, err);
                                                if (err) {
                                                    res.send('false');
                                                } else {
                                                    db.close();
                                                    if (count == marksArray.length) {
                                                        res.end('true');
                                                    }
                                                }
                                            });
                                    }
                                }
                            }
                        });
                    });
                })
            } else {
                res.end('false');
            }
        }
    })

router.route('/assessment_edit_eval/:subject_id/:school_id')
    .put(function (req, res, next) {

        var subjectId = req.params.subject_id;
        var school_id = req.params.school_id;
        var student_id = req.body.student_id;
        var section_id = req.body.section_id;
        var exam_paper_id = req.body.exam_paper_id;
        var examination_pattern_id = req.body.examination_pattern_id;

        var studentAssessmentMarks = [];
        console.log(req.body)
        Marks = req.body.assMarks;
        MarksLength = Marks.length;
        var ind_marks = {};
        var Total_maxMarks = 0;
        var Total_marks = 0;
        var percentage = 0;

        for (i = 0; i < MarksLength; i++) {

            marks = Marks[i].marks;
            ind_marks.maxMarks = Marks[i].maxMarks;
            if (marks == null || marks == "" || marks == undefined) {
                ind_marks["marks"] = 0;
                Total_marks += 0;
            } else {
                ind_marks["marks"] = marks;
                Total_marks += parseFloat(marks);
            }
            Total_maxMarks += parseFloat(ind_marks.maxMarks);
        }

        if (Total_marks === 0 || Total_maxMarks === 0) {
            percentage = 0;
        } else {
            percentage = (parseFloat(Total_marks) / parseFloat(Total_maxMarks)) * 100;
        }

        if (percentage > 90 && percentage <= 100) {
            grade = "A1";
            GPA = 10;
        } else if (percentage > 80 && percentage <= 90) {
            grade = "A2";
            GPA = 9;
        } else if (percentage > 70 && percentage <= 80) {
            grade = "B1";
            GPA = 8;
        } else if (percentage > 60 && percentage <= 70) {
            grade = "B2";
            GPA = 7;
        } else if (percentage > 50 && percentage <= 60) {
            grade = "C1";
            GPA = 6;
        } else if (percentage > 40 && percentage <= 50) {
            grade = "C2";
            GPA = 5;
        } else if (percentage > 34 && percentage <= 40) {
            grade = "D";
            GPA = 4;
        } else {
            grade = "E";
            GPA = 3;
        };

        var item = {
            assessment_result_id: '',
            school_id: school_id,
            student_id: student_id,
            section_id: section_id,
            subjectId: subjectId,
            examination_pattern_id: examination_pattern_id,
            exam_paper_id: exam_paper_id,
            maxMarks: Total_maxMarks,
            Marks: Marks,
            Total_marks: Total_marks,
            Grade: grade,
            GPA: GPA
        };
        // studentAssessmentMarks.push({ student_id: studentId, Marks: Marks, Total_marks: Total_marks, Total_maxMarks: Total_maxMarks, grade: grade })

        if (student_id == null || subjectId == null) {
            res.end('null');
        } else {
            var myquery = { student_id: student_id, subjectId: subjectId, exam_paper_id: exam_paper_id };

            mongo.connect(url, function (err, db) {
                db.collection('assessment_evaluation').find({
                    student_id: student_id,
                    subjectId: subjectId,
                    exam_paper_id: exam_paper_id
                }).count(function (e, triggerCount) {
                    if (triggerCount == 0) {
                        autoIncrement.getNextSequence(db, 'assessment_evaluation', function (err, autoIndex) {
                            var collection = db.collection('assessment_evaluation')
                            collection.ensureIndex({
                                "assessment_result_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                item.assessment_result_id = school_id + '-EVAL-' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    if (err) {
                                        console.log(err);
                                        if (err.code == 11000) {

                                            res.end('false');
                                        }
                                        res.end('false');
                                    }
                                    db.close();
                                })
                            })
                        })
                    } else {
                        db.collection('assessment_evaluation').update(myquery, { $set: { Marks: Marks, Total_marks: Total_marks, Grade: grade, GPA: GPA } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            db.close();
                            res.send('true');
                        });
                    }
                })
            });
        }
    })

router.route('/assessment_edit_eval/:assessment_result_id')
    .put(function (req, res, next) {

        var assessment_result_id = req.params.assessment_result_id;

        assMarks = req.body.assMarks;
        MarksLength = assMarks.length;
        var Marks = [];
        var Total_maxMarks = 0;
        var Total_marks = 0;
        var percentage = 0;

        for (i = 0; i < MarksLength; i++) {
            var marks = assMarks[i].marks;
            var maxMarks = assMarks[i].maxMarks;
            if (marks == null || marks == "" || marks == undefined || marks == 'N/A') {
                Total_marks += 0;   
                Total_maxMarks += 0;             
            } else {
                Total_marks += parseFloat(marks);
                Total_maxMarks += parseFloat(maxMarks);
                Marks.push(assMarks[i])
            }
        }

        if (Total_marks === 0 || Total_maxMarks === 0) {
            percentage = 0;
        } else {
            percentage = (parseFloat(Total_marks) / parseFloat(Total_maxMarks)) * 100;
        }

        if (percentage > 90 && percentage <= 100) {
            grade = "A1";
            GPA = 10;
        } else if (percentage > 80 && percentage <= 90) {
            grade = "A2";
            GPA = 9;
        } else if (percentage > 70 && percentage <= 80) {
            grade = "B1";
            GPA = 8;
        } else if (percentage > 60 && percentage <= 70) {
            grade = "B2";
            GPA = 7;
        } else if (percentage > 50 && percentage <= 60) {
            grade = "C1";
            GPA = 6;
        } else if (percentage > 40 && percentage <= 50) {
            grade = "C2";
            GPA = 5;
        } else if (percentage > 34 && percentage <= 40) {
            grade = "D";
            GPA = 4;
        } else {
            grade = "E";
            GPA = 3;
        };

        mongo.connect(url, function (err, db) {
            db.collection('assessment_evaluation').update(
                {
                    assessment_result_id: assessment_result_id
                },
                {
                    $set: {
                        Marks: Marks,
                        Total_marks: Total_marks,
                        maxMarks: Total_maxMarks,
                        Grade: grade,
                        GPA: GPA
                    }
                },
            function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.send('true');
                }
            });
        });
    })

// GET Assessment Marks by Subject and Examination
router.route('/assessment_marks_by_section_id/:examination_pattern_id/:section_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var splited = section_id.split('-');
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var examination_pattern_id = req.params.examination_pattern_id;
        var students = [];
        var marks_status = '';
        var attendance_status = '';

        mongo.connect(url, function (err, db) {
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
                                $project:
                                {
                                    section_id: "$section_id",
                                    section_name: "$section_doc.name",
                                    class_id: "$class_id",
                                    class_name: "$class_doc.name",
                                    student_id: "$student_id",
                                    first_name: "$first_name",
                                    last_name: "$last_name",
                                    roll_no: "$roll_no"
                                }
                            }
                        ]).sort({ roll_no: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else {
                                students = result;
                                next(null, result);
                            }
                        });
                    },
                    function getAssessmentPattern(result, next) {
                        if (result === null) {
                            next(err, null, null);
                        } else {
                            db.collection('examination_pattern').find({
                                class_id: class_id,
                                examination_pattern_id: examination_pattern_id,
                            }).toArray(function (err, result1) {
                                if (err) {
                                    next(err, null, null);
                                } else {
                                    result1[0].assessments.forEach(function (data) {
                                        data.maxMarks = parseInt(data.max_marks);
                                        data.marks = 0;
                                    })
                                    next(null, result, result1)
                                }
                            })
                        }
                    },
                    function getsectionStudentsData(result, result1, next) {
                        if (result === null || result1 === null) {
                            next(err, null)
                        } else {
                            var count = 0;
                            var counter = 0;
                            var asssessmentResult = result1;
                            var studentsResult = result;
                            var studentsResultLength = result.length;
                            if (studentsResultLength == 0) {
                                next(null, []);
                            } else {
                                studentsResult.forEach(function (studentData) {
                                    var studentId = studentData.student_id;
                                    var cursor = db.collection('assessment_evaluation').aggregate([
                                        {
                                            $match: {
                                                section_id: section_id,
                                                examination_pattern_id: examination_pattern_id,
                                                subjectId: subject_id,
                                                student_id: studentId,
                                            }
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
                                            "$project": {
                                                "_id": "$_id",
                                                "assessment_result_id": "$assessment_result_id",
                                                "subjectId": "$subjectId",
                                                "subject_name": "$subject_doc.name",
                                                // "exam_title": "$exam_title",
                                                "examination_pattern_id": "$examination_pattern_id",
                                                "maxMarks": "$maxMarks",
                                                "assMarks": "$Marks",
                                                "Total_marks": "$Total_marks",
                                                "Grade": "$Grade",
                                                "GPA": "$GPA"
                                            }
                                        }
                                    ]);
                                    cursor.toArray(function (err, results) {
                                        count++;
                                        if (err) {
                                            next(err, null);
                                        } else {
                                            if (results.length > 0) {
                                                results[0].percentage = parseFloat(((results[0].Total_marks / results[0].maxMarks) * 100).toFixed(2));
                                                delete results[0]._id;
                                                asssessmentResult[0].assessments.forEach(function (mark) {
                                                    if (results[0].assMarks.filter(data => data.Assessment === mark.Assessment).length === 0) {
                                                        results[0].assMarks.push({
                                                            Assessment: mark.Assessment,
                                                            maxMarks: mark.max_marks,
                                                            marks: 'N/A',
                                                        })
                                                    }
                                                })
                                                studentData.subjects = results[0];
                                                counter++;
                                            } else {
                                                var result2 = {
                                                    assessment_result_id: "",
                                                    subjectId: subject_id,
                                                    subject_name: "",
                                                    examination_pattern_id: examination_pattern_id,
                                                    maxMarks: asssessmentResult[0].total_marks,
                                                    assMarks: asssessmentResult[0].assessments,
                                                    Total_marks: 0,
                                                    Grade: "",
                                                    GPA: "",
                                                    percentage: 0
                                                };
                                                studentData.subjects = result2;
                                            }
                                        }
                                        if (studentsResultLength == count) {
                                            if (counter === 0) {
                                                marks_status = 'Pending';
                                            } else {
                                                marks_status = 'Evaluated';
                                            }
                                            next(null, studentsResult);
                                        }
                                    })
                                })
                            }
                        }
                    },
                    function getStudentAttendance(result, next) {
                        var count = 0;
                        let resultStudent = { "students": [] };
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                let currentStudentData = studentData;
                                var studentId = studentData.student_id;
                                var assMarks = studentData.subjects.assMarks;
                                if (assMarks.length > 0) {
                                    let studentWiseAssesment = [];
                                    assMarks.forEach(function (assM) {
                                        var Assessment = assM.Assessment;
                                        db.collection('ExamAttendance').find({
                                            student_id: studentId,
                                            subject_id: subject_id,
                                            examination_pattern_id: examination_pattern_id,
                                        }).toArray(function (err, resultt) {
                                            // console.log({result: JSON.stringify(resultt)})
                                            count++;
                                            if (err) {
                                                res.send('false')
                                            } else {
                                                if (resultt.length > 0) {
                                                    let foo = resultt[0].exams.find(data => data.Assessment === Assessment);
                                                    console.log(studentId)
                                                    console.log(foo.status)
                                                    console.log('result', foo.Assessment, 'Assessment', Assessment);
                                                    assM.status = foo.status;
                                                    let studentIndex = studentsResult.findIndex(data => data.student_id === studentId);
                                                    let assessmentIndex = currentStudentData.subjects.assMarks.findIndex(data => data.Assessment === Assessment);
                                                    let currentAssesment = { status: '' };
                                                    let existingAssesment = currentStudentData.subjects.assMarks[assessmentIndex];
                                                    currentAssesment = { ...existingAssesment, ...currentAssesment };
                                                    currentAssesment.status = foo.status;
                                                    studentWiseAssesment.push(currentAssesment);
                                                    console.log({ assessmentIndex })
                                                    // console.log({studentsResult:JSON.stringify(studentsResult.subjects.assMarks[assessmentIndex])})
                                                    // if(assMarks.length%count == 0 && count>2) {
                                                    // }
                                                    resultStudent.students.push(studentData);
                                                    if (studentData.subjects.assMarks.length == studentWiseAssesment.length) {
                                                        studentData.subjects.assMarks = studentWiseAssesment;
                                                    }
                                                    // studentsResult.filter(
                                                    //     data => data.student_id === studentId)[0]
                                                    //     .subjects.assMarks
                                                    //     .filter(data => data.Assessment === Assessment)
                                                    //     .attendance_status = resultt[0].exams[0].status;
                                                } else {
                                                    assM.attendance_status = "Pending";
                                                    studentsResult.filter(data => data.student_id === studentId)[0].subjects.assMarks.filter(data => data.Assessment === Assessment)[0].attendance_status = "Pending";
                                                }
                                                students.filter(data => data.student_id === studentId)[0].subjects.assMarks = assMarks;
                                                if (count === (studentsResultLength * assMarks.length)) {
                                                    next(null, studentsResult)
                                                }
                                            }
                                        })
                                    })
                                } else {
                                    count++;
                                    if (count === (studentsResultLength * assMarks.length)) {
                                        next(null, resultStudent)
                                    }
                                }
                                //    end of first 4 
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
                            students: result1, marks_status: marks_status
                        });
                    }
                }
            );
        });
    });

router.route('/assessment_marks_by_section_id_mobile/:assessment/:examination_pattern_id/:section_id/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var subject_id = req.params.subject_id;
        var assessment = req.params.assessment;
        var splited = section_id.split('-');
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var examination_pattern_id = req.params.examination_pattern_id;
        var exam_date;
        var marks_status = '';

        mongo.connect(url, function (err, db) {
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
                                $project:
                                {
                                    section_id: "$section_id",
                                    section_name: "$section_doc.name",
                                    class_id: "$class_id",
                                    class_name: "$class_doc.name",
                                    student_id: "$student_id",
                                    first_name: "$first_name",
                                    last_name: "$last_name",
                                    roll_no: "$roll_no",
                                    studentImage: "$studentImage.imageSrc"
                                }
                            }
                        ]).sort({ roll_no: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else if (result.length === 0) {
                                next(err, null);
                            } else {
                                next(null, result);
                            }
                        });
                    },
                    function getAssessmentPattern(result, next) {
                        if (result === null) {
                            next(err, null);
                        } else {
                            db.collection('examination_pattern').aggregate([
                                {
                                    $match: {
                                        school_id: school_id,
                                        class_id: class_id,
                                        examination_pattern_id: examination_pattern_id,
                                        status: 1
                                    }
                                },
                                { $unwind: '$assessments' },
                                {
                                    $match: {
                                        'assessments.Assessment': assessment,
                                    }
                                },
                                {
                                    "$project": {
                                        "assMarks": "$assessments",
                                        "assessment_id": "$assessment_id",
                                    }
                                }
                            ]).toArray(function (err, result1) {
                                if (err) {
                                    next(err, null, null);
                                } else if (result.length === 0) {
                                    next(err, null, null);
                                } else {
                                    next(null, result, result1)
                                }
                            })
                        }
                    },
                    function getsectionStudentsData(result, result1, next) {
                        var count = 0;
                        var counter = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0 || result1.length == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                var cursor = db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            examination_pattern_id: examination_pattern_id,
                                            subjectId: subject_id,
                                            student_id: studentId,
                                        }
                                    },
                                    { $unwind: '$Marks' },
                                    {
                                        $match: {
                                            'Marks.Assessment': assessment,
                                        }
                                    },
                                    {
                                        "$project": {
                                            "assMarks": "$Marks",
                                        }
                                    }
                                ]);
                                cursor.toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        // studentData.assessment_id = result1[0].assessment_id;
                                        studentData.assMarks = results[0].assMarks;
                                        counter++;
                                    } else {
                                        var assMarks = {
                                            Assessment: assessment,
                                            maxMarks: result1[0].assMarks.max_marks,
                                            marks: null,
                                        };
                                        // studentData.assessment_id = result1[0].assessment_id;
                                        studentData.assMarks = assMarks;
                                    }

                                    studentData.assMarks.maxMarks = parseInt(studentData.assMarks.maxMarks);
                                    studentData.assMarks.marks = parseInt(studentData.assMarks.marks)

                                    if (studentsResultLength == count) {
                                        console.log(counter)
                                        if (counter === 0) {
                                            marks_status = 'Pending';
                                        } else {
                                            marks_status = 'Evaluated';
                                        }
                                        next(null, studentsResult);
                                    }
                                })
                            })
                        }
                    },
                    function getStudentAttendance(studentsResult, next) {
                        var count1 = 0;
                        var studentsResult = studentsResult;
                        var studentsResultLength = studentsResult.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var studentId = studentData.student_id;
                                db.collection('ExamAttendance').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
                                            subject_id: subject_id,
                                            examination_pattern_id: examination_pattern_id
                                        }
                                    },
                                    { $unwind: '$exams' },
                                    {
                                        $match: {
                                            'exams.Assessment': assessment,
                                        }
                                    },
                                    {
                                        "$project": {
                                            "status": "$exams.status"
                                        }
                                    }
                                ]).toArray(function (err, attResult) {
                                    if (attResult.length === 0) {
                                        studentData.attendance_status = 'No Attendance Found';
                                    } else {
                                        studentData.attendance_status = attResult[0].status;
                                    }
                                    studentData.exam_date = exam_date;
                                    count1++
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (studentsResultLength === count1) {
                                        next(null, studentsResult);
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
                        res.send({
                            students: result1, marks_status: marks_status
                        });
                    }
                }
            );
        });
    });

router.route('/assessment_marks_by_section_id/:examination_pattern_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split('-');
        var class_id = splited[0] + '-' + splited[1];
        var examination_pattern_id = req.params.examination_pattern_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {

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
                                $project:
                                {
                                    section_id: "$section_id",
                                    section_name: "$section_doc.name",
                                    class_id: "$class_id",
                                    class_name: "$class_doc.name",
                                    student_id: "$student_id",
                                    first_name: "$first_name",
                                    last_name: "$last_name",
                                    roll_no: "$roll_no"
                                }
                            }
                        ]).sort({ roll_no: 1 }).toArray(function (err, result) {
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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            examination_pattern_id: examination_pattern_id,
                                            section_id: section_id,
                                            student_id: studentId
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
                                            examination_pattern_id: "$examination_pattern_id",
                                            assessment_id: "$assessment_id",
                                            maxMarks: "$maxMarks",
                                            marks: "$Marks",
                                            totalMarks: "$Total_marks",
                                            grade: "$Grade",
                                            gpa: "$GPA"

                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.assessments = results;
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
                                var class_id = studentData.class_id;
                                var class_name = studentData.class_name;
                                var section_id = studentData.section_id;
                                var section_name = studentData.section_name;
                                var exam_totalMarks = 0;
                                var exam_maxMarks = 0;
                                for (i = 0; i < assessmentsDataLength; i++) {
                                    exam_totalMarks += studentData.assessments[i].totalMarks;
                                    exam_maxMarks += studentData.assessments[i].maxMarks;
                                }
                                if (exam_totalMarks == 0 || exam_maxMarks == 0) {
                                    percentage = 0;
                                } else {
                                    percentage = (exam_totalMarks / exam_maxMarks) * 100;
                                    percentage = parseFloat(percentage.toFixed(2));
                                }
                                if (percentage > 90 && percentage <= 100) {
                                    var Grade = "A1", gpa = 10;
                                } else if (percentage > 80 && percentage <= 90) {
                                    var Grade = "A2", gpa = 9;
                                } else if (percentage > 70 && percentage <= 80) {
                                    var Grade = "B1", gpa = 8;
                                } else if (percentage > 60 && percentage <= 70) {
                                    var Grade = "B2", gpa = 7;
                                } else if (percentage > 50 && percentage <= 60) {
                                    var Grade = "C1", gpa = 6;
                                } else if (percentage > 40 && percentage <= 50) {
                                    var Grade = "C2", gpa = 5;
                                } else if (percentage > 34 && percentage <= 40) {
                                    var Grade = "D", gpa = 4;
                                } else {
                                    var Grade = "E", gpa = 3;
                                };
                                count++;
                                studentsMarks.push({ class_id: class_id, class_name: class_name, section_id: section_id, section_name: section_name, student_id: student_id, student_name: studentName, roll_no: roll_no, assessments: studentData.assessments, exam_totalMarks: exam_totalMarks, exam_maxMarks: exam_maxMarks, Percentage: percentage, Grade: Grade, GPA: gpa })
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

router.route('/all_assessment_marks_by_section_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {
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
                                $project:
                                {
                                    section_id: "$section_id",
                                    section_name: "$section_doc.name",
                                    class_id: "$class_id",
                                    class_name: "$class_doc.name",
                                    student_id: "$student_id",
                                    first_name: "$first_name",
                                    last_name: "$last_name",
                                    roll_no: "$roll_no"
                                }
                            }
                        ]).sort({ roll_no: 1 }).toArray(function (err, result) {
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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId
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
                                            examination_pattern_id: "$examination_pattern_id",
                                            assessment_id: "$assessment_id",
                                            maxMarks: "$maxMarks",
                                            marks: "$Marks",
                                            totalMarks: "$Total_marks",
                                            grade: "$Grade",
                                        }
                                    }
                                ]).sort({ subject_id: 1 }).toArray(function (err, results) {
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
                    function getSchoolExamSchedules(result, next) {
                        db.collection('exam_schedule').aggregate([
                            {
                                $match: {
                                    school_id: school_id,
                                    status: 1
                                }
                            },
                            {
                                "$unwind": "$classes"
                            },
                            {
                                $match: {
                                    "classes.class_id": class_id,
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "examination_pattern",
                                    "localField": "classes.class_id",
                                    "foreignField": "class_id",
                                    "as": "exam_doc"
                                }
                            },
                            {
                                "$unwind": "$exam_doc"
                            },
                            {
                                "$project": {
                                    "exam_sch_id": "$exam_sch_id",
                                    "exam_title": "$exam_title",
                                    "examination_pattern_id": "$exam_doc.examination_pattern_id",
                                    "from_date": "$from_date",
                                    "end_date": "$end_date",
                                    "unique_code": "$unique_code",
                                }
                            }
                        ]).toArray(function (err, scheduleResult) {
                            if (err) {
                                next(err, null);
                            }
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
                                var class_name = studentData.class_name;
                                var section_name = studentData.section_name;
                                var section_id = studentData.section_id;

                                if (assessmentsDataLength == 0) {
                                    var exam_marks = [];
                                    var tillDateMarks = 0;
                                    var tillDateMaxMarks = 0;
                                    var tillDatePercentage = 0;
                                    var Grade = 'N/A';
                                    var gpa = 'N/A';
                                    count++;
                                } else {
                                    var exam_marks = [];
                                    var tillDateMarks = 0;
                                    var tillDateMaxMarks = 0;
                                    var tillDatePercentage = 0;

                                    for (i = 0; i < scheduleArrayLength; i++) {
                                        var subjects = [];
                                        var examination_pattern_id = scheduleArray[i].examination_pattern_id;
                                        var exam_title = scheduleArray[i].exam_title;
                                        var totalAllMarks = 0;
                                        var totalMaxMarks = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {
                                            if (examination_pattern_id == assessments[j].examination_pattern_id) {
                                                subject_name = assessments[j].subject;
                                                max_marks = assessments[j].maxMarks;
                                                grade = assessments[j].grade;
                                                if (Number.isInteger(parseInt(assessments[j].totalMarks))) {
                                                    totalMarks = parseInt(assessments[j].totalMarks);
                                                } else {
                                                    totalMarks = 0;
                                                };
                                                totalAllMarks += totalMarks;
                                                totalMaxMarks += parseInt(max_marks);
                                                percentage = (parseInt(totalAllMarks) / parseInt(totalMaxMarks)) * parseInt(100);
                                                console.log(percentage);
                                                if (percentage > 90 && percentage <= 100) {
                                                    var Grade = "A1", gpa = 10;
                                                } else if (percentage > 80 && percentage <= 90) {
                                                    var Grade = "A2", gpa = 9;
                                                } else if (percentage > 70 && percentage <= 80) {
                                                    var Grade = "B1", gpa = 8;
                                                } else if (percentage > 60 && percentage <= 70) {
                                                    var Grade = "B2", gpa = 7;
                                                } else if (percentage > 50 && percentage <= 60) {
                                                    var Grade = "C1", gpa = 6;
                                                } else if (percentage > 40 && percentage <= 50) {
                                                    var Grade = "C2", gpa = 5;
                                                } else if (percentage > 34 && percentage <= 40) {
                                                    var Grade = "D", gpa = 4;
                                                } else {
                                                    var Grade = "E", gpa = 3;
                                                };

                                                subjects.push({ subject_name: subject_name, max_marks: max_marks, total_marks: totalMarks, grade: grade })
                                            }
                                        }
                                        tillDateMarks += totalAllMarks;
                                        tillDateMaxMarks += totalMaxMarks;
                                        if (tillDateMarks == 0 || tillDateMaxMarks == 0) {
                                            tillDatePercentage = 0
                                        } else {
                                            tillDatePercentage = (tillDateMarks / tillDateMaxMarks) * 100;
                                            tillDatePercentage = parseFloat(tillDatePercentage.toFixed(2));
                                        }
                                        if (tillDatePercentage > 90 && tillDatePercentage <= 100) {
                                            var TGrade = "A1", GPA = 10;
                                        } else if (tillDatePercentage > 80 && tillDatePercentage <= 90) {
                                            var TGrade = "A2", GPA = 9;
                                        } else if (tillDatePercentage > 70 && tillDatePercentage <= 80) {
                                            var TGrade = "B1", GPA = 8;
                                        } else if (tillDatePercentage > 60 && tillDatePercentage <= 70) {
                                            var TGrade = "B2", GPA = 7;
                                        } else if (tillDatePercentage > 50 && tillDatePercentage <= 60) {
                                            var TGrade = "C1", GPA = 6;
                                        } else if (tillDatePercentage > 40 && tillDatePercentage <= 50) {
                                            var TGrade = "C2", GPA = 5;
                                        } else if (tillDatePercentage > 34 && tillDatePercentage <= 40) {
                                            var TGrade = "D", GPA = 4;
                                        } else {
                                            var TGrade = "E", GPA = 3;
                                        };
                                        exam_marks.push({ exam_title: exam_title, subjects: subjects, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, grade: Grade, gpa: gpa })
                                    }
                                    count++;
                                }
                                // count++;
                                studentsMarks.push({ class_name: class_name, section_name: section_name, section_id: section_id, student_id: student_id, student_name: studentName, roll_no: roll_no, exam_marks: exam_marks, tillDateMarks: tillDateMarks, tillDateMaxMarks: tillDateMaxMarks, tillDatePercentage: tillDatePercentage, Grade: TGrade, GPA: GPA })

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

router.route('/all_assessment_marks_by_section_id_student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var studentsMarks = [];
        var examScheduleList = [];

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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId
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
                                            examination_pattern_id: "$examination_pattern_id",
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
                        db.collection('exam_schedule').aggregate([
                            {
                                $match: {
                                    school_id: school_id,
                                    status: 1
                                }
                            },
                            {
                                "$unwind": "$classes"
                            },
                            {
                                $match: {
                                    "classes.class_id": class_id,
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "examination_pattern",
                                    "localField": "classes.class_id",
                                    "foreignField": "class_id",
                                    "as": "exam_doc"
                                }
                            },
                            {
                                "$unwind": "$exam_doc"
                            },
                            {
                                "$project": {
                                    "exam_sch_id": "$exam_sch_id",
                                    "exam_title": "$exam_title",
                                    "examination_pattern_id": "$exam_doc.examination_pattern_id",
                                    "from_date": "$from_date",
                                    "end_date": "$end_date",
                                    "unique_code": "$unique_code",
                                }
                            }
                        ]).toArray(function (err, scheduleResult) {
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
                                        var examination_pattern_id = scheduleArray[i].examination_pattern_id;
                                        var exam_title = scheduleArray[i].exam_title;
                                        var totalAllMarks = 0;
                                        var totalMaxMarks = 0;
                                        var totalPerrcentage = 0;
                                        for (j = 0; j < assessmentsDataLength; j++) {
                                            var percentage = 0;
                                            if (examination_pattern_id == assessments[j].examination_pattern_id) {

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
                                        } else {
                                            finalGrade = "N/A"
                                        };

                                        exam_marks.push({ exam_title: exam_title, subjects: subjects, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, grade: finalGrade })
                                    }
                                    count++;
                                }
                                studentsMarks.push({ student_id: student_id, student_name: studentName, exam_marks: exam_marks })

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
                            { grade: "E", count: 0, students: [] },
                            { grade: "N/A", count: 0, students: [] }];

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

                                                    if (examMarks.grade == "N/A") {
                                                        gradesData[8].count++;
                                                    }
                                                }
                                            })
                                        } else {

                                        }
                                    } else { }
                                })
                            }
                            finalObj.push({ exam_title: scheduleList.exam_title, data: gradesData });
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

router.route('/overall_assessment_marks_by_section_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var studentsMarks = [];
        var examScheduleList = [];

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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId
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
                                            examination_pattern_id: "$examination_pattern_id",
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
                                    studentData.assessments = results;
                                    if (studentsResultLength == count) {
                                        next(null, studentsResult);
                                    }
                                })
                            })
                        }
                    },
                    function getAttendanceData(result, next) {
                        var count = 0;
                        var studentResult = result;
                        var studentDataLength = result.length;
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
                                    var totalAllMarks = 0;
                                    var totalMaxMarks = 0;
                                    var totalPerrcentage = 0;
                                    var finalGrade;
                                    for (j = 0; j < assessmentsDataLength; j++) {
                                        if (Number.isInteger(parseInt(assessments[j].totalMarks))) {
                                            totalMarks = parseInt(assessments[j].totalMarks);
                                        } else {
                                            totalMarks = 0;
                                        };
                                        if (Number.isInteger(parseInt(assessments[j].maxMarks))) {
                                            max_marks = parseInt(assessments[j].maxMarks);
                                        } else {
                                            max_marks = 0;
                                        };
                                        totalAllMarks += totalMarks;
                                        totalMaxMarks += max_marks;
                                    }
                                    var totalPerrcentage = (parseInt(totalAllMarks) / parseInt(totalMaxMarks)) * parseInt(100);
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
                                    count++;
                                }
                                studentsMarks.push({ student_id: student_id, student_name: studentName, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, totalPerrcentage: totalPerrcentage, finalGrade: finalGrade })

                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
                        }
                    }, function (result1, next) {
                        var finalObj = [];
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
                                if (student.finalGrade == "A1") {
                                    gradesData[0].count++;
                                    gradesData[0].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "A2") {
                                    gradesData[1].count++;
                                    gradesData[1].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "B1") {
                                    gradesData[2].count++;
                                    gradesData[2].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "B2") {
                                    gradesData[3].count++;
                                    gradesData[3].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "C1") {
                                    gradesData[4].count++;
                                    gradesData[4].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "C2") {
                                    gradesData[5].count++;
                                    gradesData[5].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "D") {
                                    gradesData[6].count++;
                                    gradesData[6].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                                if (student.finalGrade == "E") {
                                    gradesData[7].count++;
                                    gradesData[7].students.push({ student_id: student.student_id, student_name: student.student_name });
                                }
                            })
                        }
                        finalObj.push({ data: gradesData });
                        next(null, gradesData);
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

router.route('/all_assessment_marks_by_student_id/:student_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var school_id = req.params.school_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getsectionStudentsData(next) {
                        db.collection('assessment_evaluation').aggregate([
                            {
                                $match: {
                                    student_id: student_id
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
                                    roll_no: "$student_doc.roll_no",
                                    subject_id: "$subjectId",
                                    subject: "$subject_doc.name",
                                    examination_pattern_id: "$examination_pattern_id",
                                    assessment_id: "$assessment_id",
                                    maxMarks: "$maxMarks",
                                    marks: "$Marks",
                                    totalMarks: "$Total_marks",
                                    evaluation: "true",
                                }
                            }
                        ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            } else {
                                next(null, results);
                            }
                        })
                    },
                    function getStudentDetails(results, next) {
                        if (results.length === 0) {
                            db.collection('students').aggregate([
                                {
                                    $match: {
                                        student_id: student_id
                                    },
                                },
                                {
                                    $project:
                                    {
                                        section_id: "$section_id",
                                        student_id: "$student_id",
                                        student_name: "$first_name",
                                        roll_no: "$roll_no",
                                        subject_id: "",
                                        subject: "",
                                        examination_pattern_id: "",
                                        assessment_id: "",
                                        maxMarks: "",
                                        marks: "",
                                        totalMarks: "",
                                        evaluation: "false"
                                    }
                                }
                            ]).toArray(function (err, result1) {
                                if (err) {
                                    console.log(err)
                                    next(err, null)
                                }
                                next(null, result1);
                            })
                        } else {
                            next(null, results);
                        }
                    },
                    function getClassExamSchedules(results, next) {
                        var section_id = results[0].section_id;
                        var splitted = section_id.split('-');
                        var class_id = splitted[0] + '-' + splitted[1];
                        db.collection('exam_schedule').aggregate([
                            {
                                $match: {
                                    school_id: school_id,
                                    status: 1
                                }
                            },
                            {
                                "$unwind": "$classes"
                            },
                            {
                                $match: {
                                    "classes.class_id": class_id,
                                }
                            },
                            {
                                $project: {
                                    "exam_sch_id": "$exam_sch_id",
                                    "examination_pattern_id": "$classes.examination_pattern_id",
                                    "exam_title": "$exam_title",
                                    "status": "$status"
                                }
                            }
                        ]).toArray(function (err, scheduleResult) {
                            if (err) {
                                next(err, null, null);
                            } else {
                                console.log(scheduleResult)
                                next(null, results, scheduleResult);
                            }
                        });
                    }, function getAttendanceData(results, scheduleResult, next) {

                        var count = 0;

                        var assessmentResult = results;
                        var assessmentResultLength = results.length;
                        var scheduleArray = scheduleResult;
                        var scheduleArrayLength = scheduleArray.length;
                        if (assessmentResultLength == 0) {
                            next(null, []);
                        } else {
                            var student_id = assessmentResult[0].student_id;
                            var student_name = assessmentResult[0].student_name;
                            var roll_no = assessmentResult[0].roll_no;
                            var exam_marks = [];

                            if (scheduleArrayLength == 0) {
                                studentsMarks.push({ student_id: student_id, student_name: student_name, roll_no: roll_no, exam_marks: exam_marks })
                                next(null, studentsMarks);
                            } else {

                                scheduleArray.forEach(function (scheduleData) {

                                    var schedulesData = scheduleData;

                                    var examination_pattern_id = scheduleData.examination_pattern_id;
                                    var exam_title = scheduleData.exam_title;

                                    var totalAllMarks = 0;
                                    var totalMaxMarks = 0;
                                    var percentage = 0;

                                    var subjects = [];
                                    for (i = 0; i < assessmentResultLength; i++) {

                                        examination_pattern_id = assessmentResult[i].examination_pattern_id;

                                        if (examination_pattern_id == examination_pattern_id) {

                                            totalMarks = parseFloat(assessmentResult[i].totalMarks);
                                            subject_name = assessmentResult[i].subject;
                                            max_marks = parseFloat(assessmentResult[i].maxMarks);
                                            totalAllMarks += totalMarks;
                                            totalMaxMarks += max_marks;
                                            percentage1 = (totalMarks / max_marks) * 100;
                                            percentage1 = percentage1.toFixed(2);
                                            if (percentage1 > 90 && percentage1 <= 100) {
                                                grade = "A1", gpa = 10;
                                            } else if (percentage1 > 80 && percentage1 <= 90) {
                                                grade = "A2", gpa = 9;
                                            } else if (percentage1 > 70 && percentage1 <= 80) {
                                                grade = "B1", gpa = 8;
                                            } else if (percentage1 > 60 && percentage1 <= 70) {
                                                grade = "B2", gpa = 7;
                                            } else if (percentage1 > 50 && percentage1 <= 60) {
                                                grade = "C1", gpa = 6;
                                            } else if (percentage1 > 40 && percentage <= 50) {
                                                grade = "C2", gpa = 5;
                                            } else if (percentage1 > 34 && percentage1 <= 40) {
                                                grade = "D", gpa = 4;
                                            } else if (percentage1 >= 0 && percentage1 <= 34) {
                                                grade = "E", gpa = 3;
                                            } else {
                                                grade = "N/A", gpa = "N/A";
                                            }
                                            subjects.push({ subject_name: subject_name, max_marks: max_marks, total_marks: totalMarks, percentage: parseInt(percentage1), grade: grade, gpa: gpa })
                                        }
                                        if (totalAllMarks === 0 || totalMaxMarks === 0) {
                                            percentage = 0;
                                            Grade = 'N/A';
                                            GPA = 'N/A';
                                        } else {
                                            percentage = (totalAllMarks / totalMaxMarks) * 100;
                                            if (percentage > 90 && percentage <= 100) {
                                                Grade = "A1", GPA = 10;
                                            } else if (percentage > 80 && percentage <= 90) {
                                                Grade = "A2", GPA = 9;
                                            } else if (percentage > 70 && percentage <= 80) {
                                                Grade = "B1", GPA = 8;
                                            } else if (percentage > 60 && percentage <= 70) {
                                                Grade = "B2", GPA = 7;
                                            } else if (percentage > 50 && percentage <= 60) {
                                                Grade = "C1", GPA = 6;
                                            } else if (percentage > 40 && percentage <= 50) {
                                                Grade = "C2", GPA = 5;
                                            } else if (percentage > 34 && percentage <= 40) {
                                                Grade = "D", GPA = 4;
                                            } else if (percentage >= 0 && percentage <= 34) {
                                                Grade = "E", GPA = 3;
                                            } else {
                                                Grade = "N/A", GPA = "N/A";
                                            }
                                        }
                                        percentage = percentage.toFixed(2);
                                    }
                                    exam_marks.push({ exam_title: exam_title, subjects: subjects, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, percentage: parseInt(percentage), Grade: Grade, GPA: GPA })

                                    count++;

                                    if (scheduleArrayLength == count) {
                                        studentsMarks.push({ student_id: student_id, student_name: student_name, roll_no: roll_no, exam_marks: exam_marks })
                                        next(null, studentsMarks);
                                    }
                                });
                            }
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

router.route('/subjectwise_assessment_marks_by_student_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var student_id = req.params.student_id;
        var studentsMarks = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getsectionStudentsData(next) {
                        db.collection('assessment_evaluation').aggregate([
                            {
                                $match: {
                                    student_id: student_id
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
                                    roll_no: "$student_doc.roll_no",
                                    subject_id: "$subjectId",
                                    subject: "$subject_doc.name",
                                    exam_title: "$exam_title",
                                    assessment_id: "$assessment_id",
                                    maxMarks: "$maxMarks",
                                    marks: "$Marks",
                                    totalMarks: "$Total_marks"
                                }
                            }
                        ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        })
                    },
                    function getSectionSubjects(results, next) {
                        var section_id = results[0].section_id;
                        var data = db.collection('subjects').find({
                            section_id: section_id
                        }).toArray(function (err, subjectResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results, subjectResult);
                        });
                    }, function getAttendanceData(results, subjectResult, next) {
                        var count = 0;
                        var assessmentResult = results;
                        var assessmentResultLength = results.length;
                        var subjectArray = subjectResult;
                        var subjectArrayLength = subjectResult.length;
                        if (assessmentResultLength == 0) {
                            next(null, []);
                        } else {
                            var student_id = assessmentResult[0].student_id;
                            var student_name = assessmentResult[0].student_name;
                            var roll_no = assessmentResult[0].roll_no;
                            var subject_marks = [];
                            if (subjectArrayLength == 0) {
                                next(null, []);
                            } else {
                                subjectArray.forEach(function (subjectData) {
                                    var subjectName = subjectData.name;
                                    console.log(subjectName)
                                    var totalAllMarks = 0;
                                    var totalMaxMarks = 0;
                                    var percentage = 0;
                                    var Exams = [];
                                    for (i = 0; i < assessmentResultLength; i++) {
                                        subject_name = assessmentResult[i].subject_name;
                                        console.log(subject_name)
                                        if (subject_name == subjectName) {
                                            totalMarks = parseInt(assessmentResult[i].totalMarks);
                                            exam_title = assessmentResult[i].exam_title;
                                            max_marks = parseInt(assessmentResult[i].maxMarks);
                                            totalAllMarks += totalMarks;
                                            totalMaxMarks += max_marks;
                                            percentage1 = (totalMarks / max_marks) * 100;
                                            percentage1 = percentage1.toFixed(2);
                                            if (percentage1 > 90 && percentage1 <= 100) {
                                                grade = "A1", gpa = 10;
                                            } else if (percentage1 > 80 && percentage1 <= 90) {
                                                grade = "A2", gpa = 9;
                                            } else if (percentage1 > 70 && percentage1 <= 80) {
                                                grade = "B1", gpa = 8;
                                            } else if (percentage1 > 60 && percentage1 <= 70) {
                                                grade = "B2", gpa = 7;
                                            } else if (percentage1 > 50 && percentage1 <= 60) {
                                                grade = "C1", gpa = 6;
                                            } else if (percentage1 > 40 && percentage <= 50) {
                                                grade = "C2", gpa = 5;
                                            } else if (percentage1 > 34 && percentage1 <= 40) {
                                                grade = "D", gpa = 4;
                                            } else if (percentage1 >= 0 && percentage1 <= 34) {
                                                grade = "E", gpa = 3;
                                            } else {
                                                grade = "N/A", gpa = "N/A";
                                            }
                                            Exams.push({ exam_title: exam_title, max_marks: max_marks, total_marks: totalMarks, percentage: percentage1, grade: grade, gpa: gpa })
                                        }
                                        percentage = (totalAllMarks / totalMaxMarks) * 100;
                                        percentage = percentage.toFixed(2);
                                        if (percentage > 90 && percentage <= 100) {
                                            Grade = "A1", GPA = 10;
                                        } else if (percentage > 80 && percentage <= 90) {
                                            Grade = "A2", GPA = 9;
                                        } else if (percentage > 70 && percentage <= 80) {
                                            Grade = "B1", GPA = 8;
                                        } else if (percentage > 60 && percentage <= 70) {
                                            Grade = "B2", GPA = 7;
                                        } else if (percentage > 50 && percentage <= 60) {
                                            Grade = "C1", GPA = 6;
                                        } else if (percentage > 40 && percentage <= 50) {
                                            Grade = "C2", GPA = 5;
                                        } else if (percentage > 34 && percentage <= 40) {
                                            Grade = "D", GPA = 4;
                                        } else if (percentage >= 0 && percentage <= 34) {
                                            Grade = "E", GPA = 3;
                                        } else {
                                            Grade = "N/A", GPA = "N/A";
                                        }
                                    }
                                    subject_marks.push({ subject_name: subject_name, Exams: Exams, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, percentage: percentage, Grade: Grade, GPA: GPA })
                                    count++;

                                    if (subjectArrayLength == count) {
                                        studentsMarks.push({ student_id: student_id, student_name: student_name, roll_no: roll_no, subject_marks: subject_marks })
                                        next(null, studentsMarks);
                                    }
                                });
                            }
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

router.route('/exams/:exam_sch_id')
    .get(function (req, res, next) {

        var exam_sch_id = req.params.exam_sch_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('exams').find({ exam_sch_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    resultArray
                });
            });
        });
    });

module.exports = router;
