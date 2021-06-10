// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

//List parents
router.route('/getparentlist/:schoolid')
    .get(function (req, res, next) {
        var school_id = req.params.schoolid;
        var parents = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('parents').find({ school_id: school_id, status: 1 });
            var cursor = db.collection('parents').aggregate([
                {
                    $match: {
                        school_id: school_id
                    }
                },
                {
                    $unwind: "$students"
                },
                {
                    $lookup: {
                        from: "students",
                        localField: "students.student_id",
                        foreignField: "student_id",
                        as: "student_doc"
                    }
                },
            ]);

            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                parents.push(doc);
            }, function () {
                db.close();
                res.send({
                    parents: parents
                });
            });
        });
    });

//List parents
router.route('/get_parents_by_section_id/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var parents = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            db.collection('students').find({
                section_id: section_id,
                status: 1
            }).sort({"roll_no": 1}).toArray(function (err, results) {
                if(err) {
                    res.send('false')
                } else {
                    if(results.length > 0) {
                        var count = 0;
                        results.forEach(function (result) {
                            var student_id = result.student_id;
                            db.collection('parents').aggregate([
                                {
                                    $match: {
                                        status: 1,
                                        students: { $elemMatch: { student_id: student_id } }
                                    }
                                },
                                {
                                    $project:
                                    {
                                        parent_id: "$parent_id",
                                        school_id: "$school_id",
                                        status: "$status",
                                    }
                                },
                            ]).toArray(function (err, resultt) {
                                console.log(resultt)
                                count++;
                                if(err) {
                                    res.send('false')
                                } else {
                                    if(resultt.length > 0) {
                                        resultt[0].student_id = student_id;
                                        resultt[0].first_name = result.first_name;
                                        resultt[0].last_name = result.last_name;
                                        resultt[0].roll_no = result.roll_no;
                                        resultt[0].parent_name = result.parent_name;
                                        parents.push(resultt[0]);
                                    } else {
                                        parents.push({
                                            _id: '',
                                            student_id: student_id,
                                            first_name: result.first_name,
                                            last_name: result.last_name,
                                            roll_no: result.roll_no,
                                            parent_name: result.parent_name,
                                            parent_id: '',
                                            school_id: result.school_id,
                                            status: result.status,
                                        });
                                    }
                                    if(count === results.length) {
                                        db.close();
                                        res.send({
                                            parents: parents
                                        });
                                    }
                                }
                            })
                        })
                    }
                }
            })
        });
    });

//get Students by parent id
router.route('/getstudentsbyparentid/:parentid')
    .get(function (req, res, next) {
        var parent_id = req.params.parentid;
        var parents = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('parents').find({ parent_id: parent_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                parents.push(doc);
            }, function () {
                db.close();
                res.send({
                    parents: parents
                });
            });
        });
    });

router.route('/addStudentToParent/:parentId/:studentId')
    .put(function (req, res, next) {
        var parent_id = req.params.parentId;
        var student_id = req.params.studentId;
        mongo.connect(url, function (err, db) {
            var collection = db.collection('parents');

            collection.find({
                "parent_id": parent_id,
                "students.student_id": student_id

            }).toArray(function (err, results) {
                if (err) {
                    res.send('false')
                }

                if (results.length == 0) {
                    collection.update({
                        "parent_id": parent_id
                    }, {
                            "$push": {
                                "students": {
                                    student_id: student_id
                                }
                            }
                        },
                        function (err, numAffected) {
                            if (err) {
                                res.send('false')
                            }
                            // console.log(numAffected.result);
                            if (numAffected.result.nModified == 1) {
                                res.send('true')
                            } else {
                                res.send('false')
                            }
                        });
                } else {
                    res.send('false')
                }
            });


        });
    });


router.route('/removeStudentFromParent/:parentId/:studentId')
    .put(function (req, res, next) {
        var parent_id = req.params.parentId;
        var student_id = req.params.studentId;


        mongo.connect(url, function (err, db) {
            var collection = db.collection('parents');

            collection.update({
                "parent_id": parent_id
            }, {
                    "$pull": {
                        "students": {
                            student_id: student_id

                        }
                    }
                },
                function (err, numAffected) {
                    // console.log(numAffected);
                    if (err) {
                        res.send('false')
                    }
                    if (numAffected) {
                        if (numAffected.result.nModified == 1) {
                            db.close();
                            res.send('true')
                        } else {
                            db.close();
                            res.send('false')

                        }

                    }
                });

        });
    });

router.route('/dailyClasses_section_id/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var status = 1;
        var resultArray = [];
        var sectionsList = [];
        employee = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSections(next) {
                        var cursor = db.collection('subjects').aggregate([
                            {
                                $match: {
                                    section_id: section_id
                                }
                            },
                            { $unwind: '$subjects' },
                            {
                                "$lookup": {
                                    "from": "class_sections",
                                    "localField": "subjects.section_id",
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
                                    "localField": "subjects.class_id",
                                    "foreignField": "class_id",
                                    "as": "class_doc"
                                }
                            },
                            {
                                "$unwind": "$class_doc"
                            },
                            {
                                "$project": {
                                    "section_id": "$subjects.section_id",
                                    "section_name": "$sections_doc.name",
                                    "class_id": "$subjects.class_id",
                                    "class_name": "$class_doc.name",
                                }
                            }
                        ]);
                        cursor.sort({ section_id: 1 }).toArray(function (err, result) {
                            console.log(result)
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getclasses(result, next) {
                        var count = 0;
                        var sectionsResult = result;
                        var sectionsResultLength = result.length;
                        console.log(sectionsResult)
                        if (sectionsResultLength == 0) {
                            next(null, []);
                        } else {
                            var newArray = [];
                            var lookupObject = {};

                            for (var i in sectionsResult) {
                                lookupObject[sectionsResult[i]["section_id"]] = sectionsResult[i];
                            }

                            for (i in lookupObject) {
                                newArray.push(lookupObject[i]);
                            }
                            next(null, newArray)
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
                            class_sections: result1
                        });

                    }
                }
            )
        });
    });

module.exports = router;
