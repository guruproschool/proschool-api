var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;

router.route('/activities/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var posted_date = new Date();
        var school_id = req.params.school_id;

        var item = {
            activity_id: 'getauto',
            activity: req.body.activity,
            date: req.body.date,
            location: req.body.location,
            posted_date: posted_date,
            school_id: school_id,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'activities', function (err, autoIndex) {
                var collection = db.collection('activities');
                collection.ensureIndex({
                    "activity_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.activity == null) {
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
                                            activity_id: 'ACT-' + autoIndex
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
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('activities').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    activities: resultArray
                });
            });
        });
    });

router.route('/support/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var posted_date = new Date();
        var school_id = req.params.school_id;

        var item = {
            support_id: 'getauto',
            subject: req.body.subject,
            description: req.body.description,
            posted_date: posted_date,
            school_id: school_id,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'support_tickets', function (err, autoIndex) {
                var collection = db.collection('support_tickets');
                collection.ensureIndex({
                    "support_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.subject == null) {
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
                                            support_id: 'ST-' + autoIndex
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
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('support_tickets').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    support_tickets: resultArray
                });
            });
        });
    });

router.route('/incidents/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var posted_date = new Date();
        var school_id = req.params.school_id;

        var item = {
            incident_id: 'getauto',
            incident: req.body.incident,
            date: req.body.date,
            location: req.body.location,
            posted_date: posted_date,
            school_id: school_id,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'incidents', function (err, autoIndex) {
                var collection = db.collection('incidents');
                collection.ensureIndex({
                    "incident_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.incident == null) {
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
                                            incident_id: 'INC-' + autoIndex
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
        var resultArray = [];
        var school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('incidents').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    incidents: resultArray
                });
            });
        });
    });

// router.route('/delete_activities/:activity_id')
//     .delete(function (req, res, next) {
//         var myquery = { activity_id: req.params.activity_id };

//         mongo.connect(url, function (err, db) {
//             db.collection('activities').deleteOne(myquery, function (err, result) {
//                 assert.equal(null, err);
//                 if (err) {
//                     res.send('false');
//                 }
//                 db.close();
//                 res.send('true');
//             });
//         });
//     });

router.route('/delete_activities/:activity_id')
    .put(function (req, res, next) {
        var myquery = { activity_id: req.params.activity_id };
        var req_status = 0;

        mongo.connect(url, function (err, db) {
            db.collection('activities').update(myquery, {
                $set: {
                    status: req_status,
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

// router.route('/delete_support/:support_id')
//     .delete(function (req, res, next) {
//         var myquery = { support_id: req.params.support_id };

//         mongo.connect(url, function (err, db) {
//             db.collection('support_tickets').deleteOne(myquery, function (err, result) {
//                 assert.equal(null, err);
//                 if (err) {
//                     res.send('false');
//                 }
//                 db.close();
//                 res.send('true');
//             });
//         });
//     });

router.route('/delete_support/:support_id')
    .put(function (req, res, next) {
        var myquery = { support_id: req.params.support_id };
        var req_status = 0;

        mongo.connect(url, function (err, db) {
            db.collection('support_tickets').update(myquery, {
                $set: {
                    status: req_status,
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


// router.route('/delete_incidents/:incident_id')
//     .delete(function (req, res, next) {
//         var myquery = { incident_id: req.params.incident_id };

//         mongo.connect(url, function (err, db) {
//             db.collection('incidents').deleteOne(myquery, function (err, result) {
//                 assert.equal(null, err);
//                 if (err) {
//                     res.send('false');
//                 }
//                 db.close();
//                 res.send('true');
//             });
//         });
//     });

router.route('/delete_incidents/:incident_id')
    .put(function (req, res, next) {
        var myquery = { incident_id: req.params.incident_id };
        var req_status = 0;

        mongo.connect(url, function (err, db) {
            db.collection('incidents').update(myquery, {
                $set: {
                    status: req_status,
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