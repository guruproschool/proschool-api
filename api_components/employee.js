// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var multer = require('multer');
var employeeModule = require('../api_components/employee_module');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var forEach = require('async-foreach').forEach;
var async = require('async');
var router = express.Router();
var fs = require('fs');
var unzip = require('unzip');
var loginUrl = config.loginUrl;
var url = config.dburl;
const User = require('../models/user');

var storageImage = multer.diskStorage({ //multers disk storage settings
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
        // cb(null, file.originalname);
    }
});

var uploadImage = multer({ //multer settings
    storage: storageImage,
    fileFilter: function (req, file, callback) { //file filter
        if (['jpg', 'png'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).any();

// Add Employee
router.route('/employee/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var employeeData = [];

        if (req.body.title === undefined || req.body.title === '') {
            if (req.body.gender === 'Male') {
                var title = 'Mr.'
            } else if (req.body.gender === 'Female') {
                if (req.body.marital_status === 'Married') {
                    var title = 'Mrs.'
                } else if (req.body.marital_status === 'Unmarried') {
                    var title = 'Ms.'
                }
            }
        } else {
            var title = req.body.title;
        }

        User.findOne({
            $or: [{ 'phone': req.body.phone.toString() }, { 'email': req.body.email }]
        }, function (err, existingUser) {
            console.log(existingUser)
            if (existingUser > 0) {
                var schools = existingUser.schools;
                var countt = 0;
                schools.forEach(function (school) {
                    if(school == school_id) {
                        countt++
                    }
                })
                if(countt === 1) {
                    res.end("Employee details Already exists")
                } else {
                    User.updateOne({$or: [{ 'phone': req.body.phone.toString() }, { 'email': req.body.email }]}, { $push: {schools: school_id} });
                    mongo.connect(url, function (err, db) {
                        db.collection('employee').findOneAndUpdate(
                            { 
                                $or: [{ 'phone': req.body.phone.toString() }, { 'email': req.body.email }]
                            }, 
                            { 
                                $set: {school_id: school_id} 
                            }, function(err, resultt) {
                                if(err) {
                                    res.end('false')
                                } else {
                                    var requestData = {}
                                    requestData.employee_type = 'existing';
                                    requestData.name = req.body.first_name + " " + req.body.last_name;
                                    requestData.employee_id = resultt.employee_id;
                                    requestData.joined_on = resultt.joined_on;
                                    requestData.school_id = school_id;
                                    requestData.email = req.body.email;
                                    requestData.phone = req.body.phone;
                                    
                                    if (resultt.job_category == "teaching") {
                                        requestData.role = "teacher";
                                        employeeData.push(requestData);
                                        employeeModule.addTeacher(employeeData, res);
                                    }
                                    else if (resultt.job_category == "administrative") {
                                        requestData.role = "administrator";
                                        employeeData.push(requestData);
                                        employeeModule.addAdministrator(employeeData, res);
                                    }
                                    else if (resultt.job_category == "non-teaching") {
                                        requestData.role = "non-teacher";
                                        employeeData.push(requestData);
                                        employeeModule.addNonTeacher(employeeData, res);
                                    }     
                                }
                            }
                        )
                    })
                }                
            } else {
                uploadImage(req, res, function (err) {
                    if (err) {
                        res.json({ error_code: 1, err_desc: err });
                        return;
                    }
                    /** Multer gives us file info in req.file object */
                    if (!req.file) {
                        // res.json({ error_code: 1, err_desc: "No file passed" });
                        // return;
        
                        var employeeImage = {
                            filename: "student.jpg",
                            originalname: "student",
                            imagePath: "uploads",
                            imageSrc: "/image/student.jpg",
                            mimetype: "jpg/image",
                        };
                    } else {
                        var employeeImage = {
                            filename: req.file.filename,
                            originalname: req.file.originalname,
                            imagePath: req.file.path,
                            imageSrc: "/image/" + req.file.filename,
                            mimetype: req.file.mimetype,
                        }
                    }
                    var item = {
                        employee_id: 'getauto',
                        school_id: school_id,
                        title: title,
                        first_name: req.body.first_name,
                        last_name: req.body.last_name,
                        surname: req.body.surname,
                        designation: req.body.designation,
                        employee_code: req.body.employee_code,
                        dob: req.body.dob,
                        gender: req.body.gender,
                        qualification: req.body.qualification,
                        job_category: req.body.job_category,
                        experience: req.body.experience,
                        phone: req.body.phone.toString(),
                        email: req.body.email,
                        joined_on: req.body.joined_on,
                        basic_pay: req.body.basic_pay,
                        blood_group: req.body.blood_group,
                        spoken_languages: req.body.spoken_languages,
                        salary_band: req.body.salary_band,
                        marital_status: req.body.marital_status,
                        perm_city: req.body.perm_city,
                        country: req.body.country,
                        state: req.body.state,
                        postal_code: req.body.postal_code.toString(),
                        pan_no: req.body.pan_no.toString(),
                        aadhar_no: req.body.aadhar_no.toString(),
                        passport_no: req.body.passport_no.toString(),
                        alternate_email: req.body.alternate_email,
                        status: status,
                    };
                    var current_address = {
                        cur_address: req.body.cur_address,
                        cur_city: req.body.cur_city,
                        cur_state: req.body.cur_state,
                        cur_pincode: req.body.cur_pincode,
                        cur_long: req.body.cur_long,
                        cur_lat: req.body.cur_lat
                    };
                    var permanent_address = {
                        perm_address: req.body.perm_address,
                        perm_city: req.body.perm_city,
                        perm_state: req.body.perm_state,
                        perm_pincode: req.body.perm_pincode,
                        perm_long: req.body.perm_long,
                        perm_lat: req.body.perm_lat
                    };
                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'employee', function (err, autoIndex) {
                            var collection = db.collection('employee');
                            collection.ensureIndex({
                                "employee_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (item.first_name == null || item.job_category == null || item.job_category == "" || item.job_category == "undefined") {
                                    res.end('null');
                                } else {
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
                                                employee_id: 'E' + autoIndex,
                                                employeeImage: employeeImage
                                            },
                                            $push: {
                                                current_address,
                                                permanent_address,
                                            }
                                        }, function (err, result) {
                                            db.close();
                                        });
                                        var requestData = {};
                                        requestData.employee_type = 'new';
                                        requestData.name = item.first_name + " " + item.last_name;
                                        requestData.employee_id = 'E' + autoIndex;
                                        requestData.joined_on = item.joined_on;
                                        requestData.school_id = school_id;
                                        requestData.email = req.body.email;
                                        requestData.phone = req.body.phone;
                                        
                                        if (item.job_category == "teaching") {
                                            requestData.role = "teacher";
                                            employeeData.push(requestData);
                                            employeeModule.addTeacher(employeeData, res);
                                        }
                                        else if (item.job_category == "administrative") {
                                            requestData.role = "administrator";
                                            employeeData.push(requestData);
                                            employeeModule.addAdministrator(employeeData, res);
                                        }
                                        else if (item.job_category == "non-teaching") {
                                            requestData.role = "non-teacher";
                                            employeeData.push(requestData);
                                            employeeModule.addNonTeacher(employeeData, res);
                                        }                                
                                    });
                                }
                            });
                            collection.ensureIndex({
                                "first_name": "text",
                                "last_name": "text"
                            });
                        });
                    });
                });
            }
        });
    })
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ school_id: school_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    employee: resultArray
                });
            });
        });
    });

// GET Employees list for Chat
router.route('/employees_chatlist/:school_id/:employeeId')
    .get(function (req, res, next) {

        var school_id = req.params.school_id;
        var employeeId = req.params.employeeId;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getEmployeeList(next) {
                        var cursor = db.collection('employee').aggregate([
                            {
                                $match: {
                                    school_id: school_id,
                                    job_category: 'teaching',
                                    employee_id: { $not: { $eq: employeeId } },
                                    status: 1
                                }
                            },
                            {
                                "$project": {
                                    "employee_id": "$employee_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "job_category": "$job_category",
                                    "employee_code": "$employee_code",
                                    "employee_image": "$employeeImage.imageSrc"
                                }
                            }

                        ])
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            } else {
                                next(null, result);
                            }
                        });
                    },
                    function getEmployeeList(result, next) {
                        if(result !== null) {
                            var cursor = db.collection('schools').aggregate([
                                {
                                    $match: {
                                        school_id: school_id,
                                        status: 1
                                    }
                                },
                                { "$unwind": "$SchoolImage" },
                                {
                                    "$project": {
                                        "employee_id": "$school_id",
                                        "first_name": "Admin",
                                        "last_name": "",
                                        "job_category": "$name",
                                        "employee_code": "$school_id",
                                        "employee_image": "$SchoolImage.imageSrc"
                                    }
                                }
    
                            ])
                            cursor.toArray(function (err, result1) {
                                if (err) {
                                    next(err, null);
                                } else {
                                    result.unshift(result1[0]);
                                    next(null, result);
                                }
                            });
                        } else {
                            next(err, null);
                        }
                    },
                    function getEmployeesChat(result, next) {
                        if(result !== null) {
                            var count = 0;
                            var employeesResult = result;
                            var employeesResultLength = result.length;
                            if (employeesResultLength == 0) {
                                next(null, []);
                            } else {
                                employeesResult.forEach(function (employeeData) {
                                    var employee_id = employeeData.employee_id;
                                    db.collection('chats').find({
                                        $and: [ { members: { $in: [employee_id] } }, { members: { $in: [employeeId] } } ],
                                        // members: { $in: [employee_id] },
                                        status: 1
                                    }).toArray(function (err, resultArray) {
                                        count++;
                                        console.log(resultArray)
                                        console.log('END')
                                        assert.equal(null, err);
                                        var unread = 0;
                                        var count1 = 0;
                                        if (resultArray.length > 0) {
                                            resultArray[0].messages.forEach(function (msg) {
                                                count1++;
    
                                                if ((resultArray[0].members[0] === employeeId || resultArray[0].members[1] === employeeId) && msg.status !== 'READ' && msg.receiver === employeeId) {
                                                    unread++;
                                                }
                                                if (count1 === resultArray[0].messages.length) {
                                                    employeeData.unread_messages = unread;
                                                }
                                            });
                                        } else {
                                            employeeData.unread_messages = 0;
                                        }
                                        var members = [];
                                        members.push(employee_id);
                                        members.push(employeeId);
                                        members.sort(function(a, b) {
                                            return a.localeCompare(b);
                                        });
                                        employeeData.chat_id = members[0] + '_' + members[1];
                                        if (count === employeesResultLength) {
                                            next(null, employeesResult);
                                        }
                                    });
                                })
                            }
                        } else {
                            next(null, []);
                        }
                    }
                ],
                function (err, result2) {
                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send({ employees: result2 });
                    }
                }
            )
        });
    });

router.route('/parents_chatlist/:section_id/:student_id')
    .get(function (req, res, next) {

        var section_id = req.params.section_id;
        var student_id = req.params.student_id;
        var splitted = section_id.split('-');
        var school_id = splitted[0];
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSectionSubjects(next) {
                        var cursor = db.collection('subjects').find({ section_id: section_id, status: 1 })
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getEmployeeList(result, next) {
                        var subjectResult = result;
                        var subjectResultLength = result.length;
                        var subjectsArray = [];
                        var count = 0;
                        if (subjectResultLength === 0) {
                            next(null, [])
                        } else {
                            subjectResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var subjectsData = [];
                                var cursor = db.collection('teacher_subjects').aggregate([
                                    {
                                        $match: {
                                            "subjects.subject_id": subject_id
                                        }
                                    },
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
                                        "$project": {
                                            "employee_id": "$teacher_doc.employee_id",
                                            "first_name": "$teacher_doc.first_name",
                                            "last_name": "$teacher_doc.last_name",
                                            // "job_category": "$subjects_doc.name",
                                            "employee_code": "$teacher_doc.employee_code",
                                            "employee_image": "$teacher_doc.employeeImage.imageSrc"
                                        }
                                    }
                                ])
                                cursor.toArray(function (err, result1) {
                                    count++;
                                    subjectsData = result1;
                                    var count1 = 0;
                                    subjectsData.forEach(function (doc, err) {
                                        count1++;
                                        doc.job_category = subjectData.name;
                                        subjectsArray.push(doc);
                                        if (subjectResultLength === count && subjectsData.length === count1) {
                                            next(null, subjectsArray);
                                        }
                                    })
                                })
                            })
                        }
                    },
                    function getEmployeeList(subjectsArray, next) {
                        if(subjectsArray !== null || subjectsArray.length > 0) {
                            var cursor = db.collection('schools').aggregate([
                                {
                                    $match: {
                                        school_id: school_id,
                                        status: 1
                                    }
                                },
                                {
                                    "$project": {
                                        "employee_id": "$school_id",
                                        "first_name": "Admin",
                                        "last_name": "",
                                        "job_category": "$name",
                                        "employee_code": "$school_id",
                                        "employee_image": "$SchoolImage.imageSrc"
                                    }
                                }
    
                            ])
                            cursor.toArray(function (err, result1) {
                                console.log(result1)
                                if (err) {
                                    next(err, null);
                                } else {
                                    subjectsArray.unshift(result1[0]);
                                    next(null, subjectsArray);
                                }
                            });
                        } else {
                            next(err, null);
                        }
                    },
                    function getEmployeesChat(subjectsArray, next) {
                        
                        var count = 0;
                        var employeesResult = subjectsArray;
                        var employeesResultLength = subjectsArray.length;
                        if (employeesResultLength == 0 || subjectsArray == null) {
                            next(null, []);
                        } else {
                            employeesResult.forEach(function (employeeData) {
                                var employee_id = employeeData.employee_id;
                                db.collection('chats').find({
                                    $and: [{ members: employee_id }, { members: student_id }],
                                    status: 1
                                }).toArray(function (err, resultArray) {
                                    count++;
                                    assert.equal(null, err);
                                    var unread = 0;
                                    var count1 = 0;
                                    if (resultArray.length > 0) {
                                        resultArray[0].messages.forEach(function (msg) {
                                            count1++;
                                            console.log(msg.receiver)
                                            if (msg.status !== 'READ' && msg.receiver === student_id) {
                                                unread++;
                                                console.log('hello' + unread)
                                            }
                                            if (count1 === resultArray[0].messages.length) {
                                                employeeData.unread_messages = unread;
                                            }
                                        });
                                    } else {
                                        employeeData.unread_messages = 0;
                                    }
                                    var members = [];
                                    members.push(employee_id);
                                    members.push(student_id);
                                    members.sort(function(a, b) {
                                        return a.localeCompare(b);
                                    });
                                    employeeData.chat_id = members[0] + '_' + members[1];
                                    if (count === employeesResultLength) {
                                        next(null, employeesResult);
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
                        res.send({ employees: result1 });
                    }
                }
            )
        });
    });

router.route('/totalEmployees_in_school/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ school_id: school_id });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                length = resultArray.length;
                db.close();
                res.send({ employees: length });
            });
        });
    });

router.route('/search_employee/:job_category/:gender')
    .get(function (req, res, next) {
        var job_category = req.params.job_category;
        var gender = req.params.gender;
        var search_key = req.params.search_key;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ job_category, gender });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/employees_by_category/:job_category/:school_id')
    .get(function (req, res, next) {
        var job_category = req.params.job_category;
        var school_id = req.params.school_id;
        var resultArray = [];
        var cursor;
        //  console.log(job_category);
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('employee').find({ job_category: job_category, school_id: school_id });
            if (job_category == "all") {
                cursor = db.collection('employee').find({ school_id: school_id });
            }
            else {
                cursor = db.collection('employee').find({ job_category: job_category, school_id: school_id });
            }
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({ employees: resultArray });
            });
        });
    });

router.route('/employees_by_school_id_category/:job_category/:school_id')
    .get(function (req, res, next) {
        var job_category = req.params.job_category;
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ job_category: job_category, school_id: school_id });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({ employees: resultArray });
            });
        });
    });

router.route('/add_old_employment_details/:employee_id')
    .post(function (req, res, next) {
        old_employment_details = [];
        var employee_id = req.params.employee_id;
        var old_employment_details = {
            org_name: req.body.org_name,
            designation: req.body.designation,
            responsibilities: req.body.responsibilities,
            salary_per_annum: req.body.salary_per_annum,
            from_date: req.body.from_date,
            to_date: req.body.to_date,
        };
        mongo.connect(url, function (err, db) {
            db.collection('employee').update({ employee_id }, { $push: { old_employment_details } }, function (err, result) {
                assert.equal(null, err);
                db.close();

                res.send('true');
            });
        });
    });

router.route('/totalEmployees_in_school/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ school_id: school_id });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                length = resultArray.length;
                db.close();
                res.send({ employees: length });
            });
        });
    });

router.route('/employee_current_address/:employee_id')
    .post(function (req, res, next) {
        current_address = [];
        var employee_id = req.params.employee_id;
        var cur_address = req.body.cur_address;
        var cur_city = req.body.cur_city;
        var cur_state = req.body.cur_state;
        var cur_pincode = req.body.cur_pincode.toString();
        var cur_long = req.body.cur_long;
        var cur_lat = req.body.cur_lat;
        var current_address = {
            cur_address: cur_address,
            cur_city: cur_city,
            cur_state: cur_state,
            cur_pincode: cur_pincode,
            cur_long: cur_long,
            cur_lat: cur_lat
        };
        mongo.connect(url, function (err, db) {
            db.collection('employee').findOneAndUpdate({ employee_id }, { $set: { current_address } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/employee_permanent_address/:employee_id')
    .post(function (req, res, next) {
        permanent_address = [];
        var employee_id = req.params.employee_id;
        var perm_address = req.body.perm_address;
        var perm_city = req.body.perm_city;
        var perm_state = req.body.perm_state;
        var perm_pincode = req.body.perm_pincode.toString();
        var perm_long = req.body.perm_long;
        var perm_lat = req.body.perm_lat;
        var permanent_address = {
            perm_address: perm_address,
            perm_city: perm_city,
            perm_state: perm_state,
            perm_pincode: perm_pincode,
            perm_long: perm_long,
            perm_lat: perm_lat
        };
        mongo.connect(url, function (err, db) {
            db.collection('employee').findOneAndUpdate({ employee_id }, { $set: { permanent_address } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/employee_details/:employee_id')
    .get(function (req, res, next) {
        var employee_id = req.params.employee_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('employee').find({ employee_id, status });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                doc.phone =  doc.phone.toString();
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    employee: resultArray
                });
            });
        });
    });

router.route('/employee_photo_edit/:employee_id')
    .post(function (req, res, next) {
        var status = 1;
        var employee_id = req.params.employee_id;
        var myquery = { employee_id: req.params.employee_id };
        console.log('Hello-service')
        uploadImage(req, res, function (err) {
            console.log(req.files)
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.files) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            console.log(req.files)
            var filename = req.files[0].filename;
            var employeeImage = {
                filename: filename,
                originalname: req.files[0].originalname,
                imagePath: req.files[0].path,
                imageSrc: "/image/" + filename,
                mimetype: req.files[0].mimetype,
            }

            mongo.connect(url, function (err, db) {
                db.collection('employee').update(myquery, {
                    $set: { employeeImage: employeeImage }
                }, function (err, result) {
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send(true);
                });
            });
        })
    });

router.route('/edit_employee/:employee_id')
    .put(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };

        var current_address = [
            {
                cur_address: req.body.cur_address,
                cur_city: req.body.cur_city,
                cur_state: req.body.cur_state,
                cur_pincode: req.body.cur_pincode,
                cur_long: req.body.cur_long,
                cur_lat: req.body.cur_lat
            }
        ];
        var permanent_address = [
            {
                perm_address: req.body.perm_address,
                perm_city: req.body.perm_city,
                perm_state: req.body.perm_state,
                perm_pincode: req.body.perm_pincode,
                perm_long: req.body.perm_long,
                perm_lat: req.body.perm_lat
            }
        ];

        mongo.connect(url, function (err, db) {
            db.collection('employee').update(myquery, {
                $set: {
                    title: req.body.title,
                    first_name: req.body.first_name,
                    last_name: req.body.last_name,
                    surname: req.body.surname,
                    designation: req.body.designation,
                    employee_code: req.body.employee_code,
                    dob: req.body.dob,
                    gender: req.body.gender,
                    qualification: req.body.qualification,
                    job_category: req.body.job_category,
                    experience: req.body.experience,
                    phone: req.body.phone.toString(),
                    email: req.body.email,
                    joined_on: req.body.joined_on,
                    basic_pay: req.body.basic_pay,
                    blood_group: req.body.blood_group,
                    spoken_languages: req.body.spoken_languages,
                    salary_band: req.body.salary_band,
                    marital_status: req.body.marital_status,
                    perm_city: req.body.perm_city,
                    country: req.body.country,
                    state: req.body.state,
                    postal_code: req.body.postal_code,
                    pan_no: req.body.pan_no.toString(),
                    aadhar_no: req.body.aadhar_no.toString(),
                    passport_no: req.body.passport_no.toString(),
                    current_address: current_address,
                    permanent_address: permanent_address
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

router.route('/edit_employee_details/:employee_id')
    .put(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };
        var req_title = req.body.title;
        var req_first_name = req.body.first_name;
        var req_last_name = req.body.last_name;
        var req_dob = req.body.dob;
        var req_gender = req.body.gender;
        var req_qualification = req.body.qualification;
        var req_job_category = req.body.job_category;
        var req_experience = req.body.experience;
        var req_phone = req.body.phone.toString();
        var req_email = req.body.email;
        var req_website = req.body.website;
        var req_joined_on = req.body.joined_on;
        var salary_band = req.body.salary_band;
        var basic_pay = req.body.basic_pay;
        var mobile = req.body.mobile;
        var blood_group = req.body.blood_group;
        var spoken_languages = req.body.spoken_languages;
        var country = req.body.country;
        var state = req.body.state;
        var alternate_email = req.body.alternate_email;
        var perm_city = req.body.perm_city;
        var postal_code = req.body.postal_code.toString();
        var perm_address = req.body.perm_address;
        var cur_address = req.body.cur_address;
        var marital_status = req.body.marital_status;
        var pan_no = req.body.pan_no.toString();
        var aadhar_no = req.body.aadhar_no.toString();
        var passport_no = req.body.passport_no.toString();
        var alternate_email = req.body.alternate_email;
        var employee_code = req.body.code;


        mongo.connect(url, function (err, db) {
            db.collection('employee').update(myquery, {

                $set: {
                    title: req_title,
                    first_name: req_first_name,
                    last_name: req_last_name,
                    dob: req_dob,
                    gender: req_gender,
                    qualification: req_qualification,
                    job_category: req_job_category,
                    experience: req_experience,
                    phone: req_phone,
                    email: req_email,
                    employee_code: employee_code,
                    website: req_website,
                    joined_on: req_joined_on,
                    salary_band: salary_band,
                    alternate_email: alternate_email,
                    state: state,
                    basic_pay: basic_pay,
                    //  cur_address: cur_address,
                    // perm_address: perm_address,
                    mobile: mobile,
                    blood_group: blood_group,
                    spoken_languages: spoken_languages,
                    country: country,
                    postal_code: postal_code,
                    //   perm_city: perm_city,
                    marital_status: marital_status,
                    aadhar_no: aadhar_no,
                    passport_no: passport_no,
                    pan_no: pan_no,
                    alternate_email: alternate_email,
                    permanent_address: [{ perm_city: perm_city, perm_address: perm_address }],
                    current_address: [{ cur_address: cur_address }]
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

router.route('/edit_employee_details_mobile/:employee_id')
    .put(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };
        var req_first_name = req.body.first_name;
        var req_last_name = req.body.last_name;
        var req_email = req.body.email;
        var req_blood_group = req.body.blood_group;
        var req_marital_status = req.body.marital_status;
        var req_cur_address = req.body.cur_address;

        mongo.connect(url, function (err, db) {
            db.collection('employee').update(myquery, {
                $set: {
                    first_name: req_first_name,
                    last_name: req_last_name,
                    email: req_email,
                    blood_group: req_blood_group,
                    marital_status: req_marital_status,
                    current_address: [{ cur_address: req_cur_address }],
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

router.route('/delete_employee/:employee_id')
    .put(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };
        var employee_id = req.params.employee_id;
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            db.collection('employee').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('employee false');
                }
                else {
                    db.collection('teachers').update(myquery, { $set: { status: 0 } }, function (err, result) {
                        if (err) {
                            res.send('teacher false');
                        }
                        else {
                            db.collection('teacher_id').update({
                                teacher_id: employee_id
                            }, {
                                $set: { status: 0 }
                            }, function (err, result) {
                                if(err) {
                                    res.end('teacher false')
                                } else {
                                    db.close();
                                    mongo.connect(loginUrl, function (err, db1) {
                                        db1.collection('users').update({ login: employee_id }, { $set: { status: 0 } }, function (err, result) {
                                            assert.equal(null, err);
                                            if (err) {
                                                res.send('user false');
                                            } else {
        
                                                db.close();
                                                res.send('true');
                                            }
                                        });
                                    });
                                }
                            })
                        }
                    });
                }
            });
        });
    });

router.route('/restore_employee/:employee_id')
    .put(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };
        var employee_id = req.params.employee_id;
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            db.collection('employee').update(myquery, { $set: { status: 1 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('employee false');
                }
                else {
                    db.collection('teachers').update(myquery, { $set: { status: 1 } }, function (err, result) {
                        if (err) {
                            res.send('teacher false');
                        }
                        else {
                            db.close();
                            mongo.connect(loginUrl, function (err, db1) {
                                db1.collection('users').update({ login: employee_id }, { $set: { status: 1 } }, function (err, result) {
                                    assert.equal(null, err);
                                    if (err) {
                                        res.send('user false');
                                    } else {
                                        db.close();
                                        res.send('true');
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
    });

router.route('/hard_delete_employee/:employee_id')
    .delete(function (req, res, next) {
        var myquery = { employee_id: req.params.employee_id };
        var employee_id = req.params.employee_id;
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            db.collection('employee').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('employee false');
                }
                else {
                    db.collection('teachers').deleteOne(myquery, function (err, result) {
                        if (err) {
                            res.send('teacher false');
                        }
                        else {
                            db.close();
                            mongo.connect(loginUrl, function (err, db1) {
                                db1.collection('users').deleteOne({ login: employee_id }, function (err, result) {
                                    assert.equal(null, err);
                                    if (err) {
                                        res.send('user false');
                                    } else {
                                        db.close();
                                        res.send('true');
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
    });

var storageImage = multer.diskStorage({ //multers disk storage settings
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
        // cb(null, file.originalname);
    }
});

var uploadZip = multer({ //multer settings
    storage: storageImage,
    fileFilter: function (req, file, callback) { //file filter
        if (['.zip'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

// Add Employee
router.route('/multiple_images_zip/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        uploadZip(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            var dirPath = __dirname + "./uploads/" + req.file.filename;

            var destPath = __dirname + "/uploads/unzip";

            fs.createReadStream(dirPath).pipe(unzip.Extract({ path: destPath }));

            res.redirect('/');


        });
    });

router.route('/employee_delete_bulk/:school_id')
    .post(function (req, res, next) {
        var employees = req.body.employees;
        var resultArray = [];
        // console.log(students);
        if (!req.body.employees) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.employees.length > 0) {
                forEach(req.body.employees, function (key, value) {

                    mongo.connect(url, function (err, db) {
                        db.collection('employee').deleteOne({ employee_id: key.employee_id }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }

                            count++;
                            if (count == req.body.employees.length) {

                                res.end('true');
                            }

                        });
                    });
                });
            } else {
                res.end('false');
            }
        }
    });

router.route('/employees_photo')
    .put(function (req, res, next) {
        var employee_image = {
            "filename": "student.jpg",
            "originalname": "student",
            "imagePath": "uploads",
            "imageSrc": "/image/student.jpg",
            "mimetype": "jpg/image"
        };
        mongo.connect(url, function (err, db) {
            db.collection('employee').updateMany({}, {
                $unset: {
                    employeeId: null,
                },
                $set: {
                    employeeImage: employee_image
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

module.exports = router;
