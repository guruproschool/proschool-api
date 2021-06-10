// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var forEach = require('async-foreach').forEach;
var url = config.dburl;

router.route('/examevaluation/:exam_paper_id')
    .get(function (req, res, next) {
        var exam_paper_id = req.params.exam_paper_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //commented and replaced old code
            //    var cursor = db.collection('exam_evaluation').find({exam_paper_id:exam_paper_id });
            // var cursor = db.collection('exam_evaluation').aggregate([
            //             { "$lookup": { 
            //                 "from": "students", 
            //                 "localField": "student_id", 
            //                 "foreignField": "student_id", 
            //                 "as": "student_doc"
            //             }}, 
            //             { "$unwind": "$student_doc" },
            //             { "$redact": { 
            //                 "$cond": [
            //                     { "$eq": [ "$student_id", "$student_doc.student_id" ] }, 
            //                     "$$KEEP", 
            //                     "$$PRUNE"
            //                 ]
            //             }}, 
            //             { "$project": { 
            //                 "_id": "$_id",
            //                 "paper_result_id": "$paper_result_id",
            //                  "exam_paper_id": "$exam_paper_id", 
            //                 "student_id": "$student_id",
            //                 "marks": "$marks",
            //                 "comment": "$comment",
            //                 "date": "$date",
            //                 "status": "$status",
            //                 "student_name": "$student_doc.first_name", 
            //                 "roll_no": "$student_doc.roll_no" 

            //             }}
            //         ])

            var cursor = db.collection('exam_evaluation').aggregate([
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
                        "from": "exams",
                        "localField": "exam_paper_id",
                        "foreignField": "exam_paper_id",
                        "as": "exams_doc"
                    }
                },
                {
                    "$unwind": "$exams_doc"
                },
                {
                    "$redact": {
                        "$cond": [{
                            "$eq": ["$exam_paper_id", exam_paper_id]
                        },
                            "$$KEEP",
                            "$$PRUNE"
                        ]
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "paper_result_id": "$paper_result_id",
                        "exam_paper_id": "$exam_paper_id",
                        "student_id": "$student_id",
                        "marks": "$marks",
                        "comment": "$comment",
                        "date": "$date",
                        "status": "$status",
                        "student_name": "$student_doc.first_name",
                        "roll_no": "$student_doc.roll_no",
                        "max_marks": "$exams_doc.max_marks",

                    }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    barchart: resultArray
                });
            });
        });
    });

router.route('/examevaluationlistbystudentid/:exam_sch_id/:student_id')
    .get(function (req, res, next) {
        var exam_sch_id = req.params.exam_sch_id;
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('exam_schedule').aggregate([
                {
                    $match: {
                        exam_sch_id: exam_sch_id
                    }
                },
                {
                    $lookup: {
                        from: "exams",
                        localField: "exam_sch_id",
                        foreignField: "exam_sch_id",
                        as: "exams"
                    }
                },
                {
                    $unwind: "$exams"
                },
                {
                    $match: {
                        "exams.status": 1
                    }
                },

                {
                    $group: {
                        _id: '$_id',
                        exam_sch_id: {
                            "$first": "$exam_sch_id"
                        },
                        school_id: {
                            "$first": "$school_id"
                        },
                        exam_title: {
                            "$first": "$exam_title"
                        },
                        exam_classes: {
                            "$first": "$exam_classes"
                        },
                        from_date: {
                            "$first": "$from_date"
                        },
                        exams: {
                            $push: "$exams"
                        }
                    }
                },


            ]).toArray(function (err, results) {

                if (results.length > 0) {
                    if (results[0].exams.length > 0) {
                        var count = 0;
                        forEach(results[0].exams, function (key, value) {

                            key.exam_evaluation = [];
                            var examEvaluation = db.collection('exam_evaluation').aggregate([{
                                $match: {
                                    exam_paper_id: key.exam_paper_id,
                                    student_id: student_id,
                                    status: 1
                                }
                            }])
                            examEvaluation.forEach(function (data, err) {

                                key.exam_evaluation.push(data);
                                count++;

                            }, function () {
                                if (count === results[0].exams.length) {
                                    db.close();
                                    res.send({
                                        barchart: results
                                    });
                                }
                            });

                        })
                    } else {
                        db.close();
                        res.send({
                            barchart: results
                        });

                    }
                } else {
                    db.close();
                    res.send({
                        barchart: results
                    });

                }

            })

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

router.route('/student_marks_subjets/:student_id/:subject_id')
    .get(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('exam_schedule').aggregate([
                {
                    $match: {
                        exam_sch_id: exam_sch_id
                    }
                },
                {
                    $lookup: {
                        from: "exams",
                        localField: "exam_sch_id",
                        foreignField: "exam_sch_id",
                        as: "exams"
                    }
                },
                {
                    $unwind: "$exams"
                },
                {
                    $match: {
                        "exams.status": 1
                    }
                },

                {
                    $group: {
                        _id: '$_id',
                        exam_sch_id: {
                            "$first": "$exam_sch_id"
                        },
                        school_id: {
                            "$first": "$school_id"
                        },
                        exam_title: {
                            "$first": "$exam_title"
                        },
                        exam_classes: {
                            "$first": "$exam_classes"
                        },
                        from_date: {
                            "$first": "$from_date"
                        },
                        exams: {
                            $push: "$exams"
                        }
                    }
                },


            ]).toArray(function (err, results) {

                if (results.length > 0) {
                    if (results[0].exams.length > 0) {
                        var count = 0;
                        forEach(results[0].exams, function (key, value) {

                            key.exam_evaluation = [];
                            var examEvaluation = db.collection('exam_evaluation').aggregate([{
                                $match: {
                                    exam_paper_id: key.exam_paper_id,
                                    student_id: student_id,
                                    status: 1
                                }
                            }])
                            examEvaluation.forEach(function (data, err) {

                                key.exam_evaluation.push(data);
                                count++;

                            }, function () {
                                if (count === results[0].exams.length) {
                                    db.close();
                                    res.send({
                                        barchart: results
                                    });
                                }
                            });

                        })
                    } else {
                        db.close();
                        res.send({
                            barchart: results
                        });

                    }
                } else {
                    db.close();
                    res.send({
                        barchart: results
                    });

                }

            })

        });
    });

router.route('/Overall_assessment_marks_by_class/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var classList = [];
        var studentList = [];
        var studentsMarks = [];
        var classMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolClasses(next) {
                        db.collection('school_classes').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, result)
                            }
                            classList = result;
                            next(null, result)
                        })
                    },
                    function getSchoolStudents(result, next) {
                        db.collection('students').find({
                            school_id
                        }).toArray(function (err, results) {
                            if (err) {
                                next(err, results)
                            }
                            studentList = results;
                            next(null, result, results)
                        })
                    },
                    function getsectionStudentsData(result, results, next) {
                        var count = 0;
                        var studentsResult = results;
                        var studentsResultLength = results.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                //console.log(studentData)
                                var student_id = studentData.student_id;
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
                                                subject_id: "$subjectId",
                                                subject: "$subject_doc.name",
                                                exam_title: "$exam_title",
                                                assessment_id: "$assessment_id",
                                                maxMarks: "$maxMarks",
                                                marks: "$Marks",
                                                totalMarks: "$Total_marks"
                                            }
                                    }
                                ]).sort({ subject_id: 1 }).toArray(function (err, result1) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    console.log(result1)
                                    if(result1.length > 0 ) {
                                        studentData.assessments = result1;
                                    }
                                    //console.log(studentData)
                                    //console.log("result")
                                    if (studentsResultLength == count) {
                                        next(null, studentsResult)
                                    }
                                })
                            })
                        }
                    },
                    function getAttendanceData(result, next) {
                        var count = 0;
                        var studentResult = result;
                        console.log(studentResult[0])
                        var studentResultLength = studentsResult.length;
                        var classResult = result;
                        var classResultLength = result.length;
                        classResult.forEach(function (classData) {
                            var class_id = classData.class_id;
                            var class_name = classData.name;
                            if (studentResultLength > 0) {
                                studentResult.forEach(function (studentData) {                        
                                    var classId = studentData.class_id;
                                    if (classId == class_id) {
                                        var student_id = studentData.student_id;
                                        var student_name = studentData.first_name;
                                        var assessments = studentsData.assessments;
                                        var totalMarks = 0;
                                        var totalMaxMarks = 0;
                                        if (assessments) {
                                            for (i = 0; i < assessments.length; i++) {
                                                var Marks = assessments[i].totalMarks;
                                                var maxMarks = assessments[i].maxMarks;
                                                totalMarks += Marks;
                                                totalMaxMarks += maxMarks;
                                            }
                                        }
                                        var percentage = (totalMarks / totalMaxMarks) * 100;
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
                                        studentsMarks.push({ student_id: student_id, student_name: student_name, grade: grade })

                                    }
                                })
                                classMarks.push({ class_id: class_id, class_name: class_name, students: studentsMarks })
                                count++;
                                if (classResultLength == count) {
                                    next(null, classResult);
                                }
                            }
                        })
                    },
                    function (result1, next) {
                        var count = 0;
                        var finalObj = [];
                        result1.forEach(function (classData) {
                            var gradesData = [{ grade: "A1", count: 0, students: [] },
                            { grade: "A2", count: 0, students: [] },
                            { grade: "B1", count: 0, students: [] },
                            { grade: "B2", count: 0, students: [] },
                            { grade: "C1", count: 0, students: [] },
                            { grade: "C2", count: 0, students: [] },
                            { grade: "D", count: 0, students: [] },
                            { grade: "E", count: 0, students: [] }];
                            var class_id = classdata.class_id;
                            var class_name = classdata.class_name;
                            classData.students.forEach(function(studentData) {
                                if (studentData.grade == "A1") {
                                    gradesData[0].count++;
                                    gradesData[0].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "A2") {
                                    gradesData[1].count++;
                                    gradesData[1].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "B1") {
                                    gradesData[2].count++;
                                    gradesData[2].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "B2") {
                                    gradesData[3].count++;
                                    gradesData[3].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "C1") {
                                    gradesData[4].count++;
                                    gradesData[4].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "C2") {
                                    gradesData[5].count++;
                                    gradesData[5].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                                if (studentData.grade == "D") {
                                    gradesData[6].count++;
                                    gradesData[6].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }

                                if (studentData.grade == "E") {
                                    gradesData[7].count++;
                                    gradesData[7].students.push({ student_id: studentData.student_id, student_name: studentData.student_name });
                                }
                            })
                            finalObj.push({class_id: class_id, class_name: class_name, class_grades: gradesData })
                            count++;
                            if(result1.length == count) {
                                next(null, finalObj)
                            }
                        })
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
                            classGrades: result1
                        });

                    }
                }
            );
        });
    });

router.route('/all_assessment_marks_by_school_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_marks = [];
        var examScheduleList = [];
        var classList = [];
        var student_marks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolClasses(next) {
                        db.collection('school_classes').find({
                            school_id
                        }).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results)
                        })
                    },
                    function getClassStudents(results, next) {
                        var count = 0;
                        var ClassResult = results;
                        var ClassResultLength = results.length;
                        if (ClassResultLength == 0) {
                            next(null, []);
                        } else {
                            ClassResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                classData.students = [];
                                db.collection('students').find({
                                    class_id
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        classData.students = results;
                                    }

                                    if (ClassResultLength == count);
                                    next(null, ClassResult);
                                });
                            })
                        }
                    },
                    function getsectionStudentsData(ClassResult, next) {
                        var count = 0;
                        var classResult = ClassResult;
                        var classResultLength = ClassResult.length;
                        // console.log(ClassResult[0]);
                        classResult.forEach(function (classData) {
                            if (classData.students.length == 0) {
                                next(null, []);
                            } else {
                                classData.students.forEach(function (studentData) {
                                    var studentId = studentData.student_id;
                                    console.log(studentId)
                                    studentData.assessments = [];
                                    db.collection('assessment_evaluation').aggregate([
                                        {
                                            $match: {
                                                student_id: studentId
                                            },
                                        },
                                        {
                                            $project:
                                                {
                                                    section_id: "$section_id",
                                                    subject_id: "$subjectId",
                                                    exam_title: "$exam_title",
                                                    assessment_id: "$assessment_id",
                                                    maxMarks: "$maxMarks",
                                                    marks: "$Marks",
                                                    totalMarks: "$Total_marks",
                                                    grade: "$Grade",
                                                    class_id: "$class_id",
                                                }
                                        }
                                    ]).toArray(function (err, results) {
                                        count++;
                                        if (err) {
                                            next(err, null);
                                        }
                                        console.log(results)

                                        if (classResultLength == count) {

                                            next(null, classResult);
                                            // next(null, classData);
                                        }

                                    })
                                })
                            }
                        })
                    },
                    // function getSchoolClasses(ClassResults, next) {

                    //     var data = db.collection('school_classes').find({
                    //         school_id: school_id
                    //     }).toArray(function (err, classResult) {
                    //         if (err) {
                    //             next(err, null);
                    //         }
                    //         // console.log("total attenance result")
                    //         // console.log(attResult);
                    //         classList = classResult;
                    //         next(null, result, classResult);
                    //     });
                    // }, 
                    function getAttendanceData(classResult, next) {

                        var count = 0;
                        // console.log(classResult[0])
                        var studentResult = result;
                        var studentDataLength = result.length;
                        var classArray = classResult;
                        var classArrayLength = classArray.length;

                        if (classArrayLength == 0) {
                            next(null, []);
                        } else {

                            classArray.forEach(function (classData) {

                                var classId = classData.class_id;
                                var class_name = classData.name;

                                for (i = 0; i < studentDataLength; i++) {

                                    var assessmentsDataLength = studentResult[i].assessments.length;
                                    var assessments = studentResult[i].assessments;
                                    var student_id = studentResult[i].student_id;
                                    var studentName = studentResult[i].first_name + " " + studentResult[i].last_name;
                                    var roll_no = studentResult[i].roll_no;
                                    var splited = student_id.split('-');
                                    var class_id = splited[0] + '-' + splited[1];

                                    if (class_id == classId) {

                                        if (assessmentsDataLength == 0) {
                                            student_marks.push({ student_id: student_id, student_name: studentName, totalAllMarks: 0, totalMaxMarks: 0, grade: 0 })
                                            count++;

                                        } else {

                                            var totalAllMarks = 0;
                                            var totalMaxMarks = 0;
                                            var totalPerrcentage = 0;
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
                                            } else {
                                                finalGrade = "E";
                                            };
                                            student_marks.push({ student_id: student_id, student_name: studentName, totalAllMarks: totalAllMarks, totalMaxMarks: totalMaxMarks, grade: finalGrade })
                                            // console.log(student_marks)
                                        }
                                    }

                                }
                                class_marks.push({ class_id: classId, class_name: class_name, student_marks: student_marks })
                                // console.log(class_marks)
                                count++;
                                if (classArrayLength == count) {
                                    next(null, class_marks);
                                }
                            })
                        }
                    },
                    function (result1, next) {
                        var finalObj = [];
                        // console.log(examScheduleList)
                        if (result1.length > 0) {
                            result1.forEach(function (classData) {
                                var gradesData = [{ grade: "A1", count: 0, students: [] },
                                { grade: "A2", count: 0, students: [] },
                                { grade: "B1", count: 0, students: [] },
                                { grade: "B2", count: 0, students: [] },
                                { grade: "C1", count: 0, students: [] },
                                { grade: "C2", count: 0, students: [] },
                                { grade: "D", count: 0, students: [] },
                                { grade: "E", count: 0, students: [] }];

                                if (classData.student_marks) {
                                    console.log(classData.student_marks)

                                    if (classData.student_marks.length == 0) {

                                        next(null, []);

                                    } else {

                                        classData.student_marks.forEach(function (studentMarks) {

                                            if (studentMarks.grade == "A1") {
                                                gradesData[0].count++;
                                                gradesData[0].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "A2") {
                                                gradesData[1].count++;
                                                gradesData[1].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "B1") {
                                                gradesData[2].count++;
                                                gradesData[2].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "B2") {
                                                gradesData[3].count++;
                                                gradesData[3].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "C1") {
                                                gradesData[4].count++;
                                                gradesData[4].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "C2") {
                                                gradesData[5].count++;
                                                gradesData[5].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }
                                            if (studentMarks.grade == "D") {
                                                gradesData[6].count++;
                                                gradesData[6].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }

                                            if (studentMarks.grade == "E") {
                                                gradesData[7].count++;
                                                gradesData[7].students.push({ student_id: student.student_id, student_name: student.student_name });
                                            }

                                        })
                                    }
                                }
                                finalObj.push({ class_id: classResult.class_id, class_name: classResult.name, data: gradesData });
                            })
                        } else { }
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
                            classGrades: result1
                        });

                    }
                }
            )
        });
    });

router.route('/all_assessment_marks_by_section_id_subject_id/:section_id/:exam_title')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var exam_title = req.params.exam_title;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var studentsMarks = [];
        var subjectList = [];

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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            student_id: studentId,
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
                                                subjectId: "$subjectId",
                                                subject: "$subject_doc.name",
                                                exam_title: "$exam_title",
                                                maxMarks: "$maxMarks",
                                                marks: "$Marks",
                                                totalMarks: "$Total_marks",
                                                Percentage: "$Percentage",
                                                grade: "$Grade"
                                            }
                                    }
                                ]).sort({ subject_id: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }

                                    if(results.length == 0) {
                                        db.close();
                                        res.end('null')
                                    } else {
                                        studentData.assessments = results

                                        if (studentsResultLength == count) {

                                            next(null, studentsResult);
                                            // next(null, classData);
                                        }
                                    }
                                })
                            })
                        }
                    },
                    function getSectionSubjects(result, next) {

                        var data = db.collection('subjects').find({
                            section_id: section_id
                        }).toArray(function (err, subjectResult) {
                            if (err) {
                                next(err, null);
                            }
                            subjectList = subjectResult;
                            next(null, result, subjectResult);
                        });
                    }, function getAttendanceData(result, subjectResult, next) {
                        //   console.log(subjectResult);
                        //  console.log(result);

                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        var subjectArray = subjectResult;
                        var subjectArrayLength = subjectArray.length;

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

                                //  console.log(assessments);
                                if (assessmentsDataLength == 0) {
                                    count++;

                                } else {
                                    // var exam_marks = [];
                                    var subjects = [];
                                    for (i = 0; i < subjectArrayLength; i++) {


                                        subject_id = subjectArray[i].subject_id;

                                        for (j = 0; j < assessmentsDataLength; j++) {
                                            var percentage = 0;
                                            if (subject_id == assessments[j].subjectId) {
                                                // console.log("hema");
                                                if (Number.isInteger(parseInt(assessments[j].totalMarks))) {
                                                    totalMarks = parseInt(assessments[j].totalMarks);
                                                } else {
                                                    totalMarks = 0;
                                                };

                                                subject_name = assessments[j].subject;
                                                subjectId = assessments[j].subjectId;

                                                if (Number.isInteger(parseInt(assessments[j].maxMarks))) {
                                                    max_marks = parseInt(assessments[j].maxMarks);
                                                } else {
                                                    max_marks = 0;
                                                };

                                                grade = assessments[j].grade;
                                                percentage = assessments[j].percentage;

                                                subjects.push({ subjectId: subjectId, subject_name: subject_name, max_marks: max_marks, total_marks: totalMarks, grade: grade, percentage: percentage })
                                            }
                                        }
                                    }

                                    count++;
                                }
                                // count++;
                                studentsMarks.push({ student_id: student_id, student_name: studentName, subjects: subjects })
                                // classAttendance.push(attendanceSection);

                                if (studentDataLength == count) {
                                    next(null, studentsMarks);
                                }
                            });
                        }
                    }, function (result1, next) {
                        var finalObj = [];
                        //  console.log(result1)
                        subjectList.forEach(function (subjectList) {
                            var gradesData = [{ grade: "A1", count: 0, students: [] },
                            { grade: "A2", count: 0, students: [] },
                            { grade: "B1", count: 0, students: [] },
                            { grade: "B2", count: 0, students: [] },
                            { grade: "C1", count: 0, students: [] },
                            { grade: "C2", count: 0, students: [] },
                            { grade: "D", count: 0, students: [] },
                            { grade: "E", count: 0, students: [] }];
                            var totalCount = 0;

                            result1.forEach(function (student) {
                                // console.log({student_id : student.student_id ,student_name:student.student_name});
                                student.subjects.forEach(function (subjectMarks) {

                                    if (subjectList.subject_id == subjectMarks.subjectId) {
                                        if (subjectMarks.grade == "A1") {
                                            gradesData[0].count++;
                                            gradesData[0].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "A2") {
                                            gradesData[1].count++;
                                            gradesData[1].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "B1") {
                                            gradesData[2].count++;
                                            gradesData[2].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "B2") {
                                            gradesData[3].count++;
                                            gradesData[3].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "C1") {
                                            gradesData[4].count++;
                                            gradesData[4].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "C2") {
                                            gradesData[5].count++;
                                            gradesData[5].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }
                                        if (subjectMarks.grade == "D") {
                                            gradesData[6].count++;
                                            gradesData[6].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }

                                        if (subjectMarks.grade == "E") {
                                            gradesData[7].count++;
                                            gradesData[7].students.push({ student_id: student.student_id, student_name: student.student_name });
                                        }

                                        totalCount = gradesData[0].count + gradesData[1].count + gradesData[2].count + gradesData[3].count + gradesData[4].count + gradesData[5].count + gradesData[6].count + gradesData[7].count
                                    }
                                })
                            })

                            finalObj.push({ subject_id: subjectList.subject_id, subject_name: subjectList.name, data: gradesData, totalCount: totalCount });

                        })
                        //  console.log(JSON.stringify(finalObj));

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

module.exports = router;
