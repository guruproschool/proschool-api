// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var assert = require('assert');
var fs = require('fs');
var parentModule = require('../api_components/parent_module');
var async = require('async');
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;
var loginUrl = config.loginUrl;
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

// Add Students

router.route('/students/:section_id')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];
        var studentDocumentsArray = filesArray = [];
        var parent_account_new = req.body.parent_account_new;
        // var parent_account_new = true;

        var parents = [];
        if (req.body.primary_parent === 'father') {
            var parent_name = req.body.father_name;
            var parent_email = req.body.father_email;
            var parent_phone = req.body.father_contact.toString();
        } else if (req.body.primary_parent === 'mother') {
            var parent_name = req.body.mother_name;
            var parent_email = req.body.mother_email;
            var parent_phone = req.body.mother_contact.toString();
        } else if (req.body.primary_parent === 'guardian') {
            var parent_name = req.body.gaurdian_name;
            var parent_email = req.body.gaurdian_email;
            var parent_phone = req.body.gaurdian_contact.toString();
        }

        uploadImage(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.files) {
                var studentImage = {
                    filename: "student.jpg",
                    originalname: "student",
                    imagePath: "uploads",
                    imageSrc: "/image/student.jpg",
                    mimetype: "jpg/image",
                };
                // res.json({ error_code: 1, err_desc: "No file passed" });
                // return;
            } else {
                filesArray = req.files;
                for (i = 0; i < filesArray.length; i++) {
                    filename = filesArray[i].filename;
                    originalname = filesArray[i].originalname;
                    path = filesArray[i].path;
                    mimetype = filesArray[i].mimetype;
                    splitedImage = originalname.split(".");
                    originalname = splitedImage[0];

                    if (i == 0) {
                        studentImage = {
                            filename: filename,
                            originalname: originalname,
                            imagePath: path,
                            imageSrc: "/image/" + filename,
                            mimetype: mimetype,
                        }
                    }
                    else {
                        studentDocumentsArray.push({ filename: filename, originalname: originalname, imageSrc: imageSrc, mimetype: mimetype });
                    }
                }
            }
            var parent_account_details = {};
            parent_account_details.parent_account_create = req.body.parent_account_create;
            parent_account_details.parent_account_new = req.body.parent_account_new;
            // parent_account_details.parent_id = req.body.parent_id;
            parent_account_details.school_id = school_id;
            parent_account_details.section_id = section_id;
            parent_account_details.class_id = class_id;

            var status = 1;
            var item = {
                student_id: 'getauto',
                school_id: school_id,
                class_id: class_id,
                section_id: section_id,
                surname: req.body.surname,
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                gender: req.body.gender,
                dob: req.body.dob,
                aadhar_no: req.body.aadhar_no.toString(),
                nationality: req.body.nationality,
                date: new Date(),
                phone: req.body.phone.toString(),
                email: req.body.email,
                category: req.body.category,
                admission_date: req.body.admission_date,
                admission_no: req.body.admission_no.toString(),
                roll_no: parseInt(req.body.roll_no),
                academic_year: req.body.academic_year,
                blood_group: req.body.blood_group,
                bus_route_id: req.body.bus_route_id,
                primary_parent: req.body.primary_parent,
                parent_name: parent_name,
                payment_mode: 'none',
                studentImage: studentImage,
                studentDocuments: [],
                status: status
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
            var parent_father = {
                parent_name: req.body.father_name,
                parent_contact: req.body.father_contact.toString(),
                parent_email: req.body.father_email,
                parent_relation: 'father',
                parent_address: req.body.cur_address + ' ' + req.body.perm_city + ' ' + req.body.perm_state + ' ' + req.body.perm_pincode,
                occupation: req.body.father_occupation
            };
            var parent_mother = {
                parent_name: req.body.mother_name,
                parent_contact: req.body.mother_contact.toString(),
                parent_email: req.body.mother_email,
                parent_relation: 'mother',
                parent_address: req.body.cur_address + ' ' + req.body.perm_city + ' ' + req.body.perm_state + ' ' + req.body.perm_pincode,
                occupation: req.body.mother_occupation
            };
            var parent_gaurdian = {
                parent_name: req.body.gaurdian_name,
                parent_contact: req.body.gaurdian_contact.toString(),
                parent_email: req.body.gaurdian_email,
                parent_relation: 'guardian',
                parent_address: req.body.gaurdian_address,
                occupation: req.body.gaurdian_occupation
            };

            User.findOne({
                $or: [{ 'phone': req.body.phone.toString() }, { 'email': parent_email }]
            }, function (err, existingUser) {
                if (existingUser) {
                    console.log(existingUser)
                    console.log('Hello-1');
                    var schools = existingUser.schools;
                    var countt = 0;
                    schools.forEach(function (school) {
                        if (school == school_id) {
                            countt++
                        }
                    })
                    if (countt === 1) {
                        console.log('Hello-2');
                        var parent_id = existingUser.uniqueId;
                        mongo.connect(url, function (err, db) {
                            db.collection('students').find({
                                first_name: req.body.first_name,
                                last_name: req.body.last_name,
                                section_id: section_id
                            }).toArray(function (err, docs) {
                                if (docs.length === 1) {
                                    res.send({ status: 'Student details Already exists', id: '' });
                                } else if (parent_account_new === true) {
                                    res.send({ status: 'User details Already exists', id: '' });
                                } else {
                                    autoIncrement.getNextSequence(db, 'students', function (err, autoIndex) {
                                        var collection = db.collection('students');
                                        collection.createIndex({
                                            "student_id": 1
                                        }, {
                                            unique: true
                                        }, function (err, result) {
                                            if (item.section_id == null || item.dob == "undefined" || item.phone == "undefined" || item.first_name == "undefined" || current_address.cur_address == "undefined" || permanent_address.perm_address == "undefined" || item.dob == null || item.parent_name == "undefined" || item.phone == null) {
                                                res.end('null');
                                            } else {
                                                collection.insertOne(item, function (err, result) {
                                                    if (err) {
                                                        if (err.code == 11000) {
                                                            res.end('false1');
                                                        }
                                                        res.end('false2');
                                                    } else {
                                                        collection.update({
                                                            _id: item._id
                                                        }, {
                                                            $set: {
                                                                student_id: 'ST' + autoIndex,
                                                            },
                                                            $push: {
                                                                current_address,
                                                                permanent_address,
                                                                parents: parent_father
                                                            }
                                                        });
                                                        collection.update({
                                                            _id: item._id
                                                        }, {
                                                            $push: {
                                                                parents: parent_mother
                                                            }
                                                        });
                                                        collection.update({
                                                            _id: item._id
                                                        }, {
                                                            $push: {
                                                                parents: parent_gaurdian
                                                            }
                                                        });

                                                        var requestData = {}
                                                        requestData.name = parent_name;
                                                        requestData.student_id = 'ST' + autoIndex;
                                                        requestData.parent_id = parent_id;
                                                        requestData.school_id = school_id;
                                                        requestData.section_id = section_id;
                                                        requestData.class_id = class_id;
                                                        requestData.email = parent_email;
                                                        requestData.phone = req.body.phone;

                                                        parents.push(requestData)

                                                        parentModule.addStudentToParent(parents, res);
                                                    }
                                                });
                                            }
                                        });
                                        collection.ensureIndex({
                                            "first_name": "text",
                                            "last_name": "text"
                                        });
                                    });
                                }
                            })
                        })
                    } else {
                        console.log('Hello-3');
                        User.updateOne({ $or: [{ 'phone': req.body.phone.toString() }, { 'email': parent_email }] }, { $push: { schools: school_id } });
                        mongo.connect(url, function (err, db) {
                            db.collection('students').findOneAndUpdate(
                                {
                                    first_name: req.body.first_name,
                                    last_name: req.body.last_name,
                                },
                                {
                                    $set: { school_id: school_id }
                                }, function (err, resultt) {
                                    if (err) {
                                        res.end('false')
                                    } else {
                                        var student_id = resultt.student_id;
                                        db.collection('parents').update({
                                            "students.student_id": student_id
                                        }, {
                                            $set: {
                                                school_id: school_id,
                                                "students.class_id": class_id,
                                                "students.section_id": section_id
                                            }
                                        }, {
                                            $push: {
                                                schools: school_id
                                            }
                                        }, function (err, result) {
                                            db.close();
                                            res.send({ status: 'true', id: student_id });
                                        })
                                    }
                                }
                            )
                        })
                    }
                } else {
                    console.log('Hello-4');
                    mongo.connect(url, function (err, db) {
                        autoIncrement.getNextSequence(db, 'students', function (err, autoIndex) {
                            var collection = db.collection('students');
                            collection.createIndex({
                                "student_id": 1
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (item.section_id == null || item.dob == "undefined" || item.phone == "undefined" || item.first_name == "undefined" || current_address.cur_address == "undefined" || permanent_address.perm_address == "undefined" || item.dob == null || item.parent_name == "undefined" || item.phone == null) {
                                    res.end('null');
                                } else {
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            if (err.code == 11000) {
                                                res.end('false1');
                                            }
                                            res.end('false2');
                                        } else {
                                            collection.update({
                                                _id: item._id
                                            }, {
                                                $set: {
                                                    student_id: 'ST' + autoIndex,
                                                },
                                                $push: {
                                                    current_address,
                                                    permanent_address,
                                                    parents: parent_father
                                                }
                                            });
                                            collection.update({
                                                _id: item._id
                                            }, {
                                                $push: {
                                                    parents: parent_mother
                                                }
                                            });
                                            collection.update({
                                                _id: item._id
                                            }, {
                                                $push: {
                                                    parents: parent_gaurdian
                                                }
                                            });

                                            var requestData = {}
                                            requestData.name = parent_name;
                                            requestData.student_id = 'ST' + autoIndex;
                                            requestData.parent_id = parent_account_details.parent_id;
                                            requestData.school_id = parent_account_details.school_id;
                                            requestData.section_id = parent_account_details.section_id;
                                            requestData.class_id = parent_account_details.class_id;
                                            requestData.email = parent_email;
                                            requestData.phone = req.body.phone;

                                            parents.push(requestData)

                                            parentModule.addParent(parents, res);

                                            // if (parent_account_details.parent_account_create == true || parent_account_details.parent_account_create == 'true') {
                                            //     parentModule.addParent(requestData);
                                            //     parentModule.addParent(parents, res);
                                            // } else {
                                            //     parentModule.addStudentToParent(requestData);
                                            //     parentModule.addStudentToParent(parents, res);
                                            // }
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
                }
            });
        });
    })

router.route('/students/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').aggregate([
                {
                    $match: {
                        section_id: section_id
                    }
                },
                {
                    $lookup: {
                        from: "school_classes",
                        localField: "class_id",
                        foreignField: "class_id",
                        as: "school_classes"
                    }
                },
                {
                    $lookup: {
                        from: "class_sections",
                        localField: "section_id",
                        foreignField: "section_id",
                        as: "sections"
                    }
                }

            ]).sort({ roll_no: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    students: resultArray
                });
            });
        });
    });

// GET students list for Chat
router.route('/students_chatlist/:section_id/:employee_id')
    .get(function (req, res, next) {

        var section_id = req.params.section_id;
        var employee_id = req.params.employee_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getStudentsList(next) {
                        var cursor = db.collection('students').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
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
                                "$project": {
                                    "student_id": "$student_id",
                                    "first_name": "$first_name",
                                    "last_name": "$last_name",
                                    "parent_name": "$parents",
                                    "class_id": "$class_id",
                                    "class_name": "$class_doc.name",
                                    "section_id": "$section_id",
                                    "section_name": "$section_doc.name",
                                    "roll_no": "$roll_no",
                                    "student_image": "$studentImage.imageSrc"
                                }
                            }

                        ]).sort({ roll_no: 1 })
                        cursor.toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            result.forEach(function (data) {
                                data.parent_name = data.parent_name[0].parent_name;
                            })
                            next(null, result);
                        });
                    },
                    function getStudentChat(result, next) {
                        var count = 0;
                        var studentsResult = result;
                        var studentsResultLength = result.length;
                        if (studentsResultLength == 0) {
                            next(null, []);
                        } else {
                            studentsResult.forEach(function (studentData) {
                                var student_id = studentData.student_id;
                                db.collection('chats').find({
                                    members: { $in: [student_id] },
                                    status: 1
                                }).toArray(function (err, resultArray) {
                                    count++;
                                    console.log(resultArray)
                                    console.log('END')
                                    assert.equal(null, err);
                                    var unread = 0;
                                    var count1 = 0;
                                    if (resultArray.length > 0) {
                                        studentData.chat_id = resultArray[0].chat_id;
                                        resultArray[0].messages.forEach(function (msg) {
                                            count1++

                                            if ((resultArray[0].members[0] === employee_id || resultArray[0].members[1] === employee_id) && msg.status !== 'READ' && msg.receiver === employee_id) {
                                                unread++;
                                            }
                                            if (count1 === resultArray[0].messages.length) {
                                                studentData.unread_messages = unread;
                                            }
                                        });
                                    } else {
                                        studentData.chat_id = employee_id + '_' + student_id;
                                        studentData.unread_messages = 0;
                                    }
                                    if (count === studentsResultLength) {
                                        next(null, studentsResult);
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
                        res.send({ students: result1 });
                    }
                }
            )
        });
    });

router.route('/students_mobile/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').aggregate([
                {
                    $match: {
                        section_id: section_id,
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
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$first_name",
                        "last_name": "$last_name",
                        "parents": "$parents",
                        "class_id": "$class_id",
                        "class_name": "$class_doc.name",
                        "section_id": "$section_id",
                        "section_name": "$section_doc.name",
                        "student_image": "$studentImage.imageSrc"
                    }
                }

            ]).sort({ roll_no: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    students: resultArray
                });
            });
        });
    });

router.route('/student_photo_edit/:student_id')
    .post(function (req, res, next) {
        console.log('hello' + req.params.student_id);
        var myquery = { student_id: req.params.student_id };
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
            if (req.files.length > 0) {
                var filename = req.files[0].filename;
                var StudentImage = {
                    filename: filename,
                    originalname: req.files[0].originalname,
                    imagePath: req.files[0].path,
                    imageSrc: "/image/" + filename,
                    mimetype: req.files[0].mimetype,
                }
                mongo.connect(url, function (err, db) {
                    db.collection('students').update(myquery, {
                        $set:
                            { studentImage: StudentImage }
                        // SchoolImage: SchoolImage
                    }, function (err, result) {
                        if (err) {
                            res.send('false');
                        }
                        db.close();
                        res.send('true');
                    });
                });
            } else {
                res.send('true')
            }
        })
    });

var storageDoc = multer.diskStorage({ //multers disk storage settings
    destination: function (req, file, cb) {
        cb(null, '../uploads/documents/')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
        // cb(null, file.originalname);
    }
});

var uploadDoc = multer({ //multer settings
    storage: storageDoc,
    fileFilter: function (req, file, callback) { //file filter
        // if (['jpg', 'png'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
        //     return callback(new Error('Wrong extension type'));
        // }
        callback(null, true);
    }
}).any();

router.route('/add_student_Document/:student_id')
    .post(function (req, res, next) {
        var status = 1;

        var myquery = { student_id: req.params.student_id };
        console.log('Document API')

        uploadDoc(req, res, function (err) {
            console.log('docs-' + req.files)
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            /** Multer gives us file info in req.file object */
            if (!req.files) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }

            var studentDocumentsArray = [];

            for (i = 0; i < req.files.length; i++) {
                var filename = req.files[i].filename;
                var studentDocuments = {
                    filename: filename,
                    originalname: req.files[i].originalname,
                    imagePath: req.files[i].path,
                    imageSrc: "/files/" + filename,
                    mimetype: req.files[i].mimetype,
                }
                studentDocumentsArray.push(studentDocuments)
            }

            console.log(studentDocumentsArray)

            mongo.connect(url, function (err, db) {
                db.collection('students').update(myquery, {
                    $set:
                        { studentDocumentsArray: studentDocumentsArray }
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

router.route('/search_student/:academic_year/:class_id/:section/:search_key')
    .get(function (req, res, next) {
        var academic_year = req.params.academic_year;
        var class_id = req.params.class_id;
        var section = req.params.section.toUpperCase();
        var search_key = req.params.search_key;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ academic_year, class_id, section, status: 1, $text: { $search: search_key } });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/totalStudents_in_school/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                length = resultArray.length;
                db.close();
                res.send({ students: length });
            });
        });
    });

router.route('/totalNewStudents_in_school_by_Date/:select_date/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var select_date = new Date(req.params.select_date);
        var endDate = new Date(select_date);
        endDate.setDate(endDate.getDate() + 1)
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ date: { $gte: new Date(select_date.toISOString()), $lt: new Date(endDate.toISOString()) }, school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                length = resultArray.length;
                db.close();
                res.send({ students: length });
            });
        });
    });

router.route('/add_parent/:student_id')
    .post(function (req, res, next) {
        parents = [];
        var student_id = req.params.student_id;
        var parents = {
            parent_name: req.body.parent_name,
            parent_contact: req.body.parent_contact.toString(),
            parent_relation: req.body.parent_relation,
            occupation: req.body.occupation
        };
        mongo.connect(url, function (err, db) {
            db.collection('students').update({ student_id }, { $push: { parents } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/add_old_acadamic_details/:student_id')
    .post(function (req, res, next) {
        old_acadamic_details = [];
        var student_id = req.params.student_id;
        var old_acadamic_details = {
            school_name: req.body.school_name,
            class_name: req.body.class_name,
            percentage: req.body.percentage,
            rank: req.body.rank
        };
        mongo.connect(url, function (err, db) {
            db.collection('students').update({ student_id }, { $push: { old_acadamic_details } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/student_current_address/:student_id')
    .post(function (req, res, next) {
        current_address = [];
        var student_id = req.params.student_id;
        var cur_address = req.body.cur_address;
        var cur_city = req.body.cur_city;
        var cur_state = req.body.cur_state;
        var cur_pincode = req.body.cur_pincode;
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
            db.collection('students').findOneAndUpdate({ student_id }, { $set: { current_address } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/student_permanent_address/:student_id')
    .post(function (req, res, next) {
        permanent_address = [];
        var student_id = req.params.student_id;
        var perm_address = req.body.perm_address;
        var perm_city = req.body.perm_city;
        var perm_state = req.body.perm_state;
        var perm_pincode = req.body.perm_pincode;
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
            db.collection('students').findOneAndUpdate({ student_id }, { $set: { permanent_address } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

router.route('/student_details/:student_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;

        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //var cursor = db.collection('students').find({ student_id });
            var cursor = db.collection('students').aggregate([
                {
                    $match: {
                        student_id: student_id
                    }
                },
                {
                    $lookup: {
                        from: "school_classes",
                        localField: "class_id",
                        foreignField: "class_id",
                        as: "school_classes"
                    }
                },
                {
                    $lookup: {
                        from: "class_sections",
                        localField: "section_id",
                        foreignField: "section_id",
                        as: "sections"
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {

                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({ students: resultArray });
            });
        });
    });

router.route('/student_details_mobile/:student_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').aggregate([
                {
                    $match: {
                        student_id: student_id,
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
                    "$project": {
                        "_id": "$_id",
                        "student_id": "$student_id",
                        "first_name": "$first_name",
                        "last_name": "$last_name",
                        "parents": "$parents",
                        "class_id": "$class_id",
                        "class_name": "$class_doc.name",
                        "section_id": "$section_id",
                        "section_name": "$section_doc.name",
                        "student_image": "$studentImage.imageSrc"
                    }
                }

            ]).sort({ roll_no: 1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    students: resultArray
                });
            });
        });
    });

router.route('/getClassTeacher/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').aggregate([
                {
                    $match: {
                        section_id: section_id
                    }
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
                        employee_id: "$employee_doc.employee_id",
                        first_name: "$employee_doc.first_name",
                        last_name: "$employee_doc.last_name",
                        gender: "$employee_doc.gender",
                        phone: "$employee_doc.phone",
                        email: "$employee_doc.email",
                        employeeImage: "$employee_doc.employeeImage"
                    }
                },
            ]).toArray(function (err, results) {
                db.close();
                res.send({ teacher: results });
            })
        })
    })

router.route('/get_parents/:student_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ student_id }, { 'parents': 1, '_id': 0 });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
            });
        });
    });

router.route('/get_bus_route_by_student_id/:student_id/')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ student_id }, { 'bus_route_id': 1, '_id': 0 });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
            });
        });
    });

router.route('/get_array_students/:student_id/:array_name')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var array_name = req.params.array_name;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('students').find({ student_id }, {
                [array_name]: 1,
                '_id': 0
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
            });
        });
    });

router.route('/edit_students/:student_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };
        // var req_class_id = req.body.class_id;
        // var req_section = req.body.section;         
        // var req_first_name = req.body.first_name;
        // var req_last_name = req.body.last_name;          
        var req_gender = req.body.gender;
        var req_dob = req.body.dob;
        var req_phone = req.body.phone.toString();
        // var req_father_name = req.body.father_name;
        // var req_email = req.body.email;
        var req_category = req.body.category;
        // var req_admission_date = req.body.admission_date;
        // var req_admission_no = req.body.admission_no;         
        //  var req_roll_no = req.body.roll_no;
        //  var splited = req_class_id.split("-");
        //  var req_class_name = req.body.class_name;

        mongo.connect(url, function (err, db) {
            db.collection('students').update(myquery, {
                $set: {
                    //section:req_section,
                    //  class_name:req_class_name,
                    //  first_name:req_first_name,
                    //   last_name:req_last_name,
                    gender: req_gender,
                    category: req_category,
                    dob: req_dob,
                    phone: req_phone,
                    // parent_name:req_father_name
                    //  email:req_email,
                    //  admission_no:req_admission_no,
                    //   admission_date:req_admission_date,
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

router.route('/edit_student_details/:student_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };
        var req_first_name = req.body.first_name;
        var req_last_name = req.body.last_name;
        var req_gender = req.body.gender;
        var req_nationality = req.body.nationality;
        var req_dob = req.body.dob;
        var aadhar_no = req.body.aadhar_no.toString();
        var req_phone = req.body.phone.toString();
        var req_email = req.body.email;
        var req_category = req.body.category;
        var req_admission_date = req.body.admission_date;
        var req_admission_no = req.body.admission_no.toString();
        var req_roll_no = parseInt(req.body.roll_no);
        var blood_group = req.body.blood_group;
        var bus_route_id = req.body.bus_route_id;
        var primary_parent = req.body.primary_parent;

        if (req.body.primary_parent === 'father') {
            var parent_name = req.body.father_name;
            var parent_email = req.body.father_email;
            var parent_phone = req.body.father_contact.toString();
        } else if (req.body.primary_parent === 'mother') {
            var parent_name = req.body.mother_name;
            var parent_email = req.body.mother_email;
            var parent_phone = req.body.mother_contact.toString();
        } else if (req.body.primary_parent === 'guardian') {
            var parent_name = req.body.gaurdian_name;
            var parent_email = req.body.gaurdian_email;
            var parent_phone = req.body.gaurdian_contact.toString();
        }

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

        var parent_father = {
            parent_name: req.body.father_name,
            parent_contact: req.body.father_contact.toString(),
            parent_email: req.body.father_email,
            parent_relation: 'father',
            parent_address: req.body.cur_address + ' ' + req.body.perm_city + ' ' + req.body.perm_state + ' ' + req.body.perm_pincode,
            occupation: req.body.father_occupation
        };
        var parent_mother = {
            parent_name: req.body.mother_name,
            parent_contact: req.body.mother_contact.toString(),
            parent_email: req.body.mother_email,
            parent_relation: 'mother',
            parent_address: req.body.cur_address + ' ' + req.body.perm_city + ' ' + req.body.perm_state + ' ' + req.body.perm_pincode,
            occupation: req.body.mother_occupation
        };
        var parent_gaurdian = {
            parent_name: req.body.gaurdian_name,
            parent_contact: req.body.gaurdian_contact.toString(),
            parent_email: req.body.gaurdian_email,
            parent_relation: 'guardian',
            parent_address: req.body.gaurdian_address,
            occupation: req.body.gaurdian_occupation
        };

        var parents = [];
        parents.push(parent_father);
        parents.push(parent_mother);
        parents.push(parent_gaurdian)

        mongo.connect(url, function (err, db) {
            db.collection('students').update(myquery, {
                $set: {
                    first_name: req_first_name,
                    last_name: req_last_name,
                    gender: req_gender,
                    nationality: req_nationality,
                    aadhar_no: aadhar_no,
                    category: req_category,
                    dob: req_dob,
                    phone: req_phone,
                    email: req_email,
                    admission_no: req_admission_no,
                    admission_date: req_admission_date,
                    roll_no: req_roll_no,
                    blood_group: blood_group,
                    bus_route_id: bus_route_id,
                    current_address: current_address,
                    permanent_address: permanent_address,
                    primary_parent: primary_parent,
                    parent_name: parent_name,
                    parents: parents,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false1');
                } else {
                    db.collection('parents').findOneAndUpdate({
                        students: { $elemMatch: { student_id: req.params.student_id } }
                    }, {
                        $set: { 
                            parent_name: parent_name 
                        }
                    }, function (err, result) {
                        if (err) {
                            res.send('false2');
                        } else {
                            var parent_id = result.value.parent_id;
                            db.close();
                            mongo.connect(loginUrl, function(err, db1) {
                                db1.collection('users').update({
                                    login: parent_id
                                }, {
                                    $set: {
                                        phone: req.body.phone,
                                        email: parent_email 
                                    }
                                }, function(err, result) {
                                    if(err) {
                                        console.log(err)
                                        res.send('false3')
                                    } else {
                                        db1.close();
                                        res.send('true');
                                    }
                                });
                            })
                        }                        
                    });
                }
            });
        });
    });

router.route('/delete_student/:student_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };

        mongo.connect(url, function (err, db) {
            db.collection('students').update(myquery,
                {
                    $set: {
                        status: 0
                    }
                }, function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    } else {
                        db.collection('parents').findOneAndUpdate(
                            { students: { $elemMatch: { student_id: req.params.student_id } } },
                            { $set: { status: 0 } },
                            {
                                projection: { "parent_id": 1 },
                            }, function (err, result) {
                                if (err) {
                                    res.end('false')
                                } else {
                                    var parent_id = result.value.parent_id;
                                    db.close();
                                    mongo.connect(loginUrl, function (err, db1) {
                                        db1.collection('users').update({
                                            login: parent_id
                                        }, {
                                            $set: {
                                                status: 0
                                            }
                                        }, function (err, result1) {
                                            if (err) {
                                                res.end('false')
                                            } else {
                                                db.close();
                                                res.send('true')
                                            }
                                        })
                                    })
                                }
                            })
                    }
                });
        });
    });

router.route('/restore_student/:student_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };

        mongo.connect(url, function (err, db) {
            db.collection('students').update(myquery,
                {
                    $set: {
                        status: 1
                    }
                }, function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    } else {
                        db.collection('parents').findOneAndUpdate(
                            { students: { $elemMatch: { student_id: req.params.student_id } } },
                            { $set: { status: 1 } },
                            {
                                projection: { "parent_id": 1 },
                            }, function (err, result) {
                                if (err) {
                                    res.end('false')
                                } else {
                                    var parent_id = result.value.parent_id;
                                    db.close();
                                    mongo.connect(loginUrl, function (err, db1) {
                                        db1.collection('users').update({
                                            login: parent_id
                                        }, {
                                            $set: {
                                                status: 1
                                            }
                                        }, function (err, result1) {
                                            if (err) {
                                                res.end('false')
                                            } else {
                                                db.close();
                                                res.send('true')
                                            }
                                        })
                                    })
                                }
                            })
                    }
                });
        });
    });

router.route('/hard_delete_student/:student_id')
    .delete(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };

        mongo.connect(url, function (err, db) {
            db.collection('students').delelte(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// router.route('/delete_student/:student_id')
//     .put(function (req, res, next) {
//         var resultArray = resultArray2 = [];
//         var files2 = [];
//         var req_status = 0;
//         var student_id = req.params.student_id;
//         var myquery = { student_id: req.params.student_id };
//         mongo.connect(url, function (err, db) {
//             assert.equal(null, err);
//             var cursor = db.collection('students').find(myquery);
//             cursor.forEach(function (doc, err) {
//                 resultArray.push(doc);
//             }, function () {
//                 db.close();
//                 if (resultArray[0].studentImage) {

//                     if (resultArray[0].studentImage[0].filename != "student.jpg") {
//                         files2.push({ filename: resultArray[0].studentImage[0].filename });
//                     }
//                 }
//                 if (resultArray[0].studentDocuments) {

//                     studentDocumentsLength = resultArray[0].studentDocuments.length;


//                     for (i = 0; i < studentDocumentsLength; i++) {
//                         files2.push({ filename: resultArray[0].studentDocuments[i].filename });
//                     }

//                 }

//                 if (files2) {
//                     files2.forEach(function (doc, err) {

//                         filename = doc.filename;
//                         var filePath = __dirname + '/../uploads/' + filename;
//                         fs.access(filePath, error => {
//                             if (!error) {
//                                 fs.unlinkSync(filePath, function (error) {
//                                     console.log('hema');
//                                 });
//                             } else {
//                                 console.log(error);
//                             }
//                         });
//                     });
//                 }

//                 mongo.connect(url, function (err, db) {
//                     db.collection('students').update(myquery, {
//                         $set: {
//                             status: req_status,
//                         }
//                     }, function (err, result) {
//                         assert.equal(null, err);
//                         if (err) {
//                             res.send('false');
//                         }
//                         else {
//                             mongo.connect(url, function (err, db) {
//                                 db.collection('student_fee').updateMany(myquery,  {
//                                     $set: {
//                                         status: req_status,
//                                     }
//                                 },function (err, result) {
//                                     assert.equal(null, err);
//                                     if (err) {
//                                         res.send('false');
//                                     }
//                                     else {
//                                         mongo.connect(url, function (err, db) {
//                                             db.collection('assignment_marks').updateMany(myquery,  {
//                                                 $set: {
//                                                     status: req_status,
//                                                 }
//                                             },function (err, result) {
//                                                 assert.equal(null, err);
//                                                 if (err) {
//                                                     res.send('false');
//                                                 }
//                                                 else {
//                                                     mongo.connect(url, function (err, db) {
//                                                         db.collection('exam_evaluation').updateMany(myquery,  {
//                                                             $set: {
//                                                                 status: req_status,
//                                                             }
//                                                         },function (err, result) {
//                                                             assert.equal(null, err);
//                                                             if (err) {
//                                                                 res.send('false');
//                                                             }
//                                                             else {
//                                                                 mongo.connect(url, function (err, db) {
//                                                                     db.collection('attendance').updateMany(myquery,  {
//                                                                         $set: {
//                                                                             status: req_status,
//                                                                         }
//                                                                     },function (err, result) {
//                                                                         assert.equal(null, err);
//                                                                         if (err) {
//                                                                             res.send('false');
//                                                                         }
//                                                                         else {
//                                                                             mongo.connect(url, function (err, db) {
//                                                                                 assert.equal(null, err);
//                                                                                 var cursor = db.collection('parents').aggregate([
//                                                                                     {
//                                                                                         $match: { "students": { $elemMatch: { "student_id": student_id } } }
//                                                                                     },
//                                                                                     {
//                                                                                         "$project":
//                                                                                             {
//                                                                                                 "studentslength": { $size: "$students" }
//                                                                                             }
//                                                                                     }
//                                                                                 ]);
//                                                                                 cursor.forEach(function (doc, err) {
//                                                                                     assert.equal(null, err);
//                                                                                     resultArray.push(doc);
//                                                                                 }, function () {
//                                                                                     // console.log(resultArray[1])
//                                                                                     if (resultArray > 0) {

//                                                                                         if (resultArray[1].studentslength) {
//                                                                                             length = resultArray[1].studentslength;
//                                                                                             //  console.log(length);
//                                                                                             if (length != 0) {

//                                                                                                 //console.log(resultArray);
//                                                                                                 // length = resultArray[0].students.length;
//                                                                                                 parentId = resultArray[0].parent_id;
//                                                                                                 // console.log(parentId);
//                                                                                                 if (length > 1) {
//                                                                                                     mongo.connect(url, function (err, db) {
//                                                                                                         db.collection('parents').update({ "students": { $elemMatch: { "student_id": student_id } } },
//                                                                                                             { $pull: { "students": { "student_id": student_id } } })
//                                                                                                         assert.equal(null, err);
//                                                                                                         if (err) {
//                                                                                                             res.send('false');
//                                                                                                         }
//                                                                                                     });
//                                                                                                 }
//                                                                                                 else if (length == 1) {
//                                                                                                     mongo.connect(url, function (err, db) {
//                                                                                                         db.collection('parents').deleteOne({ "students": { $elemMatch: { "student_id": student_id } } })
//                                                                                                         assert.equal(null, err);
//                                                                                                         if (err) {
//                                                                                                             res.send('false');
//                                                                                                         }
//                                                                                                         else {
//                                                                                                             mongo.connect(loginUrl, function (err, db) {
//                                                                                                                 db.collection('users').deleteOne({ uniqueId: parentId })
//                                                                                                                 assert.equal(null, err);
//                                                                                                                 if (err) {
//                                                                                                                     res.send('false');
//                                                                                                                 }
//                                                                                                             });
//                                                                                                         }
//                                                                                                     });
//                                                                                                 }
//                                                                                             }
//                                                                                         }
//                                                                                     }
//                                                                                     db.close();
//                                                                                     res.send('true');
//                                                                                 });
//                                                                             });
//                                                                         }
//                                                                     });
//                                                                 });
//                                                             }
//                                                         });
//                                                     });
//                                                 }
//                                             });
//                                         });
//                                     }
//                                 });
//                             });
//                         }
//                     });
//                 });
//             });
//         });
//     });

router.route('/student_schedule/:section_id/:student_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var student_id = req.params.student_id;
        var resultArray = [];
        var d = new Date();
        var month = d.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var day = d.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var year = d.getFullYear();
        var current_date = year + '-' + month + '-' + day;

        var weekday = [];
        weekday[0] = "sunday";
        weekday[1] = "monday";
        weekday[2] = "tuesday";
        weekday[3] = "wednesday";
        weekday[4] = "thursday";
        weekday[5] = "friday";
        weekday[6] = "saturday";

        var Day = weekday[d.getDay()];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getTimetable(next) {
                        db.collection('timetable').aggregate([
                            {
                                $match: {
                                    section_id: section_id,
                                    day: Day,
                                    status: 1
                                },
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
                                $project:
                                {
                                    "id": "$timetable_id",
                                    "type": "Timetable",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                    "class": "$class_doc.name",
                                    "section": "$section_doc.name",
                                    "schedule": "$subject_doc.name",
                                }
                            }
                        ]).sort({ start_time: 1 }).forEach(function (doc, err) {
                            assert.equal(null, err);
                            doc.venue = doc.class + ' ' + doc.section;
                            delete doc.class;
                            delete doc.section;
                            resultArray.push(doc)
                        }, function () {
                            next(null, resultArray);
                        })
                    },
                    function getEvents(results, next) {

                        var cursor = db.collection('schoolevents').aggregate([
                            {
                                $match: {
                                    students: { $elemMatch: { attendee: student_id } },
                                    date: current_date,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                {
                                    "id": "$school_event_id",
                                    "type": "Event",
                                    "start_time": "$start_time",
                                    "end_time": "$end_time",
                                    "schedule": "$event_title",
                                }
                            }
                        ]);
                        cursor.sort({ start_time: 1 }).forEach(function (doc, err) {
                            assert.equal(null, err);
                            doc.venue = "";
                            resultArray.push(doc)
                        }, function () {
                            next(null, resultArray);
                        })
                    },
                    function getSchedule(results, next) {
                        var count = 0;
                        var scheduleResult = results;
                        var scheduleResultLength = results.length;
                        if (scheduleResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in scheduleResult) {
                                lookupObject[scheduleResult[i]["start_time"]] = scheduleResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
                        }
                    }
                ],
                function (err, newArray) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send(newArray);
                    }
                }
            );
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

var EditImage = multer({ //multer settings
    storage: storageImage,
    fileFilter: function (req, file, callback) { //file filter
        if (['jpg', 'png'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

router.route('/student_photo_edit/:student_id/:filename')
    .post(function (req, res, next) {
        var status = 1;

        var myquery = { student_id: req.params.student_id };
        var imagename = req.params.filename;

        if (imagename != "student.jpg") {

            var filePath = __dirname + '/../uploads/' + imagename;
            fs.access(filePath, error => {
                if (!error) {
                    fs.unlinkSync(filePath);
                } else {
                    console.log(error);
                }
            });
        }

        EditImage(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            // console.log(req.file);
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }
            // var SchoolImage = {
            filename = req.file.filename;
            originalname = req.file.originalname;
            imagePath = req.file.path;
            mimetype = req.file.mimetype;
            splitedImage = originalname.split(".");
            originalname = splitedImage[0];

            mongo.connect(url, function (err, db) {
                db.collection('students').update(myquery, {
                    $set:
                        ({ studentImage: [{ filename: filename, originalname: originalname, imagePath: imagePath, mimetype: mimetype }] })
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

router.route('/student_Document_photo_edit/:student_id/:imagename')
    .post(function (req, res, next) {
        var status = 1;
        var imagename = req.params.imagename;
        var student_id = req.params.student_id;
        var myquery = { student_id: req.params.student_id };
        //  var myquery = { student_id: req.params.student_id, studentDocuments: { $elemMatch: { filename: imagename } } };
        var filePath = __dirname + '/../uploads/' + imagename;

        fs.access(filePath, error => {
            if (!error) {
                fs.unlinkSync(filePath);
            } else {
                console.log(error);
            }
        });

        EditImage(req, res, function (err) {
            if (err) {
                res.json({ error_code: 1, err_desc: err });
                return;
            }
            // console.log(req.file);
            /** Multer gives us file info in req.file object */
            if (!req.file) {
                res.json({ error_code: 1, err_desc: "No file passed" });
                return;
            }

            filename = req.file.filename;
            originalname = req.file.originalname;
            imagePath = req.file.path;
            mimetype = req.file.mimetype;
            splitedImage = originalname.split(".");
            originalname = splitedImage[0];

            // mongo.connect(url, function (err, db) {
            //     db.collection('students').findAndModify({
            //         query: { "student_id": student_id },
            //         update: { "$set": { "studentDocuments.$[elem].filename": filename, "studentDocuments.$[elem].originalname": originalname } },
            //         arrayFilters: [{ "elem.filename": imagename }]
            //     })
            // })

            mongo.connect(url, function (err, db) {
                db.collection('students').update(myquery,
                    {
                        $pull: { studentDocuments: { filename: imagename } }
                    }, function (err, result) {
                        if (err) {
                            res.send('false');
                        }
                        else {
                            mongo.connect(url, function (err, db) {
                                db.collection('students').update(myquery,
                                    {
                                        $push: { studentDocuments: { filename: filename, originalname: originalname, imagePath: imagePath, mimetype: mimetype } }
                                    }, function (err, result) {
                                        if (err) {
                                            res.send('false');
                                        }
                                        db.close();
                                        res.send('true');
                                    });
                            });
                        }
                    });
            });
        });
    });

router.route('/delete_student_Document_photo/:student_id/:name')
    .delete(function (req, res, next) {
        var status = 1;
        var resultArray = [];
        var fs = require('fs');
        var filename = req.params.name;
        var myquery = { student_id: req.params.student_id };
        var filePath = __dirname + '/../uploads/' + filename;

        fs.access(filePath, error => {
            if (!error) {
                fs.unlinkSync(filePath);
            } else {
                console.log(error);
            }
        });
        mongo.connect(url, function (err, db) {
            db.collection('students').update(myquery,
                {
                    $pull: { studentDocuments: { filename: filename } }
                }, function (err, result) {
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
        });

    });

router.route('/student_delete_bulk/:class_id/:section_id/:school_id')
    .post(function (req, res, next) {
        var students = req.body.students;
        var resultArray = [];
        // console.log(students);
        if (!req.body.students) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.students.length > 0) {
                forEach(req.body.students, function (key, value) {

                    mongo.connect(url, function (err, db) {
                        db.collection('students').deleteOne({ student_id: key.student_id }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            count++;
                            if (count == req.body.students.length) {
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

router.route('/edit_student_parent_details/:student_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };
        var name = req.body.name;
        var contact = req.body.contact.toString();
        var parent_name = req.body.parent_name;

        mongo.connect(url, function (err, db) {
            // db.collection('students').update(myquery, {
            //     $set: {
            //         event_title: name,
            //     }
            // }, 
            db.collection('students').findAndModify({
                query: myquery,
                update: { "$set": { "parents.$[elem].parent_name": name, "parents.$[elem].contact": contact } },
                arrayFilters: [{ "elem.parent_name": parent_name }]
            },
                function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
        });
    });

router.route('/student_photo_bulkPost')
    .post(function (req, res, next) {
        var myquery = { school_id: "SCH-1" };

        var studentImage = {
            filename: "student.jpg",
            originalname: "student",
            imagePath: "uploads",
            imageSrc: "/image/student.jpg",
            mimetype: "jpg/image",
        };

        mongo.connect(url, function (err, db) {
            db.collection('students').updateMany(myquery, {
                $set: {
                    studentImage: studentImage
                }
            }, function (err, result) {
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });

    });

module.exports = router;