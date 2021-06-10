// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var multer = require('multer');
var async = require('async');
var router = express.Router();
var url = config.dburl;
var loginUrl = config.loginUrl;

// Add Schools
router.route('/class_sections/:class_id')
    .post(function (req, res, next) {
        var status = 1;
        var class_id = req.params.class_id;

        var splited = class_id.split("-");
        var school_id = splited[0];

        school_classes = [];
        var item = {
            section_id: 'getauto',
            class_id: class_id,
            name: req.body.name,
            pattern_id: req.body.pattern,
            school_id: school_id,
            teacher_name: req.body.teacher_name,
            employee_id: req.body.teacher_name,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'class_sections', function (err, autoIndex) {
                var collection = db.collection('class_sections');
                collection.ensureIndex({
                    "section_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.name == null) {
                            res.end('null');
                        } else {
                            collection.insertOne(item, function (err, result) {
                                if (err) {
                                    if (err.code == 11000) {
                                        console.log(err);
                                        res.end('false');
                                    }
                                    res.end('false');
                                }
                                collection.update({
                                    _id: item._id
                                }, {
                                        $set: {
                                            section_id: class_id + '-SEC-' + autoIndex
                                        }
                                    }, function (err, result) {
                                        db.close();
                                        res.end('true');
                                    });
                            });
                        }
                    });
            });
        });
    })
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').find({ class_id: class_id }).sort({ name: 1 });
            //  var cursor = db.collection('class_sections').aggregate([
            //     {
            //         $match: {
            //             class_id: class_id,
            //         }
            //     },
            //     {
            //         $lookup: {
            //             from: "school_classes",
            //             localField: "class_id",
            //             foreignField: "class_id",
            //             as: "class_doc"
            //         }
            //     },
            //     {
            //         $unwind: "$class_doc"
            //     },
            //     {
            //         $lookup: {
            //             from: "employee",
            //             localField: "employee_id",
            //             foreignField: "employee_id",
            //             as: "employee_doc"
            //         }
            //     },
            //     {
            //         $unwind: "$employee_doc"
            //     },
            //     {
            //         $lookup: {
            //             from: "patterns",
            //             localField: "pattern_id",
            //             foreignField: "pattern_id",
            //             as: "pattern_doc"
            //         }
            //     },
            //     {
            //         $unwind: "$pattern_doc"
            //     },
            //     {
            //         $group: {
            //             _id: '$_id',
            //             class_name: {
            //                 "$first": "$class_doc.name"
            //             },
            //             section_name: {
            //                 "$first": "$name"
            //             },
            //             section_id: {
            //                 "$first": "$section_id"
            //             },
            //             class_id: {
            //                 "$first": "$class_id"
            //             },
            //             teacher_name: {
            //                 "$first": "$employee_doc.first_name"
            //             },
            //             pattern: {
            //                 "$first": "$pattern_doc.pattern"
            //             },
            //         }
            //     }
            // ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);


                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    class_sections: resultArray
                });
            });
        });
    });

router.route('/get_section_teachers/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var status = 1;
        var teachers = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getteachersList(result, next) {
                        var cursor = db.collection('teacher_subjects').aggregate([
                            {
                                $match: {
                                    'subjects': {
                                        $elemMatch: { section_id: section_id }
                                    }

                                }
                            },
                            { $unwind: '$subjects' },
                            {
                                $match: {
                                    'subjects.section_id': section_id
                                }
                            },
                            {
                                $lookup: {
                                    from: "employee",
                                    localField: "teacher_id",
                                    foreignField: "employee_id",
                                    as: "teacher_doc"
                                }
                            },
                            { "$unwind": "$teacher_doc" },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "teacher_id": "$teacher_id",
                                    "employee_id": "$teacher_doc.employee_id",
                                    "teacher_name": "$teacher_doc.first_name",
                                    "phone": "$teacher_doc.phone",
                                    "email": "$teacher_doc.email"
                                }
                            }
                        ])
                        cursor.toArray(function (err, results) {

                            if (err) {
                                next(err, null);
                            }
                            teachers = results
                            console.log(teachers);
                            next(null, []);
                        });
                    },
                    function getTeachers( next) {
                        var teachersResult = teachers;
                        var teachersResultLength = teachers.length;
                        let teachersList = []
                        for (let i = 0; i < teachersResult.length; i++) {
                            if (teachersList.indexOf(teachersResult[i]) == -1) {
                                teachersList.push(teachersResult[i])
                            }
                        }
                        // return unique_array
                        next(null, teachersList)
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
                            teachers: result1
                        });

                    }
                }
            )
        });
    });

router.route('/get_sections_by_classid/:class_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').aggregate([
                {
                    $match: {
                        class_id: class_id,
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
                        from: "employee",
                        localField: "employee_id",
                        foreignField: "employee_id",
                        as: "employee_doc"
                    }
                },
                {
                    $unwind: "$employee_doc"
                },
                // {
                //     $lookup: {
                //         from: "patterns",
                //         localField: "pattern_id",
                //         foreignField: "pattern_id",
                //         as: "pattern_doc"
                //     }
                // },
                // {
                //     $unwind: "$pattern_doc"
                // },
                {
                    "$project": {
                        "_id": "$_id",
                        "class_name": "$class_doc.name",
                        "section_name": "$name",
                        "section_id": "$section_id",
                        "class_id": "$class_id",
                        "teacher_name": { $ifNull: ["$employee_doc.first_name", "Unspecified"] },
                        //"pattern": { $ifNull: [ "$pattern_doc.pattern", "Unspecified" ] }
                    }
                }
                // {
                //     $group: {
                //         _id: '$_id',
                //         class_name: {
                //             "$first": "$class_doc.name"
                //         },
                //         section_name: {
                //             "$first": "$name"
                //         },
                //         section_id: {
                //             "$first": "$section_id"
                //         },
                //         class_id: {
                //             "$first": "$class_id"
                //         },
                //         teacher_name: {
                //             "$first": "$employee_doc.first_name"
                //         },
                //         pattern: {
                //             "$first": "$pattern_doc.pattern"
                //         },
                //     }
                // }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    class_sections: resultArray
                });
            });
        });
    });

router.route('/get_sections_by_schoolId/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').aggregate([
                {
                    $match: {
                        school_id: school_id,
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
                    $group: {
                        _id: '$_id',
                        class_name: {
                            "$first": "$class_doc.name"
                        },
                        section_name: {
                            "$first": "$name"
                        },
                        section_id: {
                            "$first": "$section_id"
                        },
                        class_id: {
                            "$first": "$class_id"
                        }
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    class_sections: resultArray
                });
            });
        });
    });

router.route('/get_sections_ids/:class_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').aggregate([
                { $match: { class_id } },
                {
                    $group: {
                        _id: '$class_id', sections: { $push: '$section_id' }
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
            });
        });
    });

router.route('/get_section/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').find({
                section_id
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
            });
        });
    });

router.route('/class_section_school/:class')
    .delete(function (req, res, next) {
        var myquery = { school_id: req.params.class };
        mongo.connect(url, function (err, db) {
            db.collection('schools').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    mongo.connect(url, function (err, db) {
                        db.collection('users').deleteOne(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('students false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });


router.route('/class_sections_edit/:section_id/:name/:value')
    .post(function (req, res, next) {
        var section_id = req.params.section_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('class_sections').update({ section_id }, { $set: { [name]: value } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });


router.route('/edit_sections/:section_id')
    .put(function (req, res, next) {

        var myquery = { section_id: req.params.section_id };
        var req_name = req.body.name;
        var req_employee_id = req.body.teacher_name;
        var req_pattern = req.body.pattern;

        mongo.connect(url, function (err, db) {
            db.collection('class_sections').update(myquery, {
                $set: {
                    name: req_name,
                    employee_id: req_employee_id,
                    pattern: req_pattern,
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



router.route('/delete_sections/:section_id')
    .delete(function (req, res, next) {
        var myquery = { section_id: req.params.section_id };
        mongo.connect(url, function (err, db) {
            db.collection('class_sections').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    mongo.connect(url, function (err, db) {
                        db.collection('students').deleteOne(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('students false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
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

var uploadImage = multer({ //multer settings
    storage: storageImage,
    fileFilter: function (req, file, callback) { //file filter
        if (['jpg', 'png'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).any();

router.route('/multiplephotos')
    .post(function (req, res, next) {

        var result = [];
        var studentImage = [];
        uploadImage(req, res, function (err) {
            //  console.log(req.body);
            //  console.log(req.files.length);
            filesArray = req.files;
            //   console.log(req.files);
            for (i = 0; i < filesArray.length; i++) {

                filename = filesArray[i].filename;
                originalname = filesArray[i].originalname;
                mimetype = filesArray[i].mimetype;
                if (i == 0) {
                    studentImage.push({ filename: filename, originalname: originalname, mimetype: mimetype });
                }
                else {
                    result.push({ filename: filename, originalname: originalname, mimetype: mimetype });
                }
            }

            // console.log(studentImage);
            // console.log(result);

            if (err) {
                return res.end("Error uploading file.");
            }

        });
        res.end("hello");
    });




module.exports = router;
