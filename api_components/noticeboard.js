// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Notice board messages

router.route('/noticeboard/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            notice_id: 'getauto',
            school_id: school_id,
            title: req.body.title,
            issuing_Authority: req.body.issuing_Authority,
            body: req.body.body,
            date_of_issue: req.body.date_of_issue,
            pin_status: req.body.pin_status,
            pin_enddate: req.body.pin_enddate,
            status: status
        };
        console.log(item)
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'noticeboard', function (err, autoIndex) {
                var collection = db.collection('noticeboard');
                collection.createIndex({
                    "notice_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.title == null || item.body == null) {
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
                                        notice_id: school_id + '-Notice-' + id
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
        var resultArray = [];
        school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('noticeboard').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    noticeboard: resultArray
                });
            });
        });
    });

router.route('/edit_noticeboard/:announcement_id')
    .put(function (req, res, next) {

        var myquery = { announcement_id: req.params.announcement_id };
        var issuing_Authority = req.body.issuing_Authority;
        var title = req.body.title;
        var body = req.body.body;
        var signatory_name = req.body.signatory_name;
        var date_of_issue = req.body.date_of_issue;

        console.log(myquery)

        mongo.connect(url, function (err, db) {
            db.collection('noticeboard').update(myquery, {
                $set: {
                    issuing_Authority: issuing_Authority,
                    title: title,
                    body: body,
                    signatory_name: signatory_name,
                    date_of_issue: date_of_issue,
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

router.route('/delete_noticeboard/:notice_id')
    .put(function (req, res, next) {
        var myquery = { notice_id: req.params.notice_id };

        mongo.connect(url, function (err, db) {
            db.collection('noticeboard').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/daily_noticeboard/:select_date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').find({ school_id: school_id, date_of_issue: { $gte: select_date }, status: 1 }).sort({ select_date: -1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    noticeboard: resultArray
                });
            });
        });
    });

router.route('/announcements/:role/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var role = req.params.role;
        var school_id = req.params.school_id;

        var item = {
            announcement_id: 'getauto',
            school_id: school_id,
            issuer: role,
            title: req.body.title,
            class_id: req.body.class_id,
            section_id: req.body.section_id,
            priority: req.body.priority,
            date_of_issue: req.body.date_of_issue,
            body: req.body.body,
            issuing_Authority: req.body.issuing_Authority,
            pin_status: req.body.pin_status,
            pin_enddate: req.body.pin_enddate,
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'announcements', function (err, autoIndex) {
                var collection = db.collection('announcements');
                collection.createIndex({
                    "announcement_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.title == null || item.body == null || item.priority == null || item.date_of_issue == null) {
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
                                        announcement_id: school_id + '-ANN' + id
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

router.route('/announcments/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            // var cursor = db.collection('announcements').find({ school_id: school_id, issuer: 'admin', status: 1 }).sort({ date_of_issue: -1 });
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        school_id: school_id, 
                        issuer: 'admin',
                        status: 1
                    }
                },
                {
                    $lookup: {
                        from: "schools",
                        localField: "school_id",
                        foreignField: "school_id",
                        as: "school_doc"
                    }
                },
                {
                    $unwind: "$school_doc"
                },
                {
                    $project:
                        {
                            announcement_id: "$announcement_id",
                            school_id: "$school_id",
                            school_name: "$school_doc.name",
                            title: "$title",
                            issuing_Authority: "$issuing_Authority",
                            body: "$body",
                            date_of_issue: "$date_of_issue",   
                            priority: "$priority",
                            pin_status: "$pin_status",   
                            pin_enddate: "$pin_enddate",                                   
                        }
                }
            ]).sort({ _id: -1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    noticeboard: resultArray
                });
            });
        });
    });

router.route('/sent_announcements/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        employee_id = req.params.employee_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        issuer: employee_id,
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
                        from: "employee",
                        localField: "issuer",
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
                        announcement_id: "$announcement_id",
                        school_id: "$school_id",
                        class_id: "$class_id",
                        class_name: "$class_doc.name",
                        section_id: "$section_id",
                        section_name: "$section_doc.name",
                        title: "$title",
                        priority: "$priority",
                        date_of_issue: "$date_of_issue",
                        issuer: "$issuer",
                        issuing_Authority: "$employee_doc.first_name",
                        signatory_name: "$employee_doc.first_name",
                        body: "$body",
                        pin_status: "$pin_status",
                        pin_enddate: "$pin_enddate",
                    }
                }
            ])
            cursor.sort({ announcement_id: -1 }).forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    announcements: resultArray
                });
            });
        });
    });

router.route('/received_announcements/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        employee_id = req.params.employee_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        issuer: 'admin',
                        status: 1
                    },
                },
                {
                    $project:
                    {
                        announcement_id: "$announcement_id",
                        school_id: "$school_id",
                        class_id: "",
                        class_name: "",
                        section_id: "",
                        section_name: "",
                        title: "$title",
                        priority: "$priority",
                        date_of_issue: "$date_of_issue",
                        issuer: "$issuer",
                        issuing_Authority: "$issuing_Authority",
                        signatory_name: "$signatory_name",
                        body: "$body",
                        pin_status: "$pin_status",
                        pin_enddate: "$pin_enddate",
                    }
                }
            ]).sort({date_of_issue: 1, announcement_id: -1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    announcements: resultArray
                });
            });
        });
    });

router.route('/received_announcements_section/:section_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        section_id = req.params.section_id;
        school_id = req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        section_id: section_id,
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
                        from: "employee",
                        localField: "issuer",
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
                        announcement_id: "$announcement_id",
                        school_id: "$school_id",
                        class_id: "$class_id",
                        class_name: "$class_doc.name",
                        section_id: "$section_id",
                        section_name: "$section_doc.name",
                        title: "$title",
                        priority: "$priority",
                        date_of_issue: "$date_of_issue",
                        issuer: "$issuer",
                        issuer_name: "$employee_doc.first_name",
                        issuing_Authority: "$issuing_Authority",
                        signatory_name: "$signatory_name",
                        body: "$body",
                        pin_status: "$pin_status",
                        pin_enddate: "$pin_enddate",
                    }
                }
            ])
            cursor.sort({ _id: -1 }).forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.collection('announcements').aggregate([
                    {
                        $match: {
                            school_id: school_id,
                            issuer: 'admin',
                            status: 1
                        },
                    },
                    {
                        $project:
                        {
                            announcement_id: "$announcement_id",
                            school_id: "$school_id",
                            class_id: "",
                            class_name: "",
                            section_id: "",
                            section_name: "",
                            title: "$title",
                            priority: "$priority",
                            date_of_issue: "$date_of_issue",
                            issuer: "$issuer",
                            issuer_name: "",
                            issuing_Authority: "$issuing_Authority",
                            signatory_name: "$signatory_name",
                            body: "$body",
                            pin_status: "$pin_status",
                            pin_enddate: "$pin_enddate",
                        }
                    }
                ]).sort({ _id: -1 }).forEach(function (doc1, err) {
                    assert.equal(null, err);
                    resultArray.push(doc1)
                }, function () {
                    db.close();
                    res.send({
                        announcements: resultArray
                    });
                })
            });
        });
    });

router.route('/edit_announcement/:announcement_id')
    .put(function (req, res, next) {

        var myquery = { announcement_id: req.params.announcement_id };
        var title = req.body.title;
        var class_id = req.body.class_id;
        var section_id = req.body.section_id;
        var priority = req.body.priority;
        var date_of_issue = req.body.date_of_issue;
        var body = req.body.body;
        var pin_status = req.body.pin_status;
        var pin_enddate = req.body.pin_enddate;

        mongo.connect(url, function (err, db) {
            db.collection('announcements').update(myquery, {
                $set: {
                    title: title,
                    class_id: class_id,
                    section_id: section_id,
                    priority: priority,
                    date_of_issue: date_of_issue,
                    body: body,
                    pin_status: pin_status,
                    pin_enddate: pin_enddate,
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

router.route('/delete_announcement/:announcement_id')
    .put(function (req, res, next) {
        var myquery = { announcement_id: req.params.announcement_id };

        mongo.connect(url, function (err, db) {
            db.collection('announcements').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/employee_announcements_perDay/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        employee_id = req.params.employee_id;
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
        console.log(current_date)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        issuer: 'admin',
                        date_of_issue: { $gte: current_date },
                        status: 1
                    },
                },
                {
                    $project:
                    {
                        announcement_id: "$announcement_id",
                        school_id: "$school_id",
                        class_id: "",
                        class_name: "",
                        section_id: "",
                        section_name: "",
                        title: "$title",
                        priority: "$priority",
                        date_of_issue: "$date_of_issue",
                        issuer: "$issuer",
                        issuing_Authority: "$issuing_Authority",
                        signatory_name: "$signatory_name",
                        body: "$body",
                        pin_status: "$pin_status",
                        pin_enddate: "$pin_enddate",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    announcements: resultArray
                });
            });
        });
    });

router.route('/student_announcements_perDay/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        section_id = req.params.section_id;
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
        console.log(current_date)
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('announcements').aggregate([
                {
                    $match: {
                        $or: [{ issuer: 'admin' }, { section_id: section_id }],
                        date_of_issue: { $gte: current_date },
                        status: 1
                    },
                },
                {
                    $project:
                    {
                        announcement_id: "$announcement_id",
                        school_id: "$school_id",
                        class_id: "",
                        class_name: "",
                        section_id: "",
                        section_name: "",
                        title: "$title",
                        priority: "$priority",
                        date_of_issue: "$date_of_issue",
                        issuer: "$issuer",
                        issuing_Authority: "$issuing_Authority",
                        signatory_name: "$signatory_name",
                        body: "$body",
                        pin_status: "$pin_status",
                        pin_enddate: "$pin_enddate",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send(resultArray);
            });
        });
    });

router.route('/quote_word/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var date = new Date();
        var item = {
            quote_id: 'getauto',
            quote: req.body.quote,
            quoteWritten: req.body.quoteWritten,
            school_id: school_id,
            word: req.body.word,
            wordWritten: req.body.wordWritten,
            date: date,
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'quote', function (err, autoIndex) {
                var collection = db.collection('quote');
                collection.createIndex({
                    "quote_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    // console.log(item.quote+"  "+item.word);
                    if (item.quote == "" || item.word == "") {
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
                                    quote_id: 'QUOTE-' + autoIndex
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
        school_id = req.params.school_id,
            mongo.connect(url, function (err, db) {
                assert.equal(null, err);
                var cursor = db.collection('quote').find({ school_id: school_id }).sort({ "date": -1 }).limit(1);
                cursor.forEach(function (doc, err) {
                    assert.equal(null, err);
                    resultArray.push(doc);
                }, function () {
                    db.close();
                    res.send({
                        Quotes: resultArray
                    });
                });
            });
    });

module.exports = router;

