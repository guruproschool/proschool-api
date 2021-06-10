// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var multer = require('multer');
var forEach = require('async-foreach').forEach;
var async = require('async');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var router = express.Router();
var url = config.dburl;

// Add Lessons

router.route('/course_works/:subject_id')
    .post(function (req, res, next) {

        var status = 1;
        var subject_id = req.params.subject_id;
        // var subject_name = req.params.subject_name;
        var completed_topics = 0;
        var no_of_topics = 0;
        var days = 0;

        var item = {
            lession_id: 'getauto',
            subject_id: subject_id,
            title: req.body.title,
            start_date: '',
            end_date: '',
            days: days,
            completed_topics: completed_topics,
            chapter_code: req.body.chapter_code,
            no_of_topics: no_of_topics,
            lession_status: 'Pending',
            started_date: '',
            completion_date: '',
            description: req.body.description,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'coursework', function (err, autoIndex) {
                var collection = db.collection('coursework');
                collection.ensureIndex({
                    "lession_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.title == null || item.chapter_code == null || item.no_of_topics == null) {
                        res.end('null');
                    } else {
                        collection.find({subject_id: subject_id}).count(function (err, triggerCount) { 
                            var id = triggerCount + 1;
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
                                        lession_id: subject_id + '-LES' + id
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
        var subject_id = req.params.subject_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //  var cursor = db.collection('coursework').find({ subject_id });
            var cursor = db.collection('coursework').aggregate([
                {
                    $match: {
                        'subject_id': subject_id,
                        'status': 1
                    }
                },
                {
                    "$lookup": {
                        "from": "topics",
                        "localField": "lession_id",
                        "foreignField": "lession_id",
                        "as": "topics"
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                if (doc.completed_topics === 0 || doc.no_of_topics === 0) {
                    doc['completion_percentage'] = 0;
                } else {
                    doc['completion_percentage'] = ((doc.completed_topics / doc.no_of_topics) * 100).toFixed(2);
                }
                // var diff_time = (new Date(doc.end_date).getTime() - new Date().getTime());
                // console.log(diff_time)
                // var diff_days = parseInt(diff_time / 86400000);
                // console.log(diff_days)
                // if(isNaN(diff_days)) {
                //     doc.days = 0;
                // } else if(diff_days > 0 && diff_days < 1) {
                //     doc.days = 1;
                // } else {
                //     doc.days = diff_days;
                // }
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    chapters: resultArray
                });
            });
        });
    });

// Get lesson by Id
router.route('/course_details/:lession_id')
    .get(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('coursework').find({ lession_id: lession_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    coursework: resultArray
                });
            });
        });
    });

// Edit lesson
router.route('/edit_course_work/:lession_id')
    .put(function (req, res, next) {
        var myquery = { lession_id: req.params.lession_id };
        var req_title = req.body.title;
        var req_chapter_code = req.body.chapter_code;
        var req_description = req.body.description;

        mongo.connect(url, function (err, db) {
            db.collection('coursework').update(myquery, {
                $set: {
                    title: req_title,
                    chapter_code: req_chapter_code,
                    description: req_description
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

router.route('/update_course_work/:lession_id')
    .put(function (req, res, next) {
        var myquery = { lession_id: req.params.lession_id };
        var status = req.body.status;
        var current_date = new Date();
        var day = current_date.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var month = current_date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var date = year + '-' + month + '-' + day;

        mongo.connect(url, function (err, db) {
            if (status == 'started') {
                db.collection('coursework').update(myquery, {
                    $set: {
                        start_check: true,
                        start_disable: true,
                        end_disable: false,
                        start_lession: true,
                        lession_status: status,
                        started_date: date,
                    }
                }, function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
            } else if (status == 'completed') {
                db.collection('coursework').update(myquery, {
                    $set: {
                        end_check: true,
                        end_disable: true,
                        end_lession: true,
                        lession_status: status,
                        completion_date: date
                    }
                }, function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
            }
        });
    });

// Soft Delete lesson
router.route('/delete_course_work/:lession_id')
    .put(function (req, res, next) {
        var myquery = { lession_id: req.params.lession_id };

        mongo.connect(url, function (err, db) {
            db.collection('coursework').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('assignments').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('assignment_marks').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                    });
                                });
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete lesson
router.route('/hard_delete_course_work/:lession_id')
    .delete(function (req, res, next) {
        var myquery = { lession_id: req.params.lession_id };

        mongo.connect(url, function (err, db) {
            db.collection('coursework').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('assignments').deleteMany(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('assignment_marks').deleteMany(myquery, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                    });
                                });
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Add Topics    
router.route('/topics/:lession_id/:subject_id')
    .post(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var subject_id = req.params.subject_id;

        var item = {
            topic_id: "getauto",
            topic_name: req.body.topic_name,
            lession_id: lession_id,
            subject_id: subject_id,
            topic_status: "Pending",
            status: 1
        }

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function postTopic(next) {
                        autoIncrement.getNextSequence(db, 'topics', function (err, autoIndex) {
                            var collection = db.collection('topics');
                            collection.ensureIndex({
                                "topic_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (lession_id == null || subject_id == null) {
                                    res.end('null');
                                } else {
                                    collection.find({lession_id: lession_id}).count(function (err, triggerCount) { 
                                        var id = triggerCount + 1;
                                        item.topic_id = lession_id + '-TOP' + id;
                                        collection.insertOne(item, function (err, result) {
                                            assert.equal(null, err);
                                            if (err) {
                                                next(err, null);
                                            }
                                            next();
                                        });
                                    })
                                }
                            })
                        })
                    },
                    function Inc_topics(next) {
                        db.collection('coursework').update({ lession_id: lession_id }, {
                            $inc: {
                                no_of_topics: 1,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });

                    },
                ],
                function () {
                    db.close();
                    res.send('true')
                }
            )
        })
    });

// Get Topics
router.route('/topics/:lession_id')
    .get(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('topics').find({
                lession_id: lession_id,
                status: 1
            })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    topics: resultArray
                });
            });
        });
    });

// Update Topic Status
router.route('/topic_status/:lession_id/:topic_id')
    .put(function (req, res, next) {
        var lession_id = req.params.lession_id;
        var topic_id = req.params.topic_id;
        var topic_status = req.body.topic_status;
        if (topic_status == "Completed") {
            var increment = { completed_topics: 1, }
        } else {
            var increment = { completed_topics: -1, }
        }
        var current_date = new Date();
        var day = current_date.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var month = current_date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var date = year + '-' + month + '-' + day;
        var query = { topic_id: topic_id };
        var count = 0;
        var resultArray = [];

        mongo.connect(url, function (err, db) {
            db.collection('topics').update(query, { $set: { topic_status: topic_status } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('topics').find({ lession_id: lession_id, status: 1 }).toArray(function (err, result1) {
                        result1.forEach(function(doc) {
                            if (doc.topic_status === 'Completed') {
                                count++;
                            }
                        })
                        if (count === 0) {
                            var item = {
                                lession_status: 'Pending',
                                started_date: '',
                                completed_topics: count
                            }
                        } else if (count === 1 && result1.length === 1) {
                            var item = {
                               lession_status: 'Completed',
                                started_date: date,
                                completed_topics: count
                            } 
                        } else if(count === 1 && result1.length > 1) {
                            var item = {
                                lession_status: 'In Progress',
                                 started_date: date,
                                 completed_topics: count
                             } 
                        } else if (count > 0 && count < result1.length) {
                           var item = {
                                lession_status: 'In Progress',
                                completed_topics: count
                            }
                        } else if (count === result1.length) {
                            var item = {
                                lession_status: 'Completed',
                                completion_date: date,
                                completed_topics: count
                            }
                        }
                        db.collection('coursework').update(
                            { lession_id: lession_id },
                            {
                                $set: item
                            }, function() {
                                db.close();
                                res.send('true') 
                            }
                        )
                    })
                }
            })
        })
    });

// Edit Topic
router.route('/edit_topic/:topic_id')
    .put(function (req, res, next) {
        var myquery = { topic_id: req.params.topic_id };
        var topic_name = req.body.topic_name;

        mongo.connect(url, function (err, db) {
            db.collection('topics').update(myquery, {
                $set: {
                    topic_name: topic_name,
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

// Soft Delete Topic
router.route('/delete_topic/:lession_id/:topic_id')
    .put(function (req, res, next) {
        var myquery = { topic_id: req.params.topic_id };
        var lession_id = req.params.lession_id;
        var topic_status = req.body.topic_status;
        if (topic_status == "Completed") {
            var increment = -1
        } else {
            var increment = 0
        }

        mongo.connect(url, function (err, db) {
            db.collection('topics').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('coursework').update({ lession_id: lession_id }, { $inc: { no_of_topics: -1, completed_topics: increment } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Topic
router.route('/hard_delete_topic/:lession_id/:topic_id')
    .delete(function (req, res, next) {
        var myquery = { topic_id: req.params.topic_id };
        var lession_id = req.params.lession_id;

        mongo.connect(url, function (err, db) {
            db.collection('topics').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('coursework').update({ lession_id: lession_id }, { $inc: { no_of_topics: -1 } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/chaptersbulk_completed_topics/:subject_id')
    .post(function (req, res, next) {

        var subject_id = req.params.subject_id;

        if (subject_id == null || !req.body.chapters_completed) {
            res.end('null');
        } else {
            var count = 0;
            if (req.body.chapters_completed.length > 0) {
                forEach(req.body.chapters_completed, function (key, value) {

                    var completed_topics = key.completed_topics;
                    var chapter_id = key.chapter_id;
                    mongo.connect(url, function (err, db) {
                        db.collection('coursework').update({ lession_id: chapter_id }, {
                            $set: {
                                completed_topics: completed_topics,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            count++;

                            db.close();
                            if (count == req.body.chapters_completed.length) {
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

// MOdified
// New api of chapter completion result

router.route('/lesson_planner/:school_id')
    .put(function (req, res, next) {
        var count = 0;
        if (req.body.chapters.length > 0) {
            console.log(req.body.chapters)
            forEach(req.body.chapters, function (key, value) {

                var lession_id = key.lession_id;
                var myquery = { lession_id: lession_id };

                var start_date = key.start_date;
                var end_date = key.end_date;
                var start_date_milliSeconds = new Date(start_date).getTime();
                var end_date_milliSeconds = new Date(end_date).getTime();
                // var days = ((end_date_milliSeconds - start_date_milliSeconds) / (1000 * 24 * 60 * 60)) + 1;
                var days = key.days;
                mongo.connect(url, function (err, db) {
                    db.collection('coursework').update(myquery, {
                        $set: {
                            start_date: start_date,
                            end_date: end_date,
                            days: days,
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        }
                        count++;
                        db.close();
                        if (count == req.body.chapters.length) {
                            res.end('true');
                        }
                    });
                });
            })
        } else {
            res.end('false');
        }
    })

router.route('/lesson_planner/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getSectionSubject(next) {
                        db.collection('coursework').find({
                            subject_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSectionSubjectsData(result, next) {
                        var count = 0;
                        var chaptersResult = result;
                        var chaptersResultLength = result.length;
                        var topics = [];
                        if (chaptersResultLength == 0) {
                            next(null, []);
                        } else {
                            chaptersResult.forEach(function (chapterData) {
                                var lession_id = chapterData.lession_id;
                                db.collection('assignments').aggregate([
                                    {
                                        $match: {
                                            section_id: section_id,
                                            subject_id: subject_id,
                                            assign_date: select_date,
                                        },
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
                                        $lookup: {
                                            from: "coursework",
                                            localField: "lession_id",
                                            foreignField: "lession_id",
                                            as: "coursework_doc"
                                        }
                                    },
                                    {
                                        $unwind: "$coursework_doc"
                                    },
                                    {
                                        $project:
                                        {
                                            section_id: "$section_id",
                                            subject_id: "$subject_id",
                                            subject: "$subject_doc.name",
                                            assignment_id: "$assignment_id",
                                            assignment_title: "$assignment_title",
                                            chapter_name: "$coursework_doc.title",
                                            due_date: "$due_date",
                                            description: "$description"
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }

                                    subjectData.assignments = results;

                                    if (subjectsResultLength == count) {

                                        next(null, result);
                                    }

                                })
                            })
                        }
                    },
                    function getSectionSubjectsData(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        var subjects = [];
                        var resultArray = [];
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var assign_date = assign_date;
                                subjectName = subjectData.name;
                                subjectAssignments = subjectData.assignments;
                                var assignments = [];

                                if (subjectAssignments.length > 0) {
                                    for (i = 0; i < subjectAssignments.length; i++) {
                                        assignment_title = subjectAssignments[i].assignment_title;
                                        chapter_name = subjectAssignments[i].chapter_name;
                                        due_date = subjectAssignments[i].due_date;
                                        assignment_id = subjectAssignments[i].assignment_id;
                                        description = subjectAssignments[i].description;
                                        assignments.push({ assignment_id: assignment_id, assignment_title: assignment_title, chapter_name: chapter_name, due_date: due_date, description: description })
                                    }
                                    subjects.push({ subjectName: subjectName, assignments: assignments });
                                }
                                count++;
                                if (count == subjectsResult.length) {
                                    resultArray.push({ subjects: subjects })

                                    next(null, resultArray)
                                }

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

                        res.send({
                            daily_assign: result1
                        });

                    }
                }
            );
        });
    });


router.route('/edit_chapters/:chapter_id')
    .put(function (req, res, next) {
        var myquery = { chapter_id: req.params.chapter_id };
        var req_count = req.body.no_of_completed_classes;
        var req_classes = req.body.classes;
        var req_class_status = (req_count / req_classes) * 100;


        mongo.connect(url, function (err, db) {
            db.collection('chapters').update(myquery, {
                $set: {
                    count: req_count,
                    class_status: req_class_status,
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

// Modified
// Get Chapter Details By LessionId

router.route('/topic_notes/:topic_id')
    .post(function (req, res, next) {
        var topic_id = req.params.topic_id;
        var status = 1;
        subjects = [];
        var item = {
            notes_id: 'getauto',
            topic_id: topic_id,
            file_name: req.body.file_name,
            link_path: req.body.link_path,
            description: req.body.description,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'topic_notes', function (err, autoIndex) {
                var collection = db.collection('topic_notes');
                collection.ensureIndex({
                    "notes_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.file_name == null || item.link_path == null) {
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
                                    notes_id: topic_id + '-NOTES' + autoIndex
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
        var topic_id = req.params.topic_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('topic_notes').find({ topic_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    [topic_id]: resultArray
                });
            });
        });
    });

var storage = multer.diskStorage({ //multers disk storage settings
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

router.route('/bulk_upload_courseworks/:subject_id')
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
                    res.json({ data: result });
                    var test = result;
                    var count = 0;

                    if (test.length > 0) {
                        test.forEach(function (key, value) {

                            var item = {
                                lession_id: 'getauto',
                                subject_id: subject_id,
                                title: key.title,
                                chapter_code: key.chapter_code,
                                no_of_topics: key.no_of_topics,
                                description: key.description,
                                status: status,

                            };
                            mongo.connect(url, function (err, db) {
                                autoIncrement.getNextSequence(db, 'coursework', function (err, autoIndex) {

                                    var collection = db.collection('coursework');
                                    collection.ensureIndex({
                                        "lession_id": 1,
                                    }, {
                                        unique: true
                                    }, function (err, result) {
                                        if (item.subject_id == null || item.title == null) {
                                            res.end('null');
                                        } else {
                                            item.lession_id = subject_id + '-LES-' + autoIndex;
                                            collection.insertOne(item, function (err, result) {
                                                if (err) {
                                                    if (err.code == 11000) {

                                                        res.end('false');
                                                    }
                                                    res.end('false');
                                                }
                                                count++;
                                                db.close();

                                                if (count == test.length) {
                                                    res.end('true');
                                                }


                                            });
                                        }
                                    });

                                });
                            });

                        });


                    } else {
                        res.end('false');
                    }


                });
            } catch (e) {
                res.json({ error_code: 1, err_desc: "Corupted excel file" });
            }
        })
    });

module.exports = router;