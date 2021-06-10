// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var router = express.Router();
var async = require('async');
var url = config.dburl;

router.route('/attendance_class_schedules/:select_date/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        var current_date = new Date(req.params.select_date);
        var date = current_date.getDate();
        if (date <= 9) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month <= 9) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var weekDay = current_date.getDay();

        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = Day[weekDay];
        var teacher_schedule = [];
        var teacher_subjects = [];

        var select_date = year + '-' + month + '-' + date;
        console.log(select_date)

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getTeacherSections(next) {
                        var cursor = db.collection('timetable').aggregate([
                            {
                                $match: {
                                    'teacher_id': employee_id,
                                    day: day,
                                    status: 1
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "class_sections",
                                    "localField": "section_id",
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
                                "$project": {
                                    "class_id": "$class_doc.class_id",
                                    "class_name": "$class_doc.name",
                                    "section_id": "$sections_doc.section_id",
                                    "section_name": "$sections_doc.name",
                                    "subject_id": "$subject_id",
                                    "subject_name": "$subject_doc.name",
                                    "classTeacher_id": "$sections_doc.employee_id",
                                    "classTeacher_name": "$sections_doc.teacher_name",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                }
                            }
                        ]);
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionStudents(result, next) {
                        var count = 0;
                        var sectionResult = result;
                        var sectionResultLength = result.length;
                        if (sectionResultLength == 0) {
                            next(null, []);
                        } else {
                            sectionResult.forEach(function (sectionData) {
                                var sectionId = sectionData.section_id;
                                db.collection('students').aggregate([
                                    {
                                        $match: {
                                            section_id: sectionId,
                                            status: 1,
                                        }
                                    },
                                    {
                                        "$project": {
                                            "student_id": "$student_id",
                                            "first_name": "$first_name",
                                            "last_name": "$last_name",
                                            "roll_no": "$roll_no",
                                            "studentImage": "$studentImage",
                                            "status": ""
                                        }
                                    }
                                ]).sort({ roll_no: 1 }).toArray(function (err, stdResult) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }

                                    if (stdResult.length > 0) {
                                        sectionData.students = stdResult;
                                    } else {
                                        sectionData.students = [];
                                    }

                                    if (sectionResultLength == count) {
                                        next(null, sectionResult);
                                    }
                                });
                            })
                        }
                    },
                    function getStudentAttendance(result, next) {
                        var count = 0;
                        var sectionResult = result;
                        var sectionResultLength = result.length;
                        if (sectionResultLength == 0) {
                            next(null, []);
                        } else {
                            var sections = [];
                            var totalStudents = 0;
                            sectionResult.forEach(function (sectionData) {
                                var students = sectionData.students;
                                var sectionId = sectionData.section_id;
                                var subjectId = sectionData.subject_id;
                                totalStudents += students.length;
                                var count1 = 0;
                                var datacounter = 0;
                                var present = 0;
                                var absent = 0;
                                var leave = 0;
                                if (students.length > 0) {
                                    students.forEach(function (studentData) {
                                        var studentId = studentData.student_id;
                                        db.collection('attendance').aggregate([
                                            {
                                                $match: {
                                                    section_id: sectionId,
                                                    student_id: studentId,
                                                    date: select_date,
                                                }
                                            },
                                            {
                                                "$unwind": "$subjects"
                                            },
                                            {
                                                $match: {
                                                    "subjects.subject_id": subjectId
                                                }
                                            },
                                            {
                                                "$project": {
                                                    "subject_id": "$subjects.subject_id",
                                                    "status": "$subjects.status",
                                                }
                                            }
                                        ]).toArray(function (err, attResult) {
                                            count1++
                                            count++
                                            console.log(attResult)
                                            if (err) {
                                                next(err, null);
                                            }

                                            if (attResult.length > 0) {
                                                datacounter++;
                                                if (attResult[0].status === "Present") {
                                                    studentData.status = attResult[0].status;
                                                    present++;
                                                } else if (attResult[0].status === "Absent") {
                                                    studentData.status = attResult[0].status;
                                                    absent++;
                                                } else if (attResult[0].status === "On Leave") {
                                                    studentData.status = attResult[0].status;
                                                    leave++;
                                                } else {
                                                    studentData.status = "Pending";
                                                }
                                            } else if (attResult.length === 0) {
                                                studentData.status = "Pending";
                                            }
                                            if (students.length === count1) {
                                                if (datacounter > 0) {
                                                    var attendance_status = 'Attendance Taken';
                                                } else {
                                                    var attendance_status = 'Attendance Pending';
                                                }
                                                sections.push({
                                                    class_id: sectionData.class_id,
                                                    class_name: sectionData.class_name,
                                                    section_id: sectionData.section_id,
                                                    section_name: sectionData.section_name,
                                                    subject_id: sectionData.subject_id,
                                                    subject_name: sectionData.subject_name,
                                                    classTeacher_id: sectionData.classTeacher_id,
                                                    classTeacher_name: sectionData.classTeacher_name,
                                                    start_time: sectionData.start_time,
                                                    end_time: sectionData.end_time,
                                                    attendance_status: attendance_status,
                                                    students: students,
                                                    total_students: students.length,
                                                    present: present,
                                                    absent: absent,
                                                    leave: leave,
                                                })
                                            }
                                            if (totalStudents === count) {
                                                next(null, sections)
                                            }
                                        })
                                    })
                                } else {
                                    sections.push({
                                        class_id: sectionData.class_id,
                                        class_name: sectionData.class_name,
                                        section_id: sectionData.section_id,
                                        section_name: sectionData.section_name,
                                        subject_id: sectionData.subject_id,
                                        subject_name: sectionData.subject_name,
                                        classTeacher_id: sectionData.classTeacher_id,
                                        classTeacher_name: sectionData.classTeacher_name,
                                        start_time: sectionData.start_time,
                                        end_time: sectionData.end_time,
                                        attendance_status: 'Attendance Not Applicable',
                                        students: [],
                                        total_students: 0,
                                        present: 0,
                                        absent: 0,
                                        leave: 0,
                                    })
                                }
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
                            Teacher_Schedule: result1
                        });

                    }
                }
            );
        });
    });

router.route('/attendance_section/:select_date/:section_id/:student_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var student_id = req.params.student_id;
        var current_date = new Date(req.params.select_date);
        var date = current_date.getDate();
        if (date <= 9) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month <= 9) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var weekDay = current_date.getDay();

        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = Day[weekDay];

        var select_date = year + '-' + month + '-' + date;
        console.log(select_date)
        console.log(day)

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getTeacherSections(next) {
                        var cursor = db.collection('timetable').aggregate([
                            {
                                $match: {
                                    'section_id': section_id,
                                    day: day,
                                    status: 1
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "class_sections",
                                    "localField": "section_id",
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
                                    "class_id": "$class_doc.class_id",
                                    "class_name": "$class_doc.name",
                                    "section_id": "$sections_doc.section_id",
                                    "section_name": "$sections_doc.name",
                                    "subject_id": "$subject_doc.subject_id",
                                    "subject_name": "$subject_doc.name",
                                    "teacher_id": "$teacher_id",
                                    "teacher_name": "$employee_doc.first_name",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                }
                            }
                        ]);
                        cursor.sort({ start_time: 1 }).toArray(function (err, result) {
                            console.log(result)

                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionAttendance(result, next) {
                        var count = 0;
                        var sectionResult = result;
                        var sectionResultLength = result.length;
                        if (sectionResultLength == 0) {
                            next(null, []);
                        } else {
                            sectionResult.forEach(function (sectionData) {
                                var sectionId = sectionData.section_id;
                                db.collection('attendance').aggregate([
                                    {
                                        $match: {
                                            date: select_date,
                                            section_id: sectionId,
                                            student_id: student_id,
                                        }
                                    },
                                    { $unwind: '$subjects' },
                                    {
                                        $match: {
                                            "subjects.subject_id": sectionData.subject_id,
                                        }
                                    },
                                    {
                                        "$project": {
                                            "subject_id": "$subjects.subject_id",
                                            "status": "$subjects.status",
                                        }
                                    }
                                ]).toArray(function (err, attResult) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (attResult.length > 0) {
                                        sectionData.attendance_status = attResult[0].status;
                                    } else {
                                        sectionData.attendance_status = 'Pending';
                                    }

                                    if (sectionResultLength == count) {
                                        next(null, sectionResult);
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
                            Teacher_Schedule: result1
                        });

                    }
                }
            );
        });
    });

// Add Attandance
router.route('/attendance/:student_id')
    .put(function (req, res, next) {
        var student_id = req.params.student_id;
        var att_date = req.body.date;
        var d = new Date(att_date);
        var month = d.getMonth() + 1;
        var day = d.getDate()
        var year = d.getFullYear()
        var select_date = new Date(year, d.getMonth(), day, 05, 30, 0, 0);
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        var time = d.getHours();
        var myquery = { student_id: req.params.student_id, date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) } };
        var req_status = req.body.status;
        mongo.connect(url, function (err, db) {
            db.collection('attendance').update(myquery, {
                $set: {
                    status: req_status,
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

// Get Exam Attendance
router.route('/getExam_attendance/:Assessment/:exam_paper_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var Assessment = req.params.Assessment;
        var exam_paper_id = req.params.exam_paper_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('exams').aggregate([
                {
                    $match: {
                        exam_paper_id: exam_paper_id,
                        status: 1
                    }
                },
                {
                    "$unwind": "$exams"
                },
                {
                    $match: {
                        "exams.Assessment": Assessment,
                    }
                },
                {
                    "$lookup": {
                        "from": "subjects",
                        "localField": "subject_id",
                        "foreignField": "subject_id",
                        "as": "subjects_doc"
                    }
                },
                {
                    "$unwind": "$subjects_doc"
                },
                {
                    "$project": {
                        "exam_paper_id": "$exam_paper_id",
                        "exam_title": "$exam_title",
                        "section_id": "$section_id",
                        "subject_id": "$subject_id",
                        "subject": "$subjects_doc.name",
                        "Assessment": "$exams.Assessment",
                        "assessment_mode": "$exams.assessment_mode",
                        "max_marks": "$exams.max_marks",
                        "Exam_date": "$exams.Exam_date",
                        "Start_time": "$exams.Start_time",
                        "End_time": "$exams.End_time",
                    }
                }
            ]);
            cursor.toArray(function (err, result) {
                if (err) {
                    res.end('false1')
                }
                else {
                    if (result.length > 0) {
                        result.forEach(function (exam) {
                            if(exam.Exam_date === "") {
                                exam.Exam_date = null;
                                exam.Start_time = null;
                                exam.End_time = null;
                            }
                        })
                        db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: result[0].section_id,
                                    status: 1
                                }
                            },
                            {
                                "$project": {
                                    "student_id": "$student_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "surname": "$surname",
                                    "roll_no": "$roll_no",
                                    "studentImage": "$studentImage.imageSrc",
                                }
                            }
                        ]).toArray(function (err, result1) {
                            if (err) {
                                res.end('false2')
                            } else {
                                if (result1.length > 0) {
                                    result[0].students = result1;
                                    db.close();
                                    res.send(result);
                                } else {
                                    db.close();
                                    res.send('No Students Available')
                                }
                            }
                        })
                    }
                    else {
                        db.close();
                        res.end('No Exams')
                    }
                }
            });
        });
    });

router.route('/Exam_attendance/:select_date/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        var current_date = new Date(req.params.select_date);
        var date = current_date.getDate();
        if (date <= 9) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month <= 9) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var weekDay = current_date.getDay();

        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = Day[weekDay];
        var exams = [];

        var select_date = year + '-' + month + '-' + date;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getTeacherSubjects(next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    'teacher_id': employee_id,
                                    status: 1
                                }
                            },
                            {
                                "$project": {
                                    "subjects": "$subjects",
                                }
                            }
                        ]);
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else {
                                teacher_subjects = result[0].subjects;
                                next(null, teacher_subjects);
                            }
                        });
                    },
                    function getExamSchedules(teacher_subjects, next) {
                        var count = 0;
                        teacher_subjects.forEach(function (sub) {
                            var subject_id = sub.subject_id;
                            var cursor = db.collection('exams').aggregate([
                                {
                                    $match: {
                                        subject_id: subject_id,
                                        status: 1
                                    }
                                },
                                {
                                    "$unwind": "$exams"
                                },
                                {
                                    $match: {
                                        "exams.Exam_date": select_date,
                                    }
                                },
                                {
                                    "$lookup": {
                                        "from": "subjects",
                                        "localField": "subject_id",
                                        "foreignField": "subject_id",
                                        "as": "subjects_doc"
                                    }
                                },
                                {
                                    "$unwind": "$subjects_doc"
                                },
                                {
                                    "$lookup": {
                                        "from": "class_sections",
                                        "localField": "section_id",
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
                                        "localField": "sections_doc.class_id",
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
                                        "section_name": "$sections_doc.name",
                                        "subject_id": "$subject_id",
                                        "subject_name": "$subjects_doc.name",
                                        "exam_paper_id": "$exam_paper_id",
                                        "exam_title": "$exam_title",
                                        "exams": "$exams",
                                    }
                                }
                            ]);
                            cursor.toArray(function (err, result) {
                                count++;
                                if (err) {
                                    next(err, null);
                                }
                                else {                                    
                                    result.forEach(function (doc) {
                                        exams.push(doc)
                                    })
                                    if(count === teacher_subjects.length) {
                                        next(null, exams);
                                    }
                                }
                            });
                        })
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
                            Exam_Schedule: result1
                        });

                    }
                }
            );
        });
    });

router.route('/ExamAttendancebulk/:date/:section_id')
    .post(function (req, res, next) {

        var section_id = req.params.section_id;
        var splitted = section_id.split('-');
        var class_id = splitted[0] + '-' + splitted[1];
        var school_id = splitted[0];

        var subject_id = req.body.subject_id;
        var examination_pattern_id = req.body.examination_pattern_id;
        var Assessment = req.body.Assessment;
        var exam_paper_id = req.body.exam_paper_id;
        var user_id = req.body.user_id;
        var date = req.params.date;
        var d = new Date(date);
        var splited = date.split("-");
        var day = parseInt(splited[2]);
        var month = parseInt(splited[1]);
        var year = parseInt(splited[0]);
        var hours = d.getHours();

        if (hours < 10) {
            hours = '0' + hours
        }
        var minutes = d.getMinutes();
        if (minutes < 10) {
            minutes = '0' + minutes
        }
        var time = hours + ':' + minutes
        var resultArray = [];

        if (class_id == null || section_id == null || school_id == null || req.body.students.length === 0) {
            res.end('null');
        } else {
            mongo.connect(url, function (err, db) {
                async.waterfall(
                    [
                        function PostStudentAttendance(next) {
                            var studentsResult = req.body.students;
                            var studentsResultLength = studentsResult.length;
                            if (studentsResultLength > 0) {
                                var count = 0;
                                studentsResult.forEach(function (studentData) {
                                    var exam = {};
                                    attendance = [];
                                    exam.Assessment = Assessment;
                                    exam.date = date;
                                    exam.atten_date = d;
                                    exam.day = day;
                                    exam.month = month;
                                    exam.year = year;
                                    exam.user_id = user_id;
                                    exam.status = studentData.status;
                                    exam.time = time;

                                    db.collection('ExamAttendance').find({
                                        student_id: studentData.student_id,
                                        subject_id: subject_id,
                                        examination_pattern_id: examination_pattern_id
                                    }).toArray(function (err, resultArray) {
                                        if (resultArray.length === 1) {
                                            var exams = resultArray[0].exams;
                                            var exam_count = 0;
                                            exams.forEach(function (doc, err) {
                                                if (doc.Assessment === Assessment) {
                                                    exam_count++;
                                                }
                                            })
                                            if (exam_count === 0) {
                                                db.collection('ExamAttendance').update({
                                                    student_id: studentData.student_id,
                                                    subject_id: subject_id,
                                                    examination_pattern_id: examination_pattern_id
                                                }, {
                                                    $push: {
                                                        exams: exam,
                                                    }
                                                }, function (err, result) {
                                                    count++;
                                                    console.log(count)
                                                    assert.equal(null, err);
                                                    if (err) {
                                                        next(null, 'error');
                                                    } else if (count === studentsResultLength) {
                                                        console.log(count)
                                                        next(null, 'true');
                                                    }
                                                });
                                            } else if (exam_count > 0) {
                                                count++
                                                if (count === studentsResultLength) {
                                                    next(null, 'false');
                                                }
                                            }
                                        } else {
                                            var exams = [];
                                            exams.push(exam)
                                            var item = {
                                                ExamAttendance_id: '',
                                                student_id: studentData.student_id,
                                                class_id: class_id,
                                                section_id: section_id,
                                                school_id: school_id,
                                                subject_id: subject_id,
                                                examination_pattern_id: examination_pattern_id,
                                                status: 1,
                                                exams: exams,
                                            };
                                            var collection = db.collection('ExamAttendance');
                                            autoIncrement.getNextSequence(db, 'ExamAttendance', function (err, autoIndex) {
                                                collection.ensureIndex({
                                                    "ExamAttendance_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    if (item.class_id == null) {
                                                        next(null, 'No Data');
                                                    } else {
                                                        collection.find({ student_id: studentData.student_id }).count(function (err, triggerCount) {
                                                            var id = triggerCount + 1;
                                                            item.ExamAttendance_id = studentData.student_id + '-EXAT' + id;
                                                            collection.insertOne(item, function (err, result) {
                                                                if (err) {
                                                                    if (err.code == 11000) {
                                                                        next(null, 'error');
                                                                    }
                                                                    next(null, 'error');
                                                                }
                                                                count++;
                                                                if (count == studentsResultLength) {
                                                                    next(null, 'true');
                                                                }
                                                            });
                                                        })
                                                    }
                                                });
                                            })
                                        }
                                    });
                                })
                            } else {
                                next(null, 'No Students Data');
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
            })
        }
    })

// add bulk attendance 
router.route('/attendancebulk/:date/:class_id/:section_id/:school_id')
    .post(function (req, res, next) {

        var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        var school_id = req.params.school_id;
        var subject_id = req.body.subject_id;
        var user_id = req.body.user_id;
        var date = req.params.date;
        var d = new Date(date);
        var splited = date.split("-");
        var day = parseInt(splited[2]);
        var month = parseInt(splited[1]);
        var year = parseInt(splited[0]);
        var hours = d.getHours();

        if (hours < 10) {
            hours = '0' + hours
        }
        var minutes = d.getMinutes();
        if (minutes < 10) {
            minutes = '0' + minutes
        }
        var time = hours + ':' + minutes
        var resultArray = [];

        if (class_id == null || section_id == null || school_id == null || !req.body.students) {
            res.end('null');
        } else {

            mongo.connect(url, function (err, db) {
                async.waterfall(
                    [
                        function PostStudentAttendance(next) {
                            var studentsResult = req.body.students;
                            var studentsResultLength = studentsResult.length;
                            if (studentsResultLength > 0) {
                                var count = 0;
                                studentsResult.forEach(function (studentData) {
                                    var subject = {};
                                    if (time >= 13) {
                                        var session = 'afternoon';
                                    } else {
                                        var session = 'morning';
                                    }
                                    attendance = [];
                                    if (req.body.session) {
                                        var session = req.body.session;
                                    }

                                    subject.subject_id = subject_id;
                                    subject.user_id = user_id;
                                    subject.status = studentData.status;
                                    subject.time = time;

                                    db.collection('attendance').find({
                                        date: date,
                                        student_id: studentData.student_id
                                    }).toArray(function (err, resultArray) {
                                        if (resultArray.length === 1) {
                                            var subjects = resultArray[0].subjects;
                                            var subject_count = 0;
                                            subjects.forEach(function (doc, err) {
                                                if (doc.subject_id === subject_id) {
                                                    subject_count++;
                                                }
                                            })
                                            if (subject_count === 0) {
                                                db.collection('attendance').update({
                                                    date: date,
                                                    student_id: studentData.student_id
                                                }, {
                                                    $push: {
                                                        subjects: subject,
                                                    }
                                                }, function (err, result) {
                                                    count++;
                                                    console.log(count)
                                                    assert.equal(null, err);
                                                    if (err) {
                                                        next(null, 'error');
                                                    } else if (count === studentsResultLength) {
                                                        console.log(count)
                                                        next(null, 'true');
                                                    }
                                                });
                                            } else if (subject_count === 1) {
                                                count++
                                                if (count === studentsResultLength) {
                                                    next(null, 'false');
                                                }
                                            }
                                        } else {
                                            var subjects = [];
                                            subjects.push(subject)
                                            var item = {
                                                attendance_id: '',
                                                student_id: studentData.student_id,
                                                class_id: class_id,
                                                section_id: section_id,
                                                school_id: school_id,
                                                date: date,
                                                atten_date: d,
                                                day: day,
                                                month: month,
                                                year: year,
                                                status: studentData.status,
                                                subjects: subjects,
                                            };
                                            var collection = db.collection('attendance');
                                            autoIncrement.getNextSequence(db, 'attendance', function (err, autoIndex) {
                                                collection.ensureIndex({
                                                    "attendance_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    if (item.class_id == null) {
                                                        next(null, 'No Data');
                                                    } else {
                                                        collection.find({ student_id: studentData.student_id }).count(function (err, triggerCount) {
                                                            var id = triggerCount + 1;
                                                            item.attendance_id = studentData.student_id + '-AT' + id;
                                                            collection.insertOne(item, function (err, result) {
                                                                if (err) {
                                                                    if (err.code == 11000) {
                                                                        next(null, 'error');
                                                                    }
                                                                    next(null, 'error');
                                                                }
                                                                count++;
                                                                if (count == studentsResultLength) {
                                                                    next(null, 'true');
                                                                }
                                                            });
                                                        })
                                                    }
                                                });
                                            })
                                        }
                                    });
                                })
                            } else {
                                next(null, 'No Students Data');
                            }
                        },
                        function dailySchedule(res, next) {

                            if (res === 'true') {
                                var cursor1 = db.collection('daily_schedule').find({
                                    date: date,
                                    section_id: section_id
                                })
                                cursor1.count(function (e, triggerCount) {
                                    if (triggerCount == 1) {
                                        var subject = {
                                            subject_id: subject_id,
                                            attendance: 1,
                                            topics: 0,
                                        }
                                        db.collection('daily_schedule').update({
                                            date: date,
                                            section_id: section_id
                                        },
                                            {
                                                $push: {
                                                    subjects: subject,
                                                }
                                            },
                                            function (err, result) {

                                                assert.equal(null, err);
                                                if (err) {
                                                    next(null, 'error');
                                                }
                                                next(null, 'true');
                                            });
                                    } else {

                                        var item1 = {
                                            daily_schedule_id: 'getauto',
                                            class_id: class_id,
                                            section_id: section_id,
                                            date: date,
                                            subjects: [],
                                        }
                                        var subject = {
                                            subject_id: subject_id,
                                            attendance: 1,
                                            topics: 0,
                                        }
                                        var collection1 = db.collection('daily_schedule');
                                        autoIncrement.getNextSequence(db, 'daily_schedule', function (err, autoIndex) {
                                            collection1.ensureIndex({
                                                "daily_schedule_id": 1,
                                            }, {
                                                unique: true
                                            }, function (err, result) {
                                                if (item1.section_id == null || subject.subject_id == null || item1.date == null) {
                                                    next(null, 'null');
                                                } else {
                                                    console.log(res)
                                                    item1.daily_schedule_id = section_id + '-SCH-' + autoIndex;
                                                    item1.subjects.push(subject)
                                                    collection1.insertOne(item1, function (err, result) {
                                                        if (err) {
                                                            if (err.code == 11000) {
                                                                next(null, 'error');
                                                            }
                                                            next(null, 'error');
                                                        } else {
                                                            next(null, 'true');
                                                        }
                                                    });
                                                }
                                            });
                                        })
                                    }
                                });
                            } else if (res === 'false') {
                                next(null, 'false')
                            } else {
                                next(null, res)
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
                            // res.send({data: result1});
                            res.send(result1);
                        }
                    }
                )
            })
        }
    })

router.route('/attendance_section/:date/:section_id')
    .get(function (req, res, next) {

        var date = req.params.date;
        var section_id = req.params.section_id;
        var resultArray = [];
        var present = 0;
        var absent = 0;
        var onleave = 0;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('attendance').find({
                section_id: section_id,
                date: date
            });
            cursor.forEach(function (doc, err) {
                if (doc.status === 'Present') {
                    present++;
                } else if (doc.status === 'Absent') {
                    absent++;
                } else if (doc.status === 'On Leave') {
                    onleave++;
                }
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                var total = resultArray.length;
                if (total > 0) {
                    var presentPercent = (present / total) * 100;
                    var absentPercent = (absent / total) * 100;
                    var onleavePercent = (onleave / total) * 100;
                } else {
                    var presentPercent = 0;
                    var absentPercent = 0;
                    var onleavePercent = 0;
                }
                db.close();
                res.send({
                    total: total, present: present, absent: absent, onleave: onleave, presentPercent: presentPercent, absentPercent: absentPercent, onleavePercent: onleavePercent, attendance: resultArray
                });
            });
        });
    });

router.route('/sectionAttendenceByDate/:section_id/:select_date')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var select_date = new Date(req.params.select_date);
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var data = db.collection('attendance').find({
                date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) },
                section_id: section_id
            }).count(function (e, triggerCount) {

                if (triggerCount > 0) {
                    res.send("submitted");
                    db.close();
                }
                else {
                    res.send("not submitted");
                    db.close();
                }
            });
        });
    });

router.route('/allClasses_Attendence_by_date/:select_date/:class_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var select_date = new Date(req.params.select_date);
        var endDate = new Date(select_date);
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        endDate.setDate(endDate.getDate() + 1)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var sectionsArray = db.collection('class_sections').find({ class_id: class_id });

            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        date: {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        school_id: school_id,
                        class_id: class_id,
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
                    $group: {
                        _id: '$_id',
                        class_name: {
                            "$first": "$class_doc.name"
                        },
                        section_name: {
                            "$first": "$section_doc.name"
                        },
                        status: {
                            "$first": "$status"
                        },
                        student_name: {
                            "$first": "$student_doc.first_name"
                        }

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
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent,
                    classAttendence: resultArray
                });
            });
        });
    });


router.route('/section_attendence_by_Date/:select_date/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var select_date = new Date(req.params.select_date);
        var present = 0, absent = 0, onLeave = 0;
        var endDate = new Date(select_date);
        var count = 0, dataCount;
        endDate.setDate(endDate.getDate() + 1)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('attendance').aggregate([
                {
                    $match: {
                        date: {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        section_id: section_id
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
                    $group: {
                        _id: '$_id',
                        class_name: {
                            "$first": "$class_doc.name"
                        },
                        section_name: {
                            "$first": "$section_doc.name"
                        },
                        status: {
                            "$first": "$status"
                        },
                        student_name: {
                            "$first": "$student_doc.first_name"
                        }
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
                    sectionAttendence: resultArray,
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent
                });
            });

        });
    });

router.route('/edit_attendance/:attendance_id/:name/:value')
    .post(function (req, res, next) {
        var attendance_id = req.params.attendance_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('attendance').update({
                attendance_id
            }, {
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


router.route('/get_attendance/:student_id/')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('attendance').find({
                student_id
            }, {
                'status': 1,
                'session': 1,
                'date': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/get_attendance_by_date/:student_id/:date')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var date = req.params.date;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('attendance').find({
                student_id,
                date
            }, {
                'status': 1,
                'session': 1,
                'date': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/get_attendance_id_by_date_session/:student_id/:date/:session')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var date = req.params.date;
        var session = req.params.session;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('attendance').find({
                student_id,
                date,
                session
            }, {
                'attendance_id': 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

module.exports = router;