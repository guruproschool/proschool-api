// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;

// Add Section
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
            school_id: school_id,
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
                            collection.find({class_id: class_id}).count(function (err, triggerCount) { 
                                var id = triggerCount + 1;
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
                                                section_id: class_id + '-SE' + id
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
        });
    })

// Get Sections by Class
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('class_sections').find({ class_id: class_id, status: 1 }).sort({ name: 1 });
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
                {
                    "$project": {
                        "_id": "$_id",
                        "class_name": "$class_doc.name",
                        "name": "$name",
                        "class_id": "$class_id",
                        "section_id": "$section_id",
                        "employee_id": "$employee_doc.employee_id",
                        "teacher_name": "$employee_doc.first_name",
                        "status": "$status"
                    }
                }
            ]).sort({ name: 1 })
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

// Get Sections by School
router.route('/class_sections/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('class_sections').find({ class_id: class_id, status: 1 }).sort({ name: 1 });
            var cursor = db.collection('class_sections').aggregate([
                {
                    $match: {
                        school_id: school_id,
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
                    "$project": {
                        "_id": "$_id",
                        "class_name": "$class_doc.name",
                        "name": "$name",
                        "class_id": "$class_id",
                        "section_id": "$section_id",
                        "employee_id": "$employee_doc.employee_id",
                        "teacher_name": "$employee_doc.first_name",
                        "status": "$status"
                    }
                }
            ]).sort({ name: 1 })
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

// Get teachers By Section
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
                                        $elemMatch: { section_id: section_id, status: 1 }
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

// Get Section by Id
router.route('/get_section/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_sections').find({
                section_id: section_id,
                status: 1
            });
            cursor.forEach(function (doc, err) {
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray[0]);
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

// Edit Section by Id
router.route('/edit_sections/:section_id')
    .put(function (req, res, next) {

        var myquery = { section_id: req.params.section_id };
        var req_name = req.body.name;
        var req_employee_id = req.body.teacher_name;
        var req_teacher_name = req.body.teacher_name;

        mongo.connect(url, function (err, db) {
            db.collection('class_sections').update(myquery, {
                $set: {
                    name: req_name,
                    employee_id: req_employee_id,
                    teacher_name: req_teacher_name,
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

// Soft Delete Section by Id
router.route('/delete_sections/:section_id')
    .put(function (req, res, next) {
        var myquery = { section_id: req.params.section_id };
        var section_id = req.params.section_id;
        var splited = section_id.split('-');
        var class_id = splited[0] + '-' + splited[1];
        mongo.connect(url, function (err, db) {
            db.collection('class_sections').update(myquery, { $set: { status : 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('students').updateMany(myquery, { $set: { status : 0 } }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('students false');
                        } else {
                            db.collection('teacher_subjects').updateMany({
                                "subjects": { "section_id": section_id }
                            }, {
                                $pull: {
                                    "subjects": { "section_id": section_id }
                                }
                            }, function (err, result) {
                                if(err) {
                                    res.send('false')
                                } else {
                                    db.close();
                                    res.send('true');
                                }
                            })
                        }
                    });
                }
            });
        });
    });

// Hard Delete Section by Id
router.route('/hard_delete_sections/:section_id')
    .delete(function (req, res, next) {
        var myquery = { section_id: req.params.section_id };
        mongo.connect(url, function (err, db) {
            db.collection('class_sections').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    mongo.connect(url, function (err, db) {
                        db.collection('students').deleteMany(myquery, function (err, result) {
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

// Restore Class by Id
router.route('/restore_sections/:section_id')
    .put(function (req, res, next) {
        var myquery = { section_id: req.params.section_id };

        mongo.connect(url, function (err, db) {
            db.collection('class_sections').update(myquery, { $set: { status: 1 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('sections false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('students').updateMany(myquery, { $set: { status: 1 } }, function (err, result) {
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

module.exports = router;
