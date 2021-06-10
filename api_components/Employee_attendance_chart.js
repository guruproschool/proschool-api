// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;

var dates = {
    convert: function (d) {
        // Converts the date in d to a date-object. The input can be:
        //   a date object: returned without modification
        //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
        //   a number     : Interpreted as number of milliseconds
        //                  since 1 Jan 1970 (a timestamp) 
        //   a string     : Any format supported by the javascript engine, like
        //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
        //  an object     : Interpreted as an object with year, month and date
        //                  attributes.  **NOTE** month is 0-11.
        return (
            d.constructor === Date ? d :
                d.constructor === Array ? new Date(d[0], d[1], d[2]) :
                    d.constructor === Number ? new Date(d) :
                        d.constructor === String ? new Date(d) :
                            typeof d === "object" ? new Date(d.year, d.month, d.date) :
                                NaN
        );
    },
    compare: function (a, b) {
        // Compare two dates (could be of any type supported by the convert
        // function above) and returns:
        //  -1 : if a < b
        //   0 : if a = b
        //   1 : if a > b
        // NaN : if a or b is an illegal date
        // NOTE: The code inside isFinite does an assignment (=).
        return (
            isFinite(a = this.convert(a).valueOf()) &&
                isFinite(b = this.convert(b).valueOf()) ?
                (a > b) - (a < b) :
                NaN
        );
    },
    inRange: function (d, start, end) {
        // Checks if date in d is between dates in start and end.
        // Returns a boolean or NaN:
        //    true  : if d is between start and end (inclusive)
        //    false : if d is before start or after end
        //    NaN   : if one or more of the dates is illegal.
        // NOTE: The code inside isFinite does an assignment (=).
        return (
            isFinite(d = this.convert(d).valueOf()) &&
                isFinite(start = this.convert(start).valueOf()) &&
                isFinite(end = this.convert(end).valueOf()) ?
                start <= d && d <= end :
                NaN
        );
    }
}

var cookieParser = require('cookie-parser');
router.use(function (req, res, next) {
    // do logging
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next(); // make sure we go to the next routes and don't stop here
});

router.route('/attendance_employee_byMonth/:month/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var month = parseInt(req.params.month);
        var resultArray = [];
        var present = 0;
        var absent = 0;
        var onleave = 0;
        
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').find({
                employee_id : employee_id,
                month : month,
            });
            // cursor.toArray(function (err, results) {
            //     if(err) {
            //         res.send('false')
            //     }
            //     db.close();
            //     res.send(results) 
            // })
            cursor.forEach(function (doc, err) {
                if(doc.status === 'Present') {
                    present++;
                } else if(doc.status === 'Absent') {
                    absent++;
                } else if(doc.status === 'On Leave') {
                    onleave++;
                }
                resultArray.push(doc);
            }, function () {
                var total = resultArray.length;
                if(total > 0) {
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

router.route('/employee_attendancebydate/:select_date/:school_id')
    .get(function (req, res, next) {
        var select_date = new Date(req.params.select_date);
        school_id = req.params.school_id;
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('employee_attendance').find({ date: new Date(select_date), school_id: school_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    donutchart: resultArray,
                    count: count,
                    present: present,
                    onleave: onLeave,
                    absent: absent
                });
            });
        });
    });

router.route('/employee_attendanceByRange/:school_id/:employee_type/:start_date/:end_date')
    .get(function (req, res, next) {
        var start_date = new Date(req.params.start_date);
        var end_date = new Date(req.params.end_date);
        var school_id = req.params.school_id;
        var employee_type = req.params.employee_type;
        end_date.setDate(end_date.getDate() + 1);
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            async.waterfall(
                [
                    function getSchoolEmployees(next) {
                        db.collection('employee').aggregate([
                            {
                                $match: {
                                    job_category: employee_type,
                                    school_id: school_id,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                    {
                                        employee_id: "$employee_id",
                                        first_name: "$first_name",
                                        last_name: "$last_name",
                                        employee_code: "$employee_code",
                                    }
                            }
                        ]).sort({_id: 1}).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeeAttendance(result, next) {
                        var count = 0;
                        var employeeResult = result;
                        var employeeResultLength = result.length;
                        if(employeeResultLength === 0) {
                            next(null, []);
                        } else {
                            employeeResult.forEach(function (employeeData) {
                                employeeData.present = 0;
                                employeeData.absent = 0;
                                employeeData.onLeave = 0;
                                employeeData.count = 0;
                                var first_name = employeeData.first_name;
                                var last_name = employeeData.last_name;
                                var employee_code = employeeData.employee_code;
                                var employee_id = employeeData.employee_id;
                                var cursor = db.collection('employee_attendance').aggregate([
                                    {
                                        $match: {
                                            'atten_date': {
                                                $gte: start_date,
                                                $lt: end_date,
                                            },
                                            employee_id: employee_id,
                                            school_id: school_id,
                                        }
                                    },                    
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "employee_id": "$employee_id",
                                            "status": "$status",
                                            "date": "$date",
                    
                                        }
                                    }
                                ])
                                cursor.forEach(function (doc, err) {
                                    assert.equal(null, err);
                       
                                    if (doc.status == "Present") {
                                        employeeData.present++;
                                        employeeData.count++;
                                    }
                                    else if (doc.status == "Absent") {
                                        employeeData.absent++;
                                        employeeData.count++;
                                    }
                                    else if (doc.status == "On Leave") {
                                        employeeData.onLeave++;
                                        employeeData.count++;
                                    }
                                }, function() {
                                    count++; 
                                    resultArray.push(employeeData)
                                    if(count === employeeResultLength) {
                                        next(null, resultArray);
                                    }
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
            )
        });
    });

router.route('/employee_attendance_by_date/:select_date/:school_id')
    .get(function (req, res, next) {
        var select_date = new Date(req.params.select_date);
        var school_id = req.params.school_id;
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        var present = 0, absent = 0, onLeave = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var data = db.collection('employee_attendance').find({
            //     date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) },
            //     school_id: school_id
            // })
            // dataCount = data.count(function (e, triggerCount) {
            //     if (triggerCount > 0) {
            //         count = triggerCount;
            //     }
            // });

            // data.forEach(function (doc, err) {
            //     if (doc.status == "Present") {
            //         present += 1;
            //     }
            //     else if (doc.status == "Absent") {
            //         absent += 1;
            //     }
            //     else if (doc.status == "On Leave") {
            //         onLeave += 1;
            //     }
            // })
            var cursor = db.collection('employee_attendance').aggregate([
                {
                    $match: {
                        'date': {
                            $gte: new Date(select_date.toISOString()),
                            $lt: new Date(endDate.toISOString())
                        },
                        'school_id': school_id
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "employee_id": "$employee_id",
                        "first_name": "$employee_doc.first_name",
                        "last_name": "$employee_doc.last_name",
                        "status": "$status",
                        "gender": "$employee_doc.gender",
                        "employee_type": "$employee_doc.job_category",

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
                    donutchart: resultArray,
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent
                });
            });
        });
    });

router.route('/Employee_attendancechartbymonth/:select_month/:employee_id')
    .get(function (req, res, next) {
        var select_month = parseInt(req.params.select_month);
        var employee_id = req.params.employee_id;
        var date = new Date();
        var current_year = date.getFullYear();
        var current_month = date.getMonth() + 1;
        console.log(select_month)

        if(current_month >= 1 && current_month < 6) {
            if(req.params.select_month >= 1 && req.params.select_month < 6) {
                var year = parseInt(current_year);
            } else if(req.params.select_month >= 6 && req.params.select_month <= 12) {
                var year = parseInt(current_year - 1);
            }
        } else if(current_month >= 6 && current_month <= 12) {
            var year = parseInt(current_year);
        }
        console.log(year)
        
        var present = 0, absent = 0, onLeave = 0, holiday = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('employee_attendance').aggregate([
                {
                    $match: {
                        month: select_month,
                        year: year,
                        employee_id: employee_id
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "employee_id": "$employee_id",
                        "first_name": "$employee_doc.first_name",
                        "last_name": "$employee_doc.last_name",
                        "status": "$status",
                        "date": "$date",
                        "day": "$day",

                    }
                }
            ]).sort({ day: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                if (doc.status == "Present") {
                    present += 1;
                }
                else if (doc.status == "Absent") {
                    absent += 1;
                }
                else if (doc.status == "On Leave") {
                    onLeave += 1;
                }
                else {
                    holiday += 1;
                }
                resultArray.push(doc);
                console.log(resultArray)
            }, function () {
                length = resultArray.length;
                presentpercent = ((present / length) * 100).toFixed(2);
                absentpercent = ((absent / length) * 100).toFixed(2);
                leavepercent = ((onLeave / length) * 100).toFixed(2);
                db.close();
                res.send({
                    donutchart: resultArray,
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent,
                    presentpercent: presentpercent,
                    absentpercent: absentpercent,
                    leavepercent: leavepercent,
                });
            });
        });
    });

router.route('/employeeattendancebymonth/:select_month/:employee_id')
    .get(function (req, res, next) {
        var select_month = parseInt(req.params.select_month);
        var employee_id = req.params.employee_id;
        var date = new Date();
        var current_year = date.getFullYear();
        var current_month = date.getMonth() + 1;
        var current_date = new Date(current_year, select_month, 0)
        
        var totalDays = current_date.getDate();

        if(current_month >= 1 && current_month < 6) {
            if(req.params.select_month >= 1 && req.params.select_month < 6) {
                var year = parseInt(current_year);
            } else if(req.params.select_month >= 6 && req.params.select_month <= 12) {
                var year = parseInt(current_year - 1);
            }
        } else if(current_month >= 6 && current_month <= 12) {
            var year = parseInt(current_year);
        }
        console.log(totalDays)
        
        var present = 0, absent = 0, onLeave = 0, holiday = 0;
        var count = 0, dataCount;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('employee_attendance').aggregate([
                {
                    $match: {
                        month: select_month,
                        year: year,
                        employee_id: employee_id
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "employee_id": "$employee_id",
                        "first_name": "$employee_doc.first_name",
                        "last_name": "$employee_doc.last_name",
                        "status": "$status",
                        "gender": "$employee_doc.gender",
                        "employee_code": "$employee_doc.employee_code",
                        "date": "$date",
                        "day": "$day",
                    }
                }
            ]).sort({ day: 1 }).toArray(function (err, result) {
                console.log(totalDays)
                for(i = 1; i <= totalDays; i++) {
                    console.log(i)
                    var counter = 0;
                    var counter1 = 0;
                    var doc1 = {};
                    if(result.length > 0) {
                        result.forEach(function (doc, err) {
                            counter++;
                            if(doc.day === i) {
                                counter1++;
                                if (doc.status == "Present") {
                                    present += 1;
                                }
                                else if (doc.status == "Absent") {
                                    absent += 1;
                                }
                                else if (doc.status == "On Leave") {
                                    onLeave += 1;
                                }
                                else {
                                    holiday += 1;
                                }
                                doc1 = doc
                            }
                            if(counter === result.length) {
                                if(counter1 === 1) {
                                    resultArray.push(doc1)
                                } else if(counter1 === 0) {
                                    resultArray.push({
                                        "_id": doc._id,
                                        "employee_id": doc.employee_id,
                                        "first_name": doc.first_name,
                                        "last_name": doc.last_name,
                                        "status": "Attendance Not Taken",
                                        "gender": doc.gender,
                                        "employee_code": doc.employee_code,
                                        "date": doc.date,
                                        "day": i,
                                    })
                                }
                            }
                        })
                    } else {
                        resultArray.push({
                            "_id": " ",
                            "employee_id": " ",
                            "first_name": " ",
                            "last_name": " ",
                            "status": "Attendance Not Taken",
                            "gender": " ",
                            "employee_code": " ",
                            "date": " ",
                            "day": i,
                        })
                    }

                }
                length = present + absent + onLeave + holiday;
                presentpercent = parseFloat(((present / length) * 100).toFixed(2));
                absentpercent = parseFloat(((absent / length) * 100).toFixed(2));
                leavepercent = parseFloat(((onLeave / length) * 100).toFixed(2));
                db.close();
                res.send({
                    attendance: resultArray,
                    count: length,
                    present: present,
                    onleave: onLeave,
                    absent: absent,
                    presentpercent: presentpercent,
                    absentpercent: absentpercent,
                    leavepercent: leavepercent,
                });  
            })
        });
    });

router.route('/employee_till_Date_attendence/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var resultArray = [];
        var present = 0, absent = 0, onLeave = 0;
        var totalDays = totalAbsent = totalOnLeave = totalPresent = 0;
        var resultMonth, AttendenceMonth;
        var employeeAttendence = noOfDays = [];

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee_attendance').aggregate([
                {
                    $match: {
                        employee_id: employee_id
                    },
                },
                {
                    $lookup: {
                        from: "employee",
                        localField: "employee_id",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                {
                    $project:
                        {
                            firstName: "$employee_doc.first_name",
                            lastName: "$employee_doc.last_name",
                            designation: "$employee_doc.designation",
                            employee_code: "$employee_doc.employee_code",
                            job_category: "$employee_doc.job_category",
                            status: "$status",
                            gender: "$employee_doc.gender",
                            month: "$month",
                            date: "$date"
                        }
                }
            ])

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                if (resultArray.length > 0) {
                    monthArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                    monthString = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
                    // console.log(resultArray[0]);
                    employeeName = "";
                    if (resultArray[0].firstName && resultArray[0].lastName) {
                        employeeName = resultArray[0].firstName + " " + resultArray[0].lastName;
                    }
                    designation = resultArray[0].designation;
                    employee_code = resultArray[0].employee_code;
                    job_category = resultArray[0].job_category;
                    gender = resultArray[0].gender;
                    for (i = 0; i < monthArray.length; i++) {
                        monthValue = monthArray[i];
                        monthName = monthString[i];
                        // console.log(resultMonth);
                        present = absent = onLeave = 0;
                        monthAttendence = {};
                        var attendance_data = [];
                        for (j = 0; j < resultArray.length; j++) {

                            if (monthValue == resultArray[j].month) {
                                attendance_data.push({'date': resultArray[j].date, 'status': resultArray[j].status})
                                // console.log("hema");
                                if (resultArray[j].status == "Present") {
                                    present += 1;
                                }
                                else if (resultArray[j].status == "Absent") {
                                    absent += 1;
                                }
                                else if (resultArray[j].status == "On Leave") {
                                    onLeave += 1;
                                }
                            }

                        }
                        percent = present + absent + onLeave;
                        totalAbsent += absent;
                        totalOnLeave += onLeave;
                        totalPresent += present;
                        totalDays += percent;
                        prePercent = (100 * present) / percent;
                        // prePercent = Math.round(prePercent);
                        abPercent = (100 * absent) / percent;
                        // abPercent = Math.round(abPercent);
                        onPercent = (100 * onLeave) / percent;
                        // onPercent = Math.round(onPercent);
                        monthAttendence.present = present;
                        monthAttendence.absent = absent;
                        monthAttendence.onLeave = onLeave;
                        // console.log(monthAttendence);
                        monthAttendence.presentPercent = prePercent;
                        monthAttendence.absentPercent = abPercent;
                        monthAttendence.onLeavePercent = onPercent;
                        employeeAttendence.push({ "monthName": monthName, "month": monthValue, "count": percent, "attendance": monthAttendence, "attendance_data": attendance_data })
                    }
                    db.close();
                    res.send({
                        totalDays: totalDays,
                        totalAbsent: totalAbsent,
                        totalOnLeave: totalOnLeave,
                        totalPresent: totalPresent,
                        employeeAttendence: employeeAttendence,
                        designation: designation,
                        employee_code: employee_code,
                        job_category: job_category,
                        employeeName: employeeName,
                        gender: gender
                    });
                }
                else {
                    res.send("false");
                }
            });
        });
    });

router.route('/monthly_attendence_employee_dates/:select_month/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        var monthValue = req.params.select_month;
        var todayDate = new Date();
        var currentDate = new Date().getDate();
        var currentMonth = new Date().getMonth();
        var yearIn = todayDate.getFullYear();
        var daysIn = new Date(yearIn, monthValue, 0);
        var daysInMonth = daysIn.getDate();
        var monthdaysInMonth = daysIn.getMonth();
        var monthValues = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        var employeeAttendance = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getstudentData(next) {
                        monthValue = parseInt(monthValue);
                        db.collection('employee_attendance').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id
                                },
                            },
                            {
                                "$redact": {
                                    "$cond": [
                                        { "$eq": [{ "$month": "$date" }, monthValue] },
                                        "$$KEEP",
                                        "$$PRUNE"
                                    ]
                                }
                            }
                        ]).toArray(function (err, results) {

                            if (err) {
                                next(err, null);
                            }
                            employeeAttendance = results

                            next(null, employeeAttendance);

                        })
                    }, function getAttendenceTopicsData(result, next) {
                        //  console.log(result);

                        var employeeResult = result;
                        var attendenceResult = [];
                        var employeeDataLength = result.length;
                        //  console.log(classData.sections);
                        if (employeeDataLength == 0) {
                            next(null, []);
                        } else {
                            //console.log(daysInMonth);
                            var resAttendenceData = [];
                            employeeAttendence = [];
                            var studentObj = {};

                            // studentObj.Name = studentData.first_name + ' ' + studentData.last_name;
                            // studentObj.roll_no = studentData.roll_no;
                            // studentObj.studentId = studentData.student_id;
                            // studentObj.class_name = studentData.class_name;
                            // studentObj.section_name = studentData.section_name;
                            // studentObj.section_id = studentData.section_id;
                            studentObj.attendance = [];
                            employeeAttendence = employeeAttendance;

                            present = absent = onLeave = holiday = 0;
                            for (var dayi = 0; dayi < daysInMonth; dayi++) {
                                var pushValue = false;
                                var dateCount = (dayi + 1).toString();
                                if (dateCount <= 9) {
                                    dateCount = '0' + dateCount;
                                }
                                for (i = 0; i < employeeAttendence.length; i++) {
                                    var chekDate = employeeAttendence[i].date;
                                    var splitDate = chekDate.toISOString().split('T');

                                    //  console.log(yearIn+'-'+monthValues[monthValue-1]+'-'+dateCount +"   "+splitDate[0]);
                                    if (dates.compare(yearIn + '-' + monthValues[monthValue - 1] + '-' + dateCount, splitDate[0]) == 0) {
                                        // if(studentAttendence[i].session ==  "morning"){}
                                        if (employeeAttendence[i].status == "Present") {
                                            statusFlag = "P";
                                            present++;
                                        }
                                        else if (employeeAttendence[i].status == "Absent") {
                                            statusFlag = "A";
                                            absent++;
                                        }
                                        else if (employeeAttendence[i].status == "On Leave") {
                                            statusFlag = "L";
                                            onLeave++;
                                        } else {
                                            statusFlag = "H";
                                        }
                                        studentObj.attendance.push({ day: dateCount, status: statusFlag });
                                        pushValue = true;

                                        //    break;
                                    }

                                }

                                if (pushValue == false) {
                                    if (currentMonth == (monthValue - 1) && dateCount > currentDate) {
                                        studentObj.attendance.push({ day: dateCount, status: "-" });
                                    } else {
                                        holiday++;
                                        studentObj.attendance.push({ day: dateCount, status: "H" });
                                    }
                                }
                                studentObj.present = present;
                                studentObj.absent = absent;
                                studentObj.onLeave = onLeave;
                                studentObj.holiday = holiday;
                            }
                            resAttendenceData.push(studentObj);

                            next(null, resAttendenceData);

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
                            employeeMonthlyAttendence: result1
                        });

                    }
                }
            );
        });
    });

router.route('/totalemployees_attendance/:select_date/:school_id')
    .get(function (req, res, next) {
        var select_date = req.params.select_date;
        var school_id = req.params.school_id;
        var present = 0, absent = 0, onLeave = 0;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolEmployees(next) {
                        db.collection('employee').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeesAttendance(result, next) {
                        db.collection('employee_attendance').aggregate([
                            {
                                $match: {
                                    date: select_date,
                                    school_id: school_id
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "employee",
                                    "localField": "employee_id",
                                    "foreignField": "employee_id",
                                    "as": "employee_doc"
                                }
                            },
                            {
                                $unwind: "$employee_doc"
                            },
                            {
                                $project:
                                {
                                    employee_attendance_id: "$employee_attendance_id",
                                    employee_id: "$employee_id",
                                    employee_name: "$employee_doc.first_name",
                                    school_id: "$school_id",
                                    date: "$date",
                                    day: "$day",
                                    month: "$month",
                                    year: "$year",
                                    category: "$category",
                                    session: "$session",
                                    status: "$status",
                                    employee_status: "$employee_doc.status"
                                }
                            }
                        ]).toArray(function (err, results) {
                            console.log(results)
                            if (err) {
                                next(err, null);
                            } else {
                                results = results.filter(data => data.employee_status === 1);
                                next(null, result, results);
                            }
                        });
                    },
                ],
                function (err, result, results) {

                    // console.log(result);
                    console.log(results)
                    for (i = 0; i < results.length; i++) {

                        if (results[i].status == "Present") {
                            present += 1;
                        }
                        else if (results[i].status == "Absent") {
                            absent += 1;
                        }
                        else if (results[i].status == "On Leave") {
                            onLeave += 1;
                        }
                    }

                    var totalEmployees = result.length;
                    var attendanceTaken = parseInt(present) + parseInt(absent) + parseInt(onLeave);
                    if(attendanceTaken === 0) {
                        var presentPercentage = 0;
                        var absentPercent = 0;
                        var onLeavePercent = 0;
                    } else {
                        var presentPercentage = (parseInt(present) / parseInt(attendanceTaken)) * 100;
                        var absentPercent = (parseInt(absent) / parseInt(attendanceTaken)) * 100;
                        var onLeavePercent = (parseInt(onLeave) / parseInt(attendanceTaken)) * 100;
                    }
                    var Employee_attendance = {total_employees: totalEmployees, attendanceTaken: attendanceTaken, present: present, absent: absent, onLeave: onLeave, presentPercentage: presentPercentage, absentPercent: absentPercent, onLeavePercent: onLeavePercent}

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            Employee_attendance
                        });

                    }
                }
            );
        });
    })

module.exports = router;


