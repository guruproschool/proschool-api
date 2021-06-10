// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Timing

router.route('/session_timings/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var newDate = new Date();
        var startTime = newDate.setHours(req.body.start_time.substring(0, 2), req.body.start_time.substring(3, 5), 0);
        var endTime = newDate.setHours(req.body.end_time.substring(0, 2), req.body.end_time.substring(3, 5), 0);

        var item = {
            session_id: 'getauto',
            school_id: school_id,
            class: req.body.class,
            section: req.body.section,
            session: req.body.session,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            startTime: startTime,
            endTime: endTime,
            status: status,

        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'session_timings', function (err, autoIndex) {
                var collection = db.collection('session_timings');
                collection.ensureIndex({
                    "session_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.session == null) {
                            res.end('null');
                        } else {
                            collection.find({ school_id: school_id }).count(function (err, triggerCount) {
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
                                                session_id: school_id + '-SES' + id
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
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('session_timings').find({ school_id: school_id, status: 1 }).sort({startTime: 1});
            var cursor = db.collection('session_timings').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    },
                },
                {
                    $lookup: {
                        from: "school_classes",
                        localField: "class",
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
                        localField: "section",
                        foreignField: "section_id",
                        as: "section_doc"
                    }
                },
                {
                    $unwind: "$section_doc"
                },
                {
                    $project:
                        {
                            session_id: "$session_id",
                            class_id: "$class_id",
                            class_name: "$class_doc.name",
                            section_id: "$section_id",
                            section_name: "$section_doc.name",
                            session: "$session",
                            start_time: "$start_time",
                            end_time: "$end_time",
                            startTime: "$startTime",
                            endTime: "$endTime"
                        }
                }
            ]).sort({startTime: 1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    session_timings: resultArray
                });
            });
        });
    });

// Get Timings By Section
router.route('/session_timingsBy_section/:section_id')
    .get(function (req, res, next) {
        var section = req.params.section_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('session_timings').find({ section: section, status: 1 }).sort({startTime: 1});
            var cursor = db.collection('session_timings').aggregate([
                {
                    $match: {
                        section: section,
                        status: 1
                    },
                },
                {
                    $lookup: {
                        from: "school_classes",
                        localField: "class",
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
                        localField: "section",
                        foreignField: "section_id",
                        as: "section_doc"
                    }
                },
                {
                    $unwind: "$section_doc"
                },
                {
                    $project:
                        {
                            session_id: "$session_id",
                            class_id: "$class_id",
                            class_name: "$class_doc.name",
                            section_id: "$section_id",
                            section_name: "$section_doc.name",
                            session: "$session",
                            start_time: "$start_time",
                            end_time: "$end_time",
                            startTime: "$startTime",
                            endTime: "$endTime"
                        }
                }
            ]).sort({startTime: 1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                // var newDate = new Date();
                // var startTime = newDate.setHours(doc.start_time.substring(0, 2), doc.start_time.substring(3, 5), 0);
                // var endTime = newDate.setHours(doc.end_time.substring(0, 2), doc.end_time.substring(3, 5), 0);
                // doc.startTime = startTime;
                // doc.endTime = endTime;
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    session_timings: resultArray
                });
            });
        });
    });

// Edit Timing
router.route('/edit_session/:session_id')
    .put(function (req, res, next) {
        var myquery = { session_id: req.params.session_id };
        var session = req.body.session;
        var start_time = req.body.start_time;
        var end_time = req.body.end_time;
        mongo.connect(url, function (err, db) {
            db.collection('session_timings').update(myquery, {
                $set: {
                    session: session,
                    start_time: start_time,
                    end_time: end_time,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('timetable').updateMany(myquery, {
                        $set: {
                            start_time: start_time, 
                            end_time: end_time
                        }
                    }, function (err, result1) {
                        if(err) {
                            res.send('false');
                        } else {
                            db.close();
                            res.send('true');
                        }
                    })
                }
            });
        });
    });

// Delete Timing
router.route('/delete_session/:session_id')
    .put(function (req, res, next) {
        var myquery = { session_id: req.params.session_id };

        mongo.connect(url, function (err, db) {
            db.collection('session_timings').update(myquery, { $set: { status : 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Timing
router.route('/hard_delete_session/:session_id')
    .delete(function (req, res, next) {
        var myquery = { session_id: req.params.session_id };

        mongo.connect(url, function (err, db) {
            db.collection('session_timings').deleteOne(myquery, function (err, result) {
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
