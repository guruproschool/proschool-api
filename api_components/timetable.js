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

// Add Timetable

router.route('/class_timetable/:section_id')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var start_time = req.body.start_time;
        var day = req.body.day;

        var item = {
            timetable_id: 'getauto',
            section_id: section_id,
            day: req.body.day,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            class_id: class_id,
            school_id: school_id,
            room_no: req.body.room_no,
            teacher_id: req.body.teacher_id,
            subject_id: req.body.subject_id,
            session_id: req.body.session_id,
            date: new Date(),
            status: 1,
        }

        var myquery = { section_id: section_id, day: day, start_time: start_time };

        mongo.connect(url, function (err, db) {
            var collection = db.collection("timetable");
            collection.find({
                section_id: section_id, day: day, start_time: start_time
            }).toArray(function (err, results) {
                if (err) {
                    res.send('false')
                } else if (results.length == 0) {
                    autoIncrement.getNextSequence(db, 'timetable', function (err, autoIndex) {
                        collection.ensureIndex({
                            "timetable_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.subject_id == null || item.teacher_id == null) {
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
                                                timetable_id: section_id + '-TT' + id
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
                    collection.update(myquery, {
                        $set: {
                            subject_id: item.subject_id,
                            teacher_id: item.teacher_id,
                            status: 1
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        }
                        db.close();
                        res.send('true');
                    });
                }
            })
        })
    });

router.route('/class_timetable/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('timetable').aggregate([
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
                { "$unwind": "$subject_doc" },
                // {
                //     "$redact": {
                //         "$cond": [
                //             { "$eq": [subject_id, "$subject_doc.subject_id"] },
                //             "$$KEEP",
                //             "$$PRUNE"
                //         ]
                //     }
                // },
                {
                    "$project": {
                        "_id": "$_id",
                        "timetable_id": "$timetable_id",
                        "section_id": "$section_id",
                        "day": "$day",
                        "start_time": "$start_time",
                        "end_time": "$end_time",
                        "room_no": "$room_no",
                        "subject_id": "$subject_id",
                        "name": "$subject_doc.name",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    timetable: resultArray
                });
            });
        });
    });

router.route('/class_timetable_by_week/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var Day = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSectionTimings(next) {
                        db.collection('session_timings').aggregate([
                            {
                                $match: {
                                    section: section_id,
                                    status: 1
                                }
                            },
                            {
                                "$project": {
                                    "session_id": "$session_id",
                                    "session": "$session",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                }
                            }
                        ]).sort({ start_time: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionTimetable(result, next) {
                        var count = 0;
                        var timingResult = result;
                        var timingResultLength = result.length;
                        if (timingResultLength == 0) {
                            next(null, []);
                        } else {
                            var timetable = [];
                            timingResult.forEach(function (timingData) {

                                var start_time = timingData.start_time;
                                var end_time = timingData.end_time;
                                var session_id = timingData.session_id;
                                var session = timingData.session;
                                var cursor = db.collection('timetable').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            session_id: session_id,
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
                                    { "$unwind": "$subject_doc" },
                                    {
                                        "$lookup": {
                                            "from": "employee",
                                            "localField": "teacher_id",
                                            "foreignField": "employee_id",
                                            "as": "teacher_doc"
                                        }
                                    },
                                    { "$unwind": "$teacher_doc" },
                                    {
                                        $group: {
                                            _id: '$_id',
                                            timetable_id: {
                                                "$first": "$timetable_id"
                                            },
                                            teacher_name: {
                                                "$first": "$teacher_doc.first_name"
                                            },
                                            employee_id: {
                                                "$first": "$teacher_doc.employee_id"
                                            },
                                            employee_image: {
                                                "$first": "$teacher_doc.employeeImage.imageSrc"
                                            },
                                            section_id: {
                                                "$first": "$section_id"
                                            },
                                            day: {
                                                "$first": "$day"
                                            },
                                            start_time: {
                                                "$first": "$start_time"
                                            },
                                            end_time: {
                                                "$first": "$end_time"
                                            },
                                            room_no: {
                                                "$first": "$room_no"
                                            },
                                            name: {
                                                "$first": "$subject_doc.name"
                                            },
                                        }
                                    },
                                ])
                                cursor.toArray(function (err, resultArray) {
                                    console.log(resultArray)
                                    var scheduleData = [];
                                    var countday = 0;
                                    Day.forEach(function (DayData) {
                                        if (resultArray.length > 0) {
                                            var count1 = 0;
                                            for (var i = 0; i < resultArray.length; i++) {
                                                if (resultArray[i].day === DayData) {
                                                    scheduleData.push(resultArray[i])
                                                } else {
                                                    count1++;
                                                }
                                                if (count1 === resultArray.length) {
                                                    scheduleData.push({ day: DayData, name: 'No Data' })
                                                }
                                            }
                                        } else {
                                            scheduleData.push({ day: DayData, name: 'No Data' })
                                        }
                                        countday++;
                                        if (countday === Day.length) {
                                            // timetable.push({ start_time: start_time, end_time: end_time, session_id: session_id, session: session, schedule: scheduleData })
                                            timingData.schedule = scheduleData;
                                            count++;
                                            if (count === timingResultLength) {
                                                console.log(timingResultLength)
                                                next(null, timingResult);
                                            }
                                        }
                                    })
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
            );
        });
    });

router.route('/class_timetables/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('timetable').aggregate([
                {
                    $match: {
                        section_id: section_id,
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
                { "$unwind": "$subject_doc" },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "teacher_id",
                        "foreignField": "employee_id",
                        "as": "teacher_doc"
                    }
                },
                { "$unwind": "$teacher_doc" },
                {
                    "$project": {
                        "_id": "$_id",
                        "timetable_id": "$timetable_id",
                        "teacher_name": "$teacher_doc.first_name",
                        "employee_id": "$teacher_doc.employee_id",
                        "section_id": "$section_id",
                        "day": "$day",
                        "start_time": "$start_time",
                        "end_time": "$end_time",
                        "room_no": "$room_no",
                        "subject_id": "$subject_id",
                        "name": "$subject_doc.name",
                    }
                }
            ]).sort({start_time: 1})
            // var cursor = db.collection('timetable').find({section_id});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    timetable: resultArray
                });
            });
        });
    });

router.route('/classes_timetable_by_day/:day/:select_date/:class_id')
    .get(function (req, res, next) {
        var result = [];
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
        var day = req.params.day;
        var select_date = year + '-' + month + '-' + date;
        var class_id = req.params.class_id;
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = Day[day];
        console.log(select_date)

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getTimetableData(next) {
                        db.collection('timetable').aggregate([
                            {
                                $match: {
                                    day: day,
                                    class_id: class_id,
                                    status: 1
                                }
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
                                    from: "employee",
                                    localField: "teacher_id",
                                    foreignField: "employee_id",
                                    as: "employee_doc"
                                }
                            },
                            {
                                $unwind: "$employee_doc"
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
                                    section_id: {
                                        "$first": "$section_doc.section_id"
                                    },
                                    subject_id: {
                                        "$first": "$subject_doc.subject_id"
                                    },
                                    class_id: {
                                        "$first": "$class_doc.class_id"
                                    },
                                    day: {
                                        "$first": "$day"
                                    },
                                    subject_name: {
                                        "$first": "$subject_doc.name"
                                    },
                                    start_time: {
                                        "$first": "$start_time"
                                    },
                                    end_time: {
                                        "$first": "$end_time"
                                    },
                                    employee_id: {
                                        "$first": "$teacher_id"
                                    },
                                    teacher_name: {
                                        "$first": "$employee_doc.first_name"
                                    },
                                }
                            },
                        ]).sort({start_time: 1}).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeeAttendance(result, next) {
                        var count = 0;
                        var timetableResult = result;
                        var timetableResultLength = result.length;
                        if (timetableResultLength == 0) {
                            next(null, []);
                        } else {
                            timetableResult.forEach(function (timetableData) {
                                var employee_id = timetableData.employee_id;

                                db.collection('employee_attendance').find({
                                    employee_id: employee_id,
                                    date: select_date
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    console.log(results);
                                    if (results.length > 0) {
                                        timetableData.employee_attendance = results[0].status;
                                    }
                                    if (timetableResultLength == count) {
                                        next(null, timetableResult);
                                    }
                                })
                            })
                        }
                    },
                    function getSubjectAttendance(timetableResult, next) {
                        var timetableResult = timetableResult;
                        var timetableResultLength = timetableResult.length;
                        var count = 0;
                        if (timetableResultLength === 0) {
                            next(null, [])
                        } else {
                            timetableResult.forEach(function (time) {
                                var subject_id = time.subject_id;
                                var cursor = db.collection('daily_schedule').aggregate([
                                    {
                                        $match: {
                                            date: select_date,
                                            class_id: class_id,
                                        }
                                    },
                                    { $unwind: '$subjects' },
                                    {
                                        $match: {
                                            "subjects.subject_id": subject_id,
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
                                            "subject_id": "$subject_doc.subject_id",
                                            "name": "$subject_doc.name",
                                            "status": "$subjects.attendance",
                                        }
                                    }
                                ]).sort({ subject_id: 1 })
                                cursor.toArray(function (err, resultArray) {
                                    console.log(resultArray)
                                    console.log(timetableResult)
                                    count++;
                                    if (resultArray.length > 0) {
                                        if (resultArray[0].status === 1) {
                                            time.class_attendance = 'Class Taken';
                                        } else if (resultArray[0].status === 0) {
                                            time.class_attendance = 'Pending';
                                        }
                                    } else {
                                        time.class_attendance = 'Pending';
                                    }

                                    if (count === timetableResultLength) {
                                        next(null, timetableResult);
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

                        res.send({
                            timetable: result1
                        });

                    }
                }
            );
        });
    });

router.route('/classes_timetable_by_day_android/:select_day/:select_date/:class_id')
    .get(function (req, res, next) {
        var result = [];
        var results = [];
        var select_date = new Date(req.params.select_date);
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1);
        var class_id = req.params.class_id;
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var day = req.params.select_day;
        day = Day[day - 1];
        var date = new Date();
        var class_timetable = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    // function getClassDetails(next) {
                    //     db.collection('school_classes').find({
                    //         class_id: class_id
                    //     }).toArray(function (err, result) {
                    //         if(err) {
                    //             next(err, null);
                    //         }
                    //         class_timetable = result;
                    //         // console.log(class_timetable)
                    //     })
                    // },
                    function getClassSections(next) {
                        db.collection('class_sections').find({
                            class_id: class_id,
                            status: 1
                        }).sort({ name: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log(result)
                            next(null, result);
                        });
                    },
                    function getTimetableData(results, next) {
                        var count = 0;
                        var SectionResults = results;
                        var SectionResultsLength = results.length;
                        //console.log(SectionResults)
                        if (SectionResultsLength == 0) {
                            next(null, []);
                        } else {
                            SectionResults.forEach(function (section) {
                                var section_id = section.section_id;
                                db.collection('timetable').aggregate([
                                    {
                                        $match: {
                                            day: day,
                                            section_id: section_id,
                                            status: 1
                                        }
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
                                            from: "employee",
                                            localField: "teacher_id",
                                            foreignField: "employee_id",
                                            as: "employee_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$employee_doc"
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
                                            section_id: {
                                                "$first": "$section_doc.section_id"
                                            },
                                            section_id: {
                                                "$first": "$section_doc.section_id"
                                            },
                                            class_id: {
                                                "$first": "$class_doc.class_id"
                                            },
                                            day: {
                                                "$first": "$day"
                                            },
                                            subject_name: {
                                                "$first": "$subject_doc.name"
                                            },
                                            start_time: {
                                                "$first": "$start_time"
                                            },
                                            employee_id: {
                                                "$first": "$teacher_id"
                                            },
                                            teacher_name: {
                                                "$first": "$employee_doc.first_name"
                                            },
                                        }
                                    },
                                ]).sort({ start_time: 1 }).toArray(function (err, result) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    //console.log(result)
                                    section.timetable = result
                                    if (SectionResultsLength == count) {
                                        next(null, SectionResults);
                                    }
                                });
                            })
                        }
                    },
                    function getTimetable(SectionResults, next) {
                        var SectionResult = SectionResults;
                        var SectionResultLength = SectionResults.length;

                    }
                    // function getEmployeeAttendance(SectionResults, next) {
                    //     //   console.log("getSectionsData");                      
                    //     var count = 0;
                    //     var SectionResult = SectionResults;
                    //     var SectionResultLength = SectionResults.length;
                    //     console.log(SectionResult)
                    //     SectionResult.forEach(function (sectionData) {
                    //         var timetableResult = sectionData.timetable;
                    //         var timetableResultLength = timetableResult.length;
                    //         //console.log(timetableResult)
                    //         if (timetableResultLength == 0) {
                    //             next(null, []);
                    //         } else {
                    //             //  console.log("In Second step sections")
                    //             for (i = 0; i < timetableResultLength; i++) {
                    //                 var employee_id = timetableResult[i].employee_id;
                    //                 console.log(employee_id);
                    //                 db.collection('employee_attendance').find({
                    //                     employee_id: employee_id,
                    //                     'date': {
                    //                         $gte: new Date(select_date.toISOString()),
                    //                         $lt: new Date(endDate.toISOString())
                    //                     },
                    //                 }).toArray(function (err, result) {
                    //                     console.log(result);
                    //                     if (result) {
                    //                         timetableResult[i].employee_attendance = result[0].status;
                    //                     }
                    //                 })
                    //             }

                    //             count++
                    //             if (SectionResultLength == count) {
                    //                 // class_timetable.push({ Sections: SectionResult });
                    //                 // console.log(SectionResult)
                    //                 next(null, SectionResult);
                    //             }
                    //         }
                    //     })
                    // }
                ],
                function (err, result1) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            timetable: result1
                        });

                    }
                }
            );
        });
    });

router.route('/teacher_schedule_by_day/:day/:employee_id/:school_id')
    .get(function (req, res, next) {
        var teacherSchedule = [];
        var day = req.params.day;
        var school_id = req.params.school_id;
        var employee_id = req.params.employee_id;

        // var current_date = new Date(req.params.select_date);
        // var date = current_date.getDate();
        // if (date <= 9) {
        //     date = '0' + date;
        // }
        // var month = current_date.getMonth() + 1;
        // if (month <= 9) {
        //     month = '0' + month;
        // }
        // var year = current_date.getFullYear();
        // var select_date = year + '-' + month + '-' + date;

        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        day = Day[day];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolTimings(next) {
                        db.collection('session_timings').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeeAttendance(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var sessionResult = result;
                        var sessionResultLength = result.length;
                        if (sessionResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            sessionResult.forEach(function (sessionData) {
                                var session_id = sessionData.session_id;
                                var session = sessionData.session;
                                console.log(session_id)
                                db.collection('timetable').aggregate([
                                    {
                                        $match: {
                                            session_id: session_id,
                                            teacher_id: employee_id,
                                            day: day,
                                            status: 1
                                        }
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
                                        $project: {
                                            '_id': '$_id',
                                            'timetable_id': '$timetable_id',
                                            'class_id': '$class_id',
                                            "class_name": '$class_doc.name',
                                            'section_id': '$section_id',
                                            'section_name': '$section_doc.name',
                                            'subject_id': '$subject_id',
                                            'subject_name': '$subject_doc.name',
                                            'session_id': '$session_id',
                                            'start_time': '$start_time',
                                            'end_time': '$end_time',
                                            'day': '$day',
                                            'room_no': '$room_no',
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    console.log(results);
                                    if (results.length > 0) {
                                        results[0].session = session;
                                        teacherSchedule.push(results[0])
                                        // sessionData.employee_attendance = results[0].status;
                                    } else {
                                        teacherSchedule.push({
                                            session_id: session_id,
                                            session: session,
                                            class_name: 'Break',
                                            subject_name: 'Break',
                                            start_time: sessionData.start_time,
                                            end_time: sessionData.end_time,
                                            day: day,
                                        })
                                    }
                                    if (sessionResultLength == count) {

                                        next(null, teacherSchedule);
                                        // next(null, classData);
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

                        res.send({
                            teacherSchedule: result1
                        });

                    }
                }
            );
        });
    });

router.route('/teacher_schedule_day/:day/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var day = req.params.day;
        day = Day[day];

        var current_date = new Date();
        var date = current_date.getDate();
        if (date <= 9) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month <= 9) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var select_date = year + '-' + month + '-' + date;

        console.log(day)
        console.log(employee_id)

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getTimetableData(next) {
                        var cursor = db.collection('timetable').aggregate([
                            {
                                $match: {
                                    day: day,
                                    teacher_id: employee_id,
                                    status: 1
                                }
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
                                $group: {
                                    _id: '$_id',
                                    class_id: {
                                        "$first": "$class_id"
                                    },
                                    class_name: {
                                        "$first": "$class_doc.name"
                                    },
                                    section_id: {
                                        "$first": "$section_id"
                                    },
                                    section_name: {
                                        "$first": "$section_doc.name"
                                    },
                                    day: {
                                        "$first": "$day"
                                    },
                                    subject_id: {
                                        "$first": "$subject_id"
                                    },
                                    subject_name: {
                                        "$first": "$subject_doc.name"
                                    },
                                    start_time: {
                                        "$first": "$start_time"
                                    },
                                    end_time: {
                                        "$first": "$end_time"
                                    },
                                    date: {
                                        "$first": "$date"
                                    }
                                }
                            },
                        ]).sort({ 'start_time': 1 })
                        cursor.toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function getSubjectAttendance(results, next) {
                        var timetableResult = results;
                        var timetableResultLength = results.length;
                        var count = 0;
                        if (timetableResultLength === 0) {
                            next(null, [])
                        } else {
                            timetableResult.forEach(function (time) {
                                var cursor = db.collection('daily_schedule').aggregate([
                                    {
                                        $match: {
                                            date: select_date,
                                            section_id: time.section_id
                                        }
                                    },
                                    { $unwind: '$subjects' },
                                    {
                                        $match: {
                                            "subjects.subject_id": time.subject_id,
                                        }
                                    }
                                ]).sort({ subject_id: 1 })
                                cursor.toArray(function (err, resultArray) {
                                    console.log(resultArray)
                                    console.log(timetableResult)
                                    count++;
                                    if (resultArray.length > 0) {
                                        time.class_attendance = 'Class Taken';
                                    } else {
                                        time.class_attendance = 'Pending';
                                    }
                                    if (count === timetableResultLength) {
                                        next(null, timetableResult);
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
                        res.send({
                            timetable: result1
                        });
                    }
                }
            );
        });
    });

router.route('/section_timetable_by_sectionId_for_android/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        // var day = req.params.select_day;
        //  day = Day[day - 1];
        var dayTimetable = sectionTimetable = sessionTimings = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getClassSections(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('class_sections').find({
                            section_id: section_id, 
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionsData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var sectionResult = result;
                        var sectionResultLength = result.length;
                        if (sectionResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            sectionResult.forEach(function (sectionData) {
                                var section_id = sectionData.section_id;
                                // console.log(class_id);
                                db.collection('timetable').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            status: 1
                                        }
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
                                    // {
                                    //     $lookup: {
                                    //         from: "school_classes",
                                    //         localField: "class_id",
                                    //         foreignField: "class_id",
                                    //         as: "class_doc"
                                    //     }
                                    // },
                                    // {
                                    //     $unwind: "$class_doc"
                                    // },
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
                                        $group: {
                                            _id: '$_id',
                                            // class_name: {
                                            //     "$first": "$class_doc.name"
                                            // },
                                            section_name: {
                                                "$first": "$section_doc.name"
                                            },
                                            // section_id: {
                                            //     "$first": "$section_doc.section_id"
                                            // },
                                            section_id: {
                                                "$first": "$section_doc.section_id"
                                            },
                                            // class_id: {
                                            //     "$first": "$class_doc.class_id"
                                            // },
                                            day: {
                                                "$first": "$day"
                                            },
                                            subject_name: {
                                                "$first": "$subject_doc.name"
                                            },
                                            start_time: {
                                                "$first": "$start_time"
                                            },
                                            end_time: {
                                                "$first": "$end_time"
                                            }
                                        }
                                    },
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    sectionData.timetable = results

                                    if (sectionResultLength == count) {

                                        next(null, sectionResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getsessionTimings(result, next) {
                        //   console.log("getTotalSchoolAttendance");
                        // console.log(result);                        
                        var data = db.collection('session_timings').find({
                            school_id: school_id,
                            status: 1
                        }).sort({ start_time: 1 }).toArray(function (err, sessionResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, sessionResult);
                        });
                    }, function getAttendanceData(result, sessionResult, next) {

                        //  console.log(sessionResult);
                        var count = 0;
                        sessionTimings = sessionResult;
                        var sectionResult = result;
                        var sectionDataLength = result.length;
                        //  console.log(sectionDataLength + "hema");
                        if (sectionDataLength == 0) {
                            next(null, []);
                        } else {

                            sectionResult.forEach(function (sectionData) {

                                // attendenceClass = [];
                                //  console.log("babu");
                                var sectionCount = 0;
                                var sectionsData = sectionData;
                                var timetableData = [];
                                var timetableDataLength = sectionData.timetable.length;
                                var section_id = sectionData.section_id;
                                //console.log(section_id);
                                //   console.log(sectionData.timetable);
                                var sectionName = sectionData.name;


                                var timetable = sectionData.timetable;
                                // console.log(timetable);
                                var timetableLength = timetable.length;

                                dayLength = Day.length;

                                for (i = 0; i < dayLength; i++) {
                                    presentDay = Day[i];
                                    //   console.log("babu2");
                                    timetableData = [];
                                    for (j = 0; j < sessionTimings.length; j++) {

                                        var startTime = endTime = subject = "";
                                        var presentTime = sessionTimings[j].start_time;
                                        //  console.log("babu3");
                                        for (k = 0; k < timetableLength; k++) {
                                            if (presentDay == timetable[k].day) {

                                                if (sessionTimings[j].start_time == timetable[k].start_time) {
                                                    //      console.log("babu4");
                                                    startTime = timetable[k].start_time;
                                                    endTime = timetable[k].end_time;
                                                    subject = timetable[k].subject_name;

                                                }

                                            }
                                        }
                                        if (subject == "") {
                                            startTime = sessionTimings[j].start_time;
                                            endTime = sessionTimings[j].end_time;
                                            subject = "";
                                        }
                                        timetableData.push({ start_time: startTime, end_time: endTime, subject: subject })

                                    }
                                    dayTimetable.push({ day: presentDay, timetableData })

                                }

                                // sectionTimetable.push({ dayTimetable });

                                count++;
                                //  console.log(count+"nara");

                                if (sectionDataLength == count) {
                                    next(null, dayTimetable);
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
                            timetable: result1
                        });

                    }
                }
            );
        });
    });

router.route('/day_timetable_by_classId/:select_day/:class_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var class_id = req.params.class_id;
        var splited = class_id.split("-");
        var school_id = splited[0];
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var day = req.params.select_day;
        day = Day[day - 1];
        var sectionTimetable = sessionTimings = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSection(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('class_sections').find({
                            class_id: class_id, 
                            status: 1
                        }).sort({ name: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionsTimetableData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var sectionResult = result;
                        var sectionResultLength = result.length;
                        if (sectionResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            sectionResult.forEach(function (sectionData) {
                                var section_id = sectionData.section_id;
                                // console.log(class_id);
                                db.collection('timetable').aggregate([
                                    {
                                        $match: {
                                            day: day,
                                            section_id: section_id,
                                            status: 1
                                        }
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
                                        $lookup: {
                                            from: "employee",
                                            localField: "teacher_id",
                                            foreignField: "employee_id",
                                            as: "employee_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$employee_doc"
                                    },
                                    {
                                        $group: {
                                            _id: '$_id',
                                            // class_name: {
                                            //     "$first": "$class_doc.name"
                                            // },
                                            section_name: {
                                                "$first": "$section_doc.name"
                                            },
                                            // section_id: {
                                            //     "$first": "$section_doc.section_id"
                                            // },
                                            section_id: {
                                                "$first": "$section_doc.section_id"
                                            },
                                            teacher_name: {
                                                "$first": "$employee_doc.first_name"
                                            },
                                            day: {
                                                "$first": "$day"
                                            },
                                            subject_name: {
                                                "$first": "$subject_doc.name"
                                            },
                                            start_time: {
                                                "$first": "$start_time"
                                            },
                                            end_time: {
                                                "$first": "$end_time"
                                            }
                                        }
                                    },
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    sectionData.timetable = results

                                    if (sectionResultLength == count) {

                                        next(null, sectionResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getsessionTimings(result, next) {
                        //   console.log("getTotalSchoolAttendance");
                        // console.log(result);                        
                        var data = db.collection('session_timings').find({
                            school_id: school_id, 
                            status: 1
                        }).sort({ start_time: 1 }).toArray(function (err, sessionResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, sessionResult);
                        });
                    }, function getTimetableData(result, sessionResult, next) {

                        //  console.log(sessionResult);
                        var count = 0;
                        sessionTimings = sessionResult;
                        var sectionResult = result;
                        var sectionDataLength = result.length;
                        //  console.log(classData.sections);
                        if (sectionDataLength == 0) {
                            next(null, []);
                        } else {

                            sectionResult.forEach(function (sectionData) {

                                // attendenceClass = [];

                                var sectionCount = 0;
                                var sectionsData = sectionData;
                                var timetableData = [];
                                var timetableDataLength = sectionData.timetable.length;
                                var section_id = sectionData.section_id;

                                var sectionName = sectionData.name;

                                var timetable = sectionData.timetable;

                                var timetableLength = timetable.length;

                                for (j = 0; j < sessionTimings.length; j++) {
                                    var startTime = endTime = subject = "";

                                    for (i = 0; i < timetableLength; i++) {
                                        var teacher = timetable[i].teacher_name;
                                        if (sessionTimings[j].start_time == timetable[i].start_time) {
                                            var subject = timetable[i].subject_name;

                                            if (subject == "") {
                                                startTime = sessionTimings[j].start_time;
                                                endTime = sessionTimings[j].end_time;
                                                subject = "";
                                                teacher = timetable[i].teacher_name;
                                            } else {
                                                startTime = timetable[i].start_time;
                                                endTime = timetable[i].end_time;
                                                subject = timetable[i].subject_name;
                                                var teacher = timetable[i].teacher_name;
                                            }
                                        }

                                    }

                                    timetableData.push({ start_time: startTime, end_time: endTime, subject: subject, teacher: teacher })
                                }

                                count++;


                                sectionTimetable.push({ sectionName: sectionName, timetableData })

                                if (sectionDataLength == count) {
                                    next(null, sectionTimetable);
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
                            timetable: result1
                        });

                    }
                }
            );
        });
    });

router.route('/class_timetable_by_day/:select_day/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var Day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var day = req.params.select_day;
        day = Day[day - 1];

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('timetable').aggregate([
                {
                    $match: {
                        day: day,
                        section_id: section_id,
                        status: 1
                    }
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
                    $group: {
                        _id: '$_id',
                        class_name: {
                            "$first": "$class_doc.name"
                        },
                        section_name: {
                            "$first": "$section_doc.name"
                        },
                        day: {
                            "$first": "$day"
                        },
                        subject_name: {
                            "$first": "$subject_doc.name"
                        },
                        subject_id: {
                            "$first": "$subject_doc.subject_id"
                        },
                        start_time: {
                            "$first": "$start_time"
                        },
                        end_time: {
                            "$first": "$end_time"
                        }
                    }
                },
            ]).sort({start_time: 1})
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    timetable: resultArray
                });
            });
        });
    });

router.route('/teacher_timetable/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('timetable').aggregate([
                {
                    $match: {
                        teacher_id: employee_id,
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
                { "$unwind": "$subject_doc" },
                {
                    "$lookup": {
                        "from": "school_classes",
                        "localField": "class_id",
                        "foreignField": "class_id",
                        "as": "class_doc"
                    }
                },
                { "$unwind": "$class_doc" },
                {
                    "$lookup": {
                        "from": "class_sections",
                        "localField": "section_id",
                        "foreignField": "section_id",
                        "as": "section_doc"
                    }
                },
                { "$unwind": "$section_doc" },
                {
                    "$project": {
                        "_id": "$_id",
                        "timetable_id": "$timetable_id",
                        "class_id": "$class_id",
                        "class_name": "$class_doc.name",
                        "section_id": "$section_id",
                        "section_name": "$section_doc.name",
                        "day": "$day",
                        "start_time": "$start_time",
                        "end_time": "$end_time",
                        "room_no": "$room_no",
                        "subject_id": "$subject_id",
                        "name": "$subject_doc.name",
                    }
                }
            ]).sort({start_time: 1})
            // var cursor = db.collection('timetable').find({section_id});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    timetable: resultArray
                });
            });
        });
    });

router.route('/delete_timetable/:timetable_id')
    .put(function (req, res, next) {
        var myquery = { timetable_id: req.params.timetable_id };

        mongo.connect(url, function (err, db) {
            db.collection('timetable').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    db.close();
                    res.send('true');
                }
            });
        });
    });

module.exports = router;