// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var async = require('async');
var router = express.Router();
var url = config.dburl;
//  var AWS = require('aws-sdk');

// function sendSMS(ToNum, msg, callback) {
//     AWS.config.update({
//         accessKeyId: 'AKIAJ4AYEOQIXGRN7SYA',
//         secretAccessKey: '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',
//         region: 'us-west-2'
//     });

//     var sns = new AWS.SNS();

//     // var msg = "This is test sms";

//     var phoneNum = '+91' + ToNum;
//     var params = {
//         Message: msg,
//         MessageStructure: 'string',
//         PhoneNumber: phoneNum
//     };


//     console.log(params);
//     sns.publish(params, function (err, data) {
//         if (err) {
//             console.log(err, err.stack); // an error occurred

//             callback(null, "failed");
//         } else {
//             console.log(data);           // successful response
//             callback(null, "SUCCESS");
//         }
//     });
// }

// fee Master
router.route('/sendsms/:phonenumber/:school_id')

    .get(function (req, res, next) {

        var phoneNumber = req.params.phonenumber;
        var school_id = req.params.school_id;
        var msg = "Hello, World!";
        sendSMS(phoneNumber, msg, function (err, status) {
            if (err) {

                res.send({
                    error: err
                });
            }
            else {
                mongo.connect(url, function (err, db) {
                    assert.equal(null, err);
                    var cursor = db.collection('messages_counter').update({
                        school_id: school_id,
                    },
                        {
                            $set: {
                                "school_id": school_id,
                                $inc: { messages: 1 }
                            }
                        },
                        { upsert: true },
                        function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            db.close();
                            res.send('true');
                        }
                    );
                })
                console.log(status)

                res.send({
                    status: status
                });
            }

        });

    });

router.route('/balanceFee_remainder/:phone')

    .post(function (req, res, next) {

        var phoneNumber = req.params.phone;
        var balance_fee = req.body.balance;
        var due_date = req.body.due_date;
        var msg = "Dear Parent, you are requested to pay your ward’s fee of Rs. " + balance_fee + " before " + due_date + ". Pay within due date to avoid late fee. Ignore if already paid."
        // var msg = "Balance Fee: " + balance_fee + ", Due on :" + due_date;
        sendSMS(phoneNumber, msg, function (err, status) {
            if (err) {

                res.send({
                    error: err
                });
            }
            else {

                res.send({
                    status: status
                });
            }

        });

    });

router.route('/SMS_assessment_marks_by_section_id/:exam_title/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var exam_title = req.params.exam_title;
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
                                db.collection('assessment_evaluation').aggregate([
                                    {
                                        $match: {
                                            exam_title: exam_title,
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
                                                exam_title: "$exam_title",
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
                                    studentData.assessments = results

                                    if (studentsResultLength == count) {

                                        next(null, studentsResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    }, function getAttendanceData(result, next) {

                        // console.log(result);
                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        // console.log(studentResult);
                        if (studentDataLength == 0) {
                            next(null, []);
                        } else {
                            // console.log("In fourth step sections attendance")
                            studentResult.forEach(function (studentData) {
                                sectionAttendence = [];
                                attendenceClass = [];
                                var msg = " ";
                                var studentsMarks = [];
                                var studentsData = studentData;
                                //console.log(studentsData)
                                var assessmentsData = studentData.assessments;
                                var assessmentsDataLength = studentData.assessments.length;
                                var student_id = studentData.student_id;
                                var phoneNum = studentData.phone;
                                var studentName = studentData.first_name + " " + studentData.last_name;
                                var roll_no = studentData.roll_no;
                                var section_id = studentData.section_id;
                                var Exam_total = 0;
                                var Exam_maxMarks = 0;
                                for (i = 0; i < assessmentsDataLength; i++) {
                                    subject_name = studentData.assessments[i].subject;
                                    subject_marks = studentData.assessments[i].totalMarks;
                                    subject_maxMarks = studentData.assessments[i].maxMarks;
                                    subject_grade = studentData.assessments[i].grade;
                                    subject_gpa = studentData.assessments[i].gpa;
                                    Exam_total += subject_marks;
                                    Exam_maxMarks += subject_maxMarks;
                                    studentsMarks.push({ subject_name: subject_name, subject_marks: subject_marks, subject_grade: subject_grade, subject_gpa: subject_gpa });
                                }
                                //console.log(studentsMarks);
                                var Exam_percentage = (Exam_total / Exam_maxMarks) * 100;
                                if (Exam_percentage > 90 && Exam_percentage <= 100) {
                                    grade = "A1", gpa = 10;
                                } else if (Exam_percentage > 80 && Exam_percentage <= 90) {
                                    grade = "A2", gpa = 9;
                                } else if (Exam_percentage > 70 && Exam_percentage <= 80) {
                                    grade = "B1", gpa = 8;
                                } else if (Exam_percentage > 60 && Exam_percentage <= 70) {
                                    grade = "B2", gpa = 7;
                                } else if (Exam_percentage > 50 && Exam_percentage <= 60) {
                                    grade = "C1", gpa = 6;
                                } else if (Exam_percentage > 40 && Exam_percentage <= 50) {
                                    grade = "C2", gpa = 5;
                                } else if (Exam_percentage > 34 && Exam_percentage <= 40) {
                                    grade = "D", gpa = 4;
                                } else {
                                    grade = "E", gpa = 3;
                                };
                                var studentsMarksLength = studentsMarks.length;
                                msg = "Your ward " + studentName + "'s " + exam_title + " Marks: "
                                for (j = 0; j < studentsMarksLength; j++) {
                                    var sub = studentsMarks[j].subject_name + '- ' + studentsMarks[j].subject_grade + ', ' + studentsMarks[j].subject_gpa + '; '
                                    msg += sub;
                                }
                                var exam_results = "Total Marks: " + grade + ", " + gpa
                                msg += exam_results;
                                console.log(msg)

                                sendSMS(phoneNum, msg, function (err, status) {

                                });

                                count++;
                                // studentsMarks.push({ section_id: section_id, student_id: student_id, student_name: studentName, roll_no: roll_no, assessments: studentData.assessments })

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




module.exports = router;