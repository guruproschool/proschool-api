// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Class
router.route('/school_classes/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        school_classes = [];
        var item = {
            class_id: 'getauto',
            school_id: school_id,
            name: req.body.name,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'school_classes', function (err, autoIndex) {
                var collection = db.collection('school_classes');
                collection.ensureIndex({
                    "class_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.name == null) {
                        res.end('null');
                    } else {
                        collection.find({school_id: school_id}).count(function (err, triggerCount) { 
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
                                        class_id: school_id + '-CL' + id
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

// Get Classes
router.route('/school_classes/:school_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('school_classes').aggregate([
                {
                    $match: {
                        school_id: school_id
                    }
                },
                {
                    "$lookup": {
                        "from": "class_sections",
                        "localField": "class_id",
                        "foreignField": "class_id",
                        "as": "section_doc"
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "class_id": "$class_id",
                        "name": "$name",
                        "sections": "$section_doc",
                        "status": "$status",
                    }
                }
            ]).sort({name: 1});
            cursor.forEach(function (doc, err) {
                let no_of_sections = doc.sections.filter(data => data.status === 1).length;
                doc.no_of_sections = no_of_sections;
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    school_classes: resultArray
                });
            });
        });
    });

// Get Class by Id
router.route('/get_class/:class_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('school_classes').find({
                class_id: class_id,
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

// Edit Class by Id
router.route('/edit_classes/:class_id')
    .put(function (req, res, next) {

        var myquery = { class_id: req.params.class_id };
        var req_name = req.body.name;

        mongo.connect(url, function (err, db) {
            db.collection('school_classes').update(myquery, {
                $set: {
                    name: req_name,
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

// Soft Delete Class by Id
router.route('/delete_classes/:class_id')
    .put(function (req, res, next) {
        var myquery = { class_id: req.params.class_id };

        mongo.connect(url, function (err, db) {
            db.collection('school_classes').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('class_sections').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('sections false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('students').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('students false');
                                        }
                                        else {
                                            db.collection('teacher_subjects').updateMany({ },
                                                {
                                                    "$pull": {
                                                        "subjects": {
                                                            class_id: req.params.class_id
                                                        }
                                                    },
                                                },
                                            )
                                        }
                                    });
                                });
                            }

                        });
                    });
                    db.close();
                    res.send('true');
                }
            });
        });
    });

// Restore Class by Id
router.route('/restore_classes/:class_id')
    .put(function (req, res, next) {
        var myquery = { class_id: req.params.class_id };

        mongo.connect(url, function (err, db) {
            db.collection('school_classes').update(myquery, { $set: { status: 1 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('class_sections').updateMany(myquery, { $set: { status: 1 } }, function (err, result) {
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

                        });
                    });
                    db.close();
                    res.send('true');
                }
            });
        });
    });

// Hard Delete Class by Id
router.route('/hard_delete_classes/:class_id')
    .delete(function (req, res, next) {
        var myquery = { class_id: req.params.class_id };

        mongo.connect(url, function (err, db) {
            db.collection('school_classes').delete(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('class_sections').deleteMany(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('sections false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('students').deleteMany(myquery, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('students false');
                                        }

                                    });
                                });
                            }

                        });
                    });
                    db.close();
                    res.send('true');
                }
            });
        });
    });


module.exports = router;
