var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var parentModule = require('../api_components/parent_module');
var employeeModule = require('../api_components/employee_module');
var async = require('async');
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;

// multers disk storage settings
var storage = multer.diskStorage({
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

// Student Bulk Upload via excel sheet

router.route('/bulk_upload_students/:section_id')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var status = 1;
        var exceltojson;
        var date = new Date();
        var parents_data = [];
        var existing_parents_data = [];

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
            // console.log(req.file.path);
            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;
                    var count = 0;

                    if (test.length > 0) {
                        test.forEach(function (key, value) {
                            var parents = [];
                            var parent_account_details = {};
                            parent_account_details.parent_account_create = key.parentaccountcreate;
                            parent_account_details.parent_account_new = key.parentaccountnew;
                            parent_account_details.parent_id = key.parentid;
                            parent_account_details.school_id = school_id;
                            parent_account_details.class_id = class_id;
                            parent_account_details.section_id = section_id;

                            var studentImage = {
                                filename: "student.jpg",
                                originalname: "student",
                                imagePath: "uploads",
                                imageSrc: "/image/student.jpg",
                                mimetype: "jpg/image",
                            };
                            var item = {
                                student_id: 'getauto',
                                school_id: school_id,
                                class_id: class_id,
                                section_id: section_id,
                                surname: key.surname,
                                first_name: key.firstname,
                                last_name: key.lastname,
                                gender: key.gender,
                                dob: key.dob,
                                aadhar_no: key.aadharno.toString(),
                                phone: key.phone.toString(),
                                email: key.email,
                                category: key.category,
                                admission_date: key.admissiondate,
                                date: date,
                                admission_no: key.admissionno.toString(),
                                roll_no: parseInt(key.rollno),
                                academic_year: key.academicyear,
                                bus_route_id: key.busrouteid,
                                blood_group: key.bloodgroup,
                                father_name: key.fathername,
                                father_email: key.fatheremail,
                                studentImage: studentImage,
                                studentDocuments: [],
                                status: status,
                            };
                            var current_address = {
                                cur_address: key.curaddress,
                                cur_city: key.curcity,
                                cur_state: key.curstate,
                                cur_pincode: key.curpincode,
                                cur_long: key.curlong,
                                cur_lat: key.curlat
                            };
                            var permanent_address = {
                                perm_address: key.permaddress,
                                perm_city: key.permcity,
                                perm_state: key.permstate,
                                perm_pincode: key.permpincode,
                                perm_long: key.permlong,
                                perm_lat: key.permlat
                            };
                            var parent_father = {
                                parent_name: key.fathername,
                                parent_contact: key.fathercontact.toString(),
                                parent_email: key.fatheremail,
                                parent_relation: 'father',
                                parent_address: key.curaddress + ' ' + key.permcity + ' ' + key.permstate + ' ' + key.permpincode,
                                occupation: key.fatheroccupation
                            };
                            var parent_mother = {
                                parent_name: key.mothername,
                                parent_contact: key.mothercontact.toString(),
                                parent_email: key.motheremail,
                                parent_relation: 'mother',
                                parent_address: key.curaddress + ' ' + key.permcity + ' ' + key.permstate + ' ' + key.permpincode,
                                occupation: key.motheroccupation
                            };
                            var parent_gaurdian = {
                                parent_name: key.gaurdianname,
                                parent_contact: key.gaurdiancontact.toString(),
                                parent_email: key.gaurdianemail,
                                parent_relation: key.gaurdianrelation,
                                parent_address: key.gaurdianaddress,
                                occupation: key.gaurdianoccupation
                            };
                            parents.push(parent_father);
                            parents.push(parent_mother);
                            parents.push(parent_gaurdian);

                            mongo.connect(url, function (err, db) {
                                var collection = db.collection('students');
                                if (item.section_id == null || item.section_id == "" || item.section_id == "undefined" || item.first_name == null || item.first_name == "") {
                                    count++;
                                } else {
                                    collection.find({ first_name: item.first_name, last_name: item.last_name, roll_no: parseInt(item.roll_no), section_id: section_id, status: 1 }).count(function (e, triggercount) {
                                        if (triggercount > 0) {
                                            count++;
                                            console.log(count)
                                            if (count === test.length) {
                                                res.send({ data: 'Students are already Added' });
                                                db.close();
                                            }
                                        } else {
                                            autoIncrement.getNextSequence(db, 'students', function (err, autoIndex) {
                                                collection.createIndex({
                                                    "student_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    item.student_id = 'ST' + autoIndex;
                                                    collection.insertOne(item, function (err, result) {
                                                        if (err) {
                                                            console.log(err);
                                                            if (err.code == 11000) {

                                                                res.end('false');
                                                            }
                                                            res.end('false');
                                                        }
                                                        collection.update({
                                                            _id: item._id
                                                        }, {
                                                            $set: {
                                                                parents: parents
                                                            }
                                                        }, {
                                                            $push: {
                                                                current_address,
                                                                permanent_address,
                                                            }
                                                        });
                                                        var requestData = {}
                                                        requestData.parent_account_create = parent_account_details.parent_account_create;
                                                        requestData.name = parent_father.parent_name;
                                                        requestData.student_id = 'ST' + autoIndex;
                                                        requestData.parent_id = parent_account_details.parent_id;
                                                        requestData.school_id = parent_account_details.school_id;
                                                        requestData.class_id = parent_account_details.class_id;
                                                        requestData.section_id = parent_account_details.section_id;
                                                        requestData.email = key.fatheremail;
                                                        requestData.phone = key.fathercontact;

                                                        if (parent_account_details.parent_account_create == true || parent_account_details.parent_account_create == 'true' || parent_account_details.parent_account_create == 'TRUE') {
                                                            parents_data.push(requestData)
                                                            // parentModule.addParent(requestData);
                                                        } else {
                                                            existing_parents_data.push(requestData)
                                                            // parentModule.addStudentToParent(requestData);
                                                        }

                                                        count++;
                                                        if (count == test.length) {
                                                            db.close();
                                                            if (parent_account_details.parent_account_create == true || parent_account_details.parent_account_create == 'true' || parent_account_details.parent_account_create == 'TRUE') {
                                                                parentModule.addParent(parents_data, res);
                                                            } else {
                                                                parentModule.addStudentToParent(existing_parents_data, res);
                                                            }
                                                        }
                                                    });
                                                });
                                            });
                                        }
                                    })
                                }
                            });
                        });
                    }
                    else {
                        res.end('false');
                    }
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

// Employee Bulk Upload via excel sheet

router.route('/bulk_upload_employees/:school_id')
    .post(function (req, res, next) {
        var school_id = req.params.school_id;
        var status = 1;
        var exceltojson;
        var teachers_data = [];
        var nonteachers_data = [];
        var administratives_data = [];

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
            // console.log(req.file.path);
            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;
                    var count = 0;

                    if (test.length > 0) {
                        test.forEach(function (key, value) {
                            var employeeImage = {
                                filename: "student.jpg",
                                originalname: "student",
                                imagePath: "uploads",
                                imageSrc: "/image/student.jpg",
                                mimetype: "jpg/image",

                            };

                            var item = {
                                employee_id: 'getauto',
                                school_id: school_id,
                                title: key.title,
                                first_name: key.firstname,
                                last_name: key.lastname,
                                surname: key.surname,
                                dob: key.dob,
                                gender: key.gender,
                                designation: key.designation,
                                employee_code: key.employeecode,
                                qualification: key.qualification,
                                job_category: key.jobcategory,
                                experience: key.experience,
                                phone: key.phone.toString(),
                                email: key.email,
                                website: key.website,
                                joined_on: key.joinedon,
                                basic_pay: key.basicpay,
                                blood_group: key.bloodgroup,
                                spoken_languages: key.spokenlanguages,
                                salary_band: key.salaryband,
                                marital_status: key.maritalstatus,
                                mobile: key.mobile,
                                perm_city: key.permcity,
                                country: key.country,
                                state: key.state,
                                postal_code: key.postalcode,
                                alternate_email: key.alternateemail,
                                pan_no: key.panno,
                                aadhar_no: key.aadharno,
                                passport_no: key.passportno,
                                employeeImage: employeeImage,
                                status: status,
                            };
                            var current_address = {
                                cur_address: key.curaddress,
                                cur_city: key.curcity,
                                cur_state: key.curstate,
                                cur_pincode: key.curpincode,
                                cur_long: key.curlong,
                                cur_lat: key.curlat
                            };
                            var permanent_address = {
                                perm_address: key.permaddress,
                                perm_city: key.permcity,
                                perm_state: key.permstate,
                                perm_pincode: key.permpincode,
                                perm_long: key.permlong,
                                perm_lat: key.permlat
                            };

                            mongo.connect(url, function (err, db) {
                                var collection = db.collection('employee');
                                if (item.school_id == null || item.job_category == null || item.job_category == "" || item.job_category == "undefined") {
                                    // console.log("error 1");
                                    count++;
                                } else {
                                    collection.find({ first_name: item.first_name, last_name: item.last_name, status: 1 }).count(function (e, triggercount) {
                                        if (triggercount > 0) {
                                            count++;
                                            console.log(count)
                                            if (count === test.length) {
                                                res.send({ data: 'Employees are already Added' });
                                                db.close();
                                            }
                                        } else {
                                            autoIncrement.getNextSequence(db, 'employee', function (err, autoIndex) {
                                                collection.createIndex({
                                                    "employee_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    item.employee_id = 'E' + autoIndex;
                                                    collection.insertOne(item, function (err, result) {
                                                        if (err) {
                                                            console.log(err);
                                                            if (err.code == 11000) {

                                                                res.end('false');
                                                            }
                                                            res.end('false');
                                                        }
                                                        collection.update({
                                                            _id: item._id
                                                        }, {
                                                            $push: {
                                                                current_address,
                                                                permanent_address,
                                                            }
                                                        });
                                                        var requestData = {}
                                                        requestData.name = item.first_name + " " + item.last_name;
                                                        requestData.employee_id = 'E' + autoIndex;
                                                        requestData.joined_on = item.joined_on;
                                                        requestData.school_id = school_id;
                                                        requestData.email = item.email;
                                                        requestData.phone = item.phone;

                                                        if (item.job_category == "teaching") {
                                                            requestData.role = "teacher";
                                                            teachers_data.push(requestData);
                                                        }
                                                        else if (item.job_category == "administrative") {
                                                            requestData.role = "administrator";
                                                            nonteachers_data.push(requestData);
                                                        }
                                                        else if (item.job_category == "non-teaching") {
                                                            requestData.role = "non-teacher";
                                                            administratives_data.push(requestData);
                                                        }

                                                        count++;
                                                        if (count == test.length) {
                                                            db.close();

                                                            if (item.job_category == "teaching") {
                                                                employeeModule.addTeacher(teachers_data, res);
                                                            }
                                                            else if (item.job_category == "administrative") {
                                                                employeeModule.addAdministrator(nonteachers_data, res);
                                                            }
                                                            else if (item.job_category == "non-teaching") {
                                                                employeeModule.addNonTeacher(administratives_data, res);
                                                            }
                                                        }
                                                    });
                                                });
                                            });
                                        }
                                    })
                                }
                            });
                        });
                    }
                    else {
                        res.end('false');
                    }
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

// Subjects Bulk Upload via excel sheet

router.route('/bulk_upload_subjects/:section_id')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
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

            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;

                    if (test.length > 0) {
                        var count = 0;
                        mongo.connect(url, function (err, db) {
                            var collection = db.collection('subjects');
                            collection.find({ section_id: section_id }).count(function (err, triggerCount1) {
                                var counter = triggerCount1;
                                test.forEach(function (key, value) {
                                    var item = {
                                        subject_id: 'getauto',
                                        section_id: section_id,
                                        name: key.name,
                                        textbook: key.textbook,
                                        author: key.author,
                                        publisher: key.publisher,
                                        status: status,
                                    };

                                    if (item.section_id == null || item.section_id == "" || item.section_id == undefined || item.name == "" || item.name == null || item.name == undefined) {
                                        count++;
                                    } else {
                                        collection.find({ section_id: item.section_id, name: item.name, status: 1 }).count(function (e, triggercount) {
                                            if (triggercount > 0) {
                                                count++;
                                                if (count === test.length) {
                                                    res.send({ data: 'Subjects are already Added' });
                                                    db.close();
                                                }
                                            } else {
                                                counter++;
                                                item.subject_id = section_id + '-SUB' + counter;
                                                autoIncrement.getNextSequence(db, 'subjects', function (err, autoIndex) {
                                                    collection.createIndex({
                                                        "subject_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        collection.insertOne(item, function (err, result) {
                                                            count++;
                                                            if (err) {
                                                                console.log(err);
                                                                if (err.code == 11000) {
                                                                    res.end('false');
                                                                }
                                                                res.end('false');
                                                            } else {
                                                                if (count == test.length) {
                                                                    db.close();
                                                                    res.end('true');
                                                                }
                                                            }
                                                        });
                                                    });
                                                });
                                            }
                                        })
                                    }
                                });
                            })
                        })
                    }
                    else {
                        res.end('false');
                    }
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

// Chapters Bulk Upload via excel sheet

router.route('/bulk_upload_chapters/:subject_id')
    .post(function (req, res, next) {
        var subject_id = req.params.subject_id;
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

            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;

                    if (test.length > 0) {
                        var count = 0;
                        mongo.connect(url, function (err, db) {
                            var collection = db.collection('coursework');
                            collection.find({ subject_id: subject_id }).count(function (err, triggerCount1) {
                                var counter = triggerCount1;
                                test.forEach(function (key, value) {
                                    var completed_topics = 0;
                                    var no_of_topics = 0;
                                    var days = 0;

                                    var item = {
                                        lession_id: 'getauto',
                                        subject_id: subject_id,
                                        title: key.title,
                                        start_date: '',
                                        end_date: '',
                                        days: days,
                                        completed_topics: completed_topics,
                                        chapter_code: key.chaptercode,
                                        no_of_topics: no_of_topics,
                                        lession_status: 'Pending',
                                        started_date: '',
                                        completion_date: '',
                                        description: key.description,
                                        status: status,
                                    };

                                    if (item.subject_id == null || item.subject_id == "" || item.subject_id == undefined || item.title == "" || item.title == null || item.title == undefined) {
                                        count++;
                                    } else {
                                        collection.find({ subject_id: item.subject_id, title: item.title, status: 1 }).count(function (e, triggercount) {
                                            if (triggercount > 0) {
                                                count++;
                                                if (count === test.length) {
                                                    res.send({ data: 'Chapters are already Added' });
                                                    db.close();
                                                }
                                            } else {
                                                counter++;
                                                item.lession_id = subject_id + '-LES' + counter;
                                                autoIncrement.getNextSequence(db, 'coursework', function (err, autoIndex) {
                                                    collection.createIndex({
                                                        "lession_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        collection.insertOne(item, function (err, result) {
                                                            count++;
                                                            if (err) {
                                                                console.log(err);
                                                                if (err.code == 11000) {
                                                                    res.end('false');
                                                                }
                                                                res.end('false');
                                                            } else {
                                                                if (count == test.length) {
                                                                    db.close();
                                                                    res.end('true');
                                                                }
                                                            }
                                                        });
                                                    });
                                                });
                                            }
                                        })
                                    }
                                });
                            })
                        })
                    }
                    else {
                        res.end('false');
                    }
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

// Topics Bulk Upload via excel sheet

router.route('/bulk_upload_topics/:lession_id/:subject_id')
    .post(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var subject_id = req.params.subject_id;
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

            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;

                    if (test.length > 0) {
                        var count = 0;
                        mongo.connect(url, function (err, db) {
                            var collection = db.collection('topics');
                            collection.find({ lession_id: lession_id }).count(function (err, triggerCount1) {
                                var counter = triggerCount1;
                                test.forEach(function (key, value) {
                                    var item = {
                                        topic_id: 'getauto',
                                        topic_name: key.name,
                                        lession_id: lession_id,
                                        subject_id: subject_id,
                                        topic_status: "Pending",
                                        status: 1
                                    }

                                    if (item.subject_id == null || item.subject_id == "" || item.subject_id == undefined ||
                                        item.lession_id == "" || item.lession_id == null || item.lession_id == undefined ||
                                        item.topic_name == "" || item.topic_name == null || item.topic_name == undefined) {
                                        count++;
                                    } else {
                                        collection.find({ lession_id: item.lession_id, topic_name: item.topic_name, status: 1 }).count(function (e, triggercount) {
                                            if (triggercount > 0) {
                                                count++;
                                                if (count === test.length) {
                                                    res.send({ data: 'Topics are already Added' });
                                                    db.close();
                                                }
                                            } else {
                                                counter++;
                                                item.topic_id = lession_id + '-TOP' + counter;
                                                autoIncrement.getNextSequence(db, 'topics', function (err, autoIndex) {
                                                    collection.createIndex({
                                                        "topic_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        collection.insertOne(item, function (err, result) {
                                                            count++;
                                                            if (err) {
                                                                console.log(err);
                                                                if (err.code == 11000) {
                                                                    res.end('false');
                                                                }
                                                                res.end('false');
                                                            } else {
                                                                db.collection('coursework').update({ lession_id: lession_id }, {
                                                                    $inc: {
                                                                        no_of_topics: 1,
                                                                    }
                                                                }, function (err, result1) {
                                                                    if (err) {
                                                                        if (err.code == 11000) {
                                                                            res.end('false1')
                                                                        } else {
                                                                            res.end('false2')
                                                                        }
                                                                    } else if (count == test.length) {
                                                                        db.close();
                                                                        res.end('true');
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    });
                                                });
                                            }
                                        })
                                    }
                                });
                            })
                        })
                    }
                    else {
                        res.end('false');
                    }
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });


router.route('/bulk_upload_topics/:lession_id/:subject_id')
    .post(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var subject_id = req.params.subject_id;
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
            // console.log(req.file.path);
            try {
                exceltojson({
                    input: req.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 1, err_desc: err, data: null });
                    }
                    var test = result;

                    var count = 0;

                    mongo.connect(url, function (err, db) {
                        db.collection('topics').find({ lession_id: lession_id }).count(function (err, triggerCount1) {
                            var inc_id = triggerCount1;
                            if (test.length > 0) {
                                test.forEach(function (key, value) {
                                    if (lession_id == null || lession_id == "" || lession_id == undefined || subject_id == "" || subject_id == null || subject_id == undefined ||
                                        key.topic_name == null || key.topic_name == "" || key.topic_name == undefined) {
                                        db.close();
                                        res.end('null');
                                    } else {
                                        collection.find({ lession_id: lession_id, topic_name: item.topic_name, status: 1 }).count(function (e, triggerCount) {
                                            if (triggerCount > 0) {
                                                count++;
                                                if (count === test.length) {
                                                    res.send({ data: 'Topics are already Added' });
                                                    db.close();
                                                }
                                            } else {
                                                var id = inc_id++;
                                                var item = {
                                                    topic_id: lession_id + '-TOP' + id,
                                                    topic_name: key.name,
                                                    lession_id: lession_id,
                                                    subject_id: subject_id,
                                                    topic_status: "Pending",
                                                    status: 1
                                                }
                                                autoIncrement.getNextSequence(db, 'topics', function (err, autoIndex) {
                                                    collection.createIndex({
                                                        "topic_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        collection.insertOne(item, function (err, result) {
                                                            if (err) {

                                                                if (err.code == 11000) {

                                                                    res.end('false1');
                                                                } else {
                                                                    res.end('false2');
                                                                }
                                                            } else {
                                                                db.collection('coursework').update({ lession_id: lession_id }, {
                                                                    $inc: {
                                                                        no_of_topics: 1,
                                                                    }
                                                                }, function (err, result1) {
                                                                    count++;
                                                                    if (err) {
                                                                        if (err.code == 11000) {
                                                                            res.end('false1')
                                                                        } else {
                                                                            res.end('false2')
                                                                        }
                                                                    } else if (count == test.length) {
                                                                        db.close();
                                                                        res.end('true');
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    });
                                                });
                                            }
                                        })
                                    }
                                });
                            }
                            else {
                                res.end('false');
                            }
                        })
                    })
                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

module.exports = router;



