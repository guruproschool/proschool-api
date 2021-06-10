// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var async = require('async');
var fs = require('fs');
var forEach = require('async-foreach').forEach;
var multer = require('multer');
var url = config.dburl;
var url1 = config.loginUrl;
// var mailer = require('nodemailer');
var schoolUserModule = require('../api_components/school_registration_user');
// var AWS = require('aws-sdk');

// Add Schools

// Use Smtp Protocol to send Email
// var smtpTransport = mailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: "rqbtechnologies1962@gmail.com",
//         pass: "PROSchool"
//     }
// });

// function sendSMS(ToNum, msg, callback) {
//     AWS.config.update({
//         accessKeyId: 'AKIAJ4AYEOQIXGRN7SYA',
//         secretAccessKey: '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',
//         region: 'us-west-2'
//     });

//     var sns = new AWS.SNS();

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
}).single('file');


router.route('/schools')
    .post(function (req, res, next) {
        var status = 1;
        schools = [];
        uploadImage(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            var SchoolImage = {
                filename: req.file.filename,
                originalname: req.file.originalname,
                imagePath: req.file.path,
                imageSrc: "/image/" + req.file.filename,
                mimetype: req.file.mimetype,
            }
            var item = {
                school_id: 'getauto',
                master_school_id: req.body.master_school_id,
                name: req.body.name,
                est_on: req.body.est_on,
                address: req.body.address,
                phone: req.body.phone,
                email: req.body.email,
                website: req.body.website,
                academic_year: req.body.academic_year,
                description: req.body.description,
                founder: req.body.founder,
                chairman: req.body.chairman,
                vice_principal: req.body.vice_principal,
                extra_curricular_activites: req.body.extra_curricular_activites,
                coordinator: req.body.coordinator,
                principal: req.body.principal,
                alternate_phone: req.body.alternate_phone,
                class_from: req.body.class_from,
                timings: req.body.timings,
                alternate_email: req.body.alternate_email,
                medium: req.body.medium,
                facilities_available: req.body.facilities_available,
                affiliation: req.body.affiliation,
                status: status,
            };
            var username = req.body.email;
            var mail = {
                from: "mokshasoftsolutions@gmail.com",
                to: "info.proschool@mokshasoftsolutions.in",
                subject: "Registration of " + req.body.name + " with PROSchool - Reg.",
                text: "email: " + username + "password : " + username,
                html: "<b> Username :</b>" + username + "<br>" + "<b> Password : </b>" + username
            }

            // smtpTransport.sendMail(mail, function (error, response) {
            //     if (error) {
            //         console.log(error);
            //     } else {
            //         // console.log("Message sent: ");
            //     }

            //     smtpTransport.close();
            // });

            var msg = "Welcome " + req.body.name + ", You have successfully registered your School with PROSchool. Shortly you will receive the login credentials."
            var smsStatus;
            var phoneNum = req.body.phone;
            // var msg = "Fee Paid: " + req.body.fee_paid + "on " + req.body.current_date;
            // sendSMS(phoneNum, msg, function (err, status) {
            //     // if (err) {
            //     //     smsStatus = "failed";
            //     // }
            //     // else {
            //     //     smsStatus = "success";
            //     // }

            // });

            mongo.connect(url, function (err, db) {
                autoIncrement.getNextSequence(db, 'schools', function (err, autoIndex) {
                    var collection = db.collection('schools');
                    collection.ensureIndex({
                        "school_id": 1,
                    },{
                        unique: true
                    }, function (err, result) {
                        if (item.name == null || item.email == null || item.phone == null) {
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
                                        school_id: 'S' + autoIndex,
                                    },
                                    $push: {
                                        SchoolImage
                                    }
                                }, function (err, result) {
                                    db.close();
                                    res.send('username and password sent to your email');
                                    var userData = {};
                                    userData.email = item.email;
                                    userData.password = item.email;
                                    userData.uniqueId = 'S' + autoIndex;
                                    userData.role = "admin";
                                    userData.school_id = 'S' + autoIndex;
                                    schoolUserModule.addAdminToSchool(userData);
                                });
                            });
                        }
                    });
                });
            });
        });
    })
    .get(function (req, res, next) {
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schools').find({ status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    schools: resultArray
                });
            });
        });
    });

router.route('/addSchool')
    .post(function (req, res, next) {
        var userData = {};
        userData.email = req.body.email;
        userData.phone = req.body.phone;
        userData.password = req.body.password;
        userData.uniqueId = req.body.school_id;
        userData.role = "admin";
        userData.school_id = req.body.school_id;
        schoolUserModule.addAdminToSchool(userData, res);
    })

// Get School Details by Id
router.route('/school_details/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('schools').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    schools: resultArray
                });
            });
        });
    });

// Edit School Details by Id
router.route('/edit_school_details/:school_id')
    .put(function (req, res, next) {

        var myquery = { school_id: req.params.school_id };

        var req_name = req.body.name;
        var req_class_from = req.body.class_from;
        var req_medium = req.body.medium;
        var req_affiliation = req.body.affiliation;
        var req_timings = req.body.timings;
        var req_extra_curricular_activites = req.body.extra_curricular_activites;

        mongo.connect(url, function (err, db) {
            db.collection('schools').update(myquery, {
                $set: {
                    name: req_name,
                    class_from: req_class_from,
                    medium: req_medium,
                    affiliation: req_affiliation,
                    timings: req_timings,
                    extra_curricular_activites: req_extra_curricular_activites,
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

router.route('/edit_schoolManagement_details/:school_id')
    .put(function (req, res, next) {

        var myquery = { school_id: req.params.school_id };

        var req_founder = req.body.founder;
        var req_chairman = req.body.chairman;
        var req_principal = req.body.principal;
        var req_vice_principal = req.body.vice_principal;
        var req_coordinator = req.body.coordinator;
        var req_est_on = req.body.est_on;

        mongo.connect(url, function (err, db) {
            db.collection('schools').update(myquery, {
                $set: {
                    founder: req_founder,
                    chairman: req_chairman,
                    principal: req_principal,
                    vice_principal: req_vice_principal,
                    coordinator: req_coordinator,
                    est_on: req_est_on,
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

router.route('/edit_schoolContact_details/:school_id')
    .put(function (req, res, next) {

        var myquery = { school_id: req.params.school_id };

        var req_website = req.body.website;
        var req_email = req.body.email;
        var req_phone = req.body.phone;
        var req_alternate_phone = req.body.alternate_phone;
        var req_address = req.body.address;

        mongo.connect(url, function (err, db) {
            db.collection('schools').update(myquery, {
                $set: {
                    website: req_website,
                    email: req_email,
                    phone: req_phone,
                    alternate_phone: req_alternate_phone,
                    address: req_address,
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

router.route('/school/:school_id')
    .post(function (req, res, next) {
        var school_id = req.params.school_id;
        var name = req.body.name;
        var value = req.body.value;
        mongo.connect(url, function (err, db) {
            db.collection('schools').update({ school_id }, { $set: { [name]: value } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/schools_photo_edit/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var myquery = { school_id: req.params.school_id };
        uploadImage(req, res, function (err) {
            console.log(req.file)
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            // var SchoolImage = {
            filename = req.file.filename;
            originalname = req.file.originalname;
            imagePath = req.file.path;
            imageSrc = "/image/" + req.file.filename;
            mimetype = req.file.mimetype;
            // }
            //   var filename = req.file.filename;
            //   console.log(filename);

            mongo.connect(url, function (err, db) {
                db.collection('schools').update(myquery, {
                    $set:
                        ({ SchoolImage: [{ filename: filename, originalname: originalname, imagePath: imagePath, imageSrc: imageSrc, mimetype: mimetype }] })
                    // SchoolImage: SchoolImage
                }, function (err, result) {
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
            });
        })
    });

router.route('/school_Logo_edit/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var myquery = { school_id: req.params.school_id };
        uploadImage(req, res, function (err) {
            console.log(req.file)
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            // var SchoolImage = {
            filename = req.file.filename;
            originalname = req.file.originalname;
            imagePath = req.file.path;
            imageSrc = "/image/" + req.file.filename;
            mimetype = req.file.mimetype;
            // }
            //   var filename = req.file.filename;
            //   console.log(filename);

            mongo.connect(url, function (err, db) {
                db.collection('schools').update(myquery, {
                    $set:
                        ({ SchoolLogo: [{ filename: filename, originalname: originalname, imagePath: imagePath, imageSrc: imageSrc, mimetype: mimetype }] })
                    // SchoolImage: SchoolImage
                }, function (err, result) {
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
            });
        })
    });

router.route('/image/:fileName')
    .get( function (req, res) {
        var path = require('path');
        var file = path.join(__dirname, '../uploads/', req.params.fileName);

        res.sendFile(file);

    });

// router.route('/Email_to_Teacher/:teacher_id/:school_id')
//     .post(function (req, res, next) {
//         var school_id = req.params.school_id;
//         var teacherId = req.params.teacher_id;
//         //  var teacher = req.body.teacher;
//         //    teacherId = teacher_id.toUpperCase();
//         teacher_id = teacherId.toLowerCase();
//         var resultArray = resultArray2 = [];
//         mongo.connect(url, function (err, db) {
//             assert.equal(null, err);
//             var cursor = db.collection('teachers').find({ teacher_id: teacherId });
//             cursor.forEach(function (doc, err) {
//                 assert.equal(null, err);
//                 resultArray.push(doc);
//             }, function () {

//                 employeeId = resultArray[0].employee_id;
//                 // console.log(employeeId);

//                 mongo.connect(url, function (err, db) {
//                     assert.equal(null, err);
//                     var cursor = db.collection('employee').find({ employee_id: employeeId });
//                     cursor.forEach(function (doc, err) {
//                         assert.equal(null, err);
//                         resultArray.push(doc);
//                     }, function () {
//                         //   console.log(resultArray);
//                         email = resultArray[1].email;
//                         // console.log(email);

//                         var mail = {
//                             from: "mokshasoftsolutions@gmail.com",
//                             to: email,
//                             subject: "Authentication fields for PROSchool ",
//                             text: "email: " + teacher_id + "password : " + teacher_id,
//                             html: "<b> Username :</b>" + teacher_id + "<br>" + "<b> Password : </b>" + teacher_id
//                         }

//                         smtpTransport.sendMail(mail, function (error, response) {
//                             if (error) {
//                                 //console.log(error);
//                                 res.send('false');
//                             } else {
//                                 // console.log("Message sent: ");
//                             }

//                             smtpTransport.close();
//                         });
//                         db.close();

//                     });
//                 });

//                 res.send('true');
//             });
//         });

//     });


router.route('/Email_to_all_Teachers/:school_id')
    .post(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var teachersResultArray = req.body.teachers;
        var role = "teacher";
        async.waterfall(
            [

                function getSchoolEmployees(next) {
                    mongo.connect(url1, function (err, db) {
                        //   console.log("getSchoolClassed");
                        db.collection('users').find({
                            school_id: school_id,
                            role: role,
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    });
                },
                function getEmployeeData(result, next) {

                    //   console.log("getSectionsData");                      
                    var count = 0;
                    var teachersResult = result;
                    var teachersResultLength = result.length;
                    if (teachersResultLength == 0) {
                        next(null, []);
                    } else {
                        //  console.log("In Second step sections")
                        var teachersData = {};
                        teachersResult.forEach(function (teachersData) {
                            var employee_id = teachersData.employee_id;
                            mongo.connect(url, function (err, db) {
                                // console.log(class_id);
                                db.collection('employee').find({
                                    employee_id
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    teachersData.employee = results

                                    if (teachersResultLength == count) {

                                        next(null, teachersResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        })
                    }
                }, function getemployeeData(result, next) {
                    // console.log("getAttendanceData");
                    //  console.log(attResult);
                    //  console.log(result);
                    var count = 0;

                    var teachersResult = result;
                    var teacherDataLength = result.length;
                    //  console.log(classData.sections);
                    if (teacherDataLength == 0) {
                        next(null, []);
                    } else {
                        // console.log("In fourth step sections attendance")
                        teachersResult.forEach(function (teacherData) {


                            var sectionCount = 0;
                            var teachersData = teacherData;
                            var email = teacherData.email;

                            var employeeDataLength = teacherData.employee.length;
                            var employee_id = teacherData.employee_id;
                            // console.log(uniqueId)
                            if (employeeDataLength == 0) {
                                count++;
                                // console.log("count 0")
                            } else {
                                //  console.log(teacherId);
                                //  console.log(employee_id);
                                //   console.log(teachersResultArray);
                                teachersResultArrayLength = teachersResultArray.length;

                                for (var i = 0; i < teachersResultArrayLength; i++) {
                                    console.log(teachersResultArray[i].teacher_id)
                                    if (teachersResultArray[i].teacher_id == email) {
                                        Email = teachersData.employee[0].email;
                                        phoneNum = teacherData.employee[0].phone;
                                        teacher_name = teacherData.employee[0].first_name;
                                        //  console.log(Email);
                                        // filepath = __dirname + '/../uploads/file-1512814699055.jpg';
                                        var mail = {
                                            from: "rqbtechnologies1962@gmail.com",
                                            to: Email,
                                            subject: "Authentication fields for PROSchool ",
                                            text: "email: " + email + "password : " + email,
                                            html: "<b> Username :</b>" + email + "<br>" + "<b> Password : </b>" + email,
                                            // attachments: [{
                                            //     filename: 'file-1512814699055.jpg',
                                            //     streamSource: fs.createReadStream(filepath)
                                            // }]
                                        }

                                        smtpTransport.sendMail(mail, function (error, response) {
                                            if (error) {
                                                //console.log(error);
                                                // res.send('false');
                                            } else {
                                                console.log("Message sent: ");
                                            }

                                            smtpTransport.close();
                                        });

                                        var msg = "Greetings, Newton Public School is stepping into DIGITAL partnering with PROSchool. Kindly login with ID:" + email + ", Password:" + email + ". Download the app: https://play.google.com/store/apps/details?id=admin.proschool";
                                        var smsStatus;
                                        // var phoneNum = req.body.phone;
                                        // var msg = "Fee Paid: " + req.body.fee_paid + "on " + req.body.current_date;
                                        sendSMS(phoneNum, msg, function (err, status) {
                                            // if (err) {
                                            //     smsStatus = "failed";
                                            // }
                                            // else {
                                            //     smsStatus = "success";
                                            // }

                                        });


                                    }


                                }
                                count++;
                            }

                            if (teacherDataLength == count) {
                                next(null, 'true');
                            }
                        });
                    }
                }
            ],
            function (err, result1) {

                //db.close();
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

router.route('/Email_to_all_Parents/:school_id')
    .post(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var parentsResultArray = req.body.parents;


        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolParents(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('parents').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getParentsData(result, next) {

                        var count = 0;
                        var parentResult = result;
                        var parentResultLength = result.length;
                        if (parentResultLength == 0) {
                            next(null, []);
                        } else {

                            parentResult.forEach(function (parentData) {
                                //  console.log(parentsData);
                                var student_id = parentData.students[0].student_id;
                                // console.log(student_id);
                                db.collection('students').find({
                                    student_id
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    parentData.studentArray = results
                                    // console.log(student_id);
                                    // console.log(studentArray.students);
                                    if (parentResultLength == count) {

                                        next(null, parentResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    }, function getemployeeData(result, next) {
                        // console.log("getAttendanceData");
                        //   console.log(studentArray.students[0].father_email);
                        //  console.log(result);
                        var count = 0;

                        var parentResult = result;
                        var parentDataLength = result.length;
                        //  console.log(classData.sections);
                        if (parentDataLength == 0) {
                            next(null, []);
                        } else {
                            // console.log("In fourth step sections attendance")
                            parentResult.forEach(function (parentData) {

                                var parentsData = parentData;
                                var parentId = parentData.parent_id;

                                var parentDataLength = parentData.studentArray.length;
                                // var studentsArray2 = studentArray.students;
                                // var student_id = parentData.students[0].student_id;
                                //  var employeeEmail = teachersData.employee[0].email;
                                if (parentDataLength == 0) {
                                    count++;
                                    // console.log("count 0")
                                } else {
                                    //  console.log(studentArray);
                                    //  console.log(employee_id);
                                    //   console.log(teachersResultArray);
                                    parentsResultArrayLength = parentsResultArray.length;

                                    for (var i = 0; i < parentsResultArrayLength; i++) {
                                        //  console.log("hema");
                                        if (parentsResultArray[i].parent_id == parentId) {
                                            // console.log("babu");
                                            //  console.log(parentsResultArray[i].parent_id);
                                            if (parentData.studentArray[0].father_email) {
                                                // console.log(studentArray);
                                                Email = parentData.studentArray[0].father_email;
                                                //  console.log(parentId);
                                                //  console.log(Email);

                                                var mail = {
                                                    from: "mokshasoftsolutions@gmail.com",
                                                    to: Email,
                                                    subject: "Authentication fields of PROSchool ",
                                                    text: "email: " + parentId.toLowerCase() + "password : " + parentId.toLowerCase(),
                                                    html: "<b> Username :</b>" + parentId.toLowerCase() + "<br>" + "<b> Password : </b>" + parentId.toLowerCase()
                                                }

                                                smtpTransport.sendMail(mail, function (error, response) {
                                                    if (error) {
                                                        //console.log(error);
                                                        // res.send('false');
                                                    } else {
                                                        // console.log("Message sent: ");
                                                    }

                                                    smtpTransport.close();
                                                });

                                            }
                                        }


                                    }
                                    count++;
                                }

                                if (parentDataLength == count) {
                                    next(null, 'true');
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
