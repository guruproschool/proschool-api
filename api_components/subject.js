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

// Add Subjects
router.route('/subjects/:section_id')
    .post(function (req, res, next) {
        var status = 1;
        var section_id = req.params.section_id;
        subjects = [];
        var item = {
            subject_id: 'getauto',
            section_id: section_id,
            name: req.body.name,
            textbook: req.body.textbook,
            author: req.body.author,
            publisher: req.body.publisher,
            status: status,
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'subjects', function (err, autoIndex) {
                var collection = db.collection('subjects');
                collection.ensureIndex({
                    "subject_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.name == null) {
                        res.end('null');
                    } else {
                        collection.find({ section_id: section_id }).count(function (err, triggerCount) {
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
                                        subject_id: section_id + '-SUB' + id
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
        var section_id = req.params.section_id;
        var current_time = new Date().getTime();

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getClassSubjects(next) {

                        db.collection('subjects').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSubjectChapters(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                db.collection('coursework').find({
                                    subject_id: subject_id,
                                    status: 1
                                }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    subjectData.no_of_completed_chapters = 0;
                                    if (results.length > 0) {
                                        subjectData.no_of_chapters = results.length;
                                        var ongoing_chapters = [];
                                        var pending_chapters = [];
                                        var completed_chapters = [];
                                        var upcoming_chapters = [];
                                        results.forEach(function (ChapterData) {
                                            if (ChapterData.lession_status === "completed") {
                                                subjectData.completed_chapters++;
                                            }
                                            var start_time = new Date(ChapterData.start_date).getTime();
                                            var end_time = new Date(ChapterData.end_date).getTime();

                                            if (current_time > start_time && current_time < end_time) {
                                                ongoing_chapters.push({ lession_id: ChapterData.lession_id, title: ChapterData.title, chapter_code: ChapterData.chapter_code })
                                            } else if (current_time > end_time && ChapterData.lession_status === 'pending') {
                                                pending_chapters.push({ lession_id: ChapterData.lession_id, title: ChapterData.title, chapter_code: ChapterData.chapter_code })
                                            } else if (current_time > end_time && ChapterData.lession_status === 'completed') {
                                                completed_chapters.push({ lession_id: ChapterData.lession_id, title: ChapterData.title, chapter_code: ChapterData.chapter_code })
                                            } else if (current_time < start_time && ChapterData.lession_status === 'pending') {
                                                upcoming_chapters.push({ lession_id: ChapterData.lession_id, title: ChapterData.title, chapter_code: ChapterData.chapter_code })
                                            }

                                            subjectData.ongoing_chapters = ongoing_chapters;
                                            subjectData.pending_chapters = pending_chapters;
                                            subjectData.completed_chapters = completed_chapters;
                                            subjectData.upcoming_chapters = upcoming_chapters;
                                        })
                                    } else {
                                        subjectData.no_of_chapters = 0;
                                    }

                                    if (subjectsResultLength == count) {

                                        next(null, subjectsResult);
                                    }

                                })
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

                        res.send({ subjects: result1 });

                    }
                }
            )
        });
    });

// Get Subject by Id
router.route('/get_subject_name/:subject_id')
    .get(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('subjects').aggregate([
                { $match: { subject_id: subject_id, status: 1 } },
                {
                    $group: {
                        _id: '$subject_id',
                        subject_names: { $push: '$name' }
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

// Edit Subject by id
router.route('/edit_subjects/:subject_id')
    .put(function (req, res, next) {
        var myquery = { subject_id: req.params.subject_id };
        var req_name = req.body.name;
        var req_book = req.body.textbook;
        var req_author = req.body.author;
        var req_publisher = req.body.publisher

        mongo.connect(url, function (err, db) {
            db.collection('subjects').update(myquery, { $set: { name: req_name, textbook: req_book, author: req_author, publisher: req_publisher } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Soft Delete Subject by Id
router.route('/delete_subjects/:subject_id')
    .put(function (req, res, next) {
        var myquery = { subject_id: req.params.subject_id };

        mongo.connect(url, function (err, db) {
            db.collection('subjects').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('coursework').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
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
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Subject by Id
router.route('/hard_delete_subjects/:subject_id')
    .delete(function (req, res, next) {
        var myquery = { subject_id: req.params.subject_id };

        mongo.connect(url, function (err, db) {
            db.collection('subjects').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('coursework').deleteMany(myquery, function (err, result) {
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
                        });
                    });
                }
                db.close();
                res.send('true');
            });
        });
    });

// Assign Subjects to Teachers
router.route('/assign_subjects/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            teacher_subject_id: 'getauto',
            school_id: school_id,
            teacher_id: req.body.employee_id,
            status: status,
        };
        var subjects = {
            subject_id: req.body.subject_id,
            subject_name: req.body.subject_name
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'teacher_subjects', function (err, autoIndex) {
                var collection = db.collection('teacher_subjects');
                collection.find({
                    teacher_id: item.teacher_id,
                    school_id: school_id,
                    status: 1
                }).count(function (e, triggerCount) {
                    console.log(triggerCount)
                    if (triggerCount == 0) {
                        collection.ensureIndex({
                            "teacher_subject_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.school_id == null || item.teacher_id == null || subjects.subject_name == null) {
                                res.end('null');
                            } else {
                                collection.find({ school_id: school_id }).count(function (err, triggerCount) {
                                    var id = triggerCount + 1;
                                    item.teacher_subject_id = school_id + '-TE' + id;
                                    collection.insertOne(item, function (err, result) {
                                        if (err) {
                                            if (err.code == 11000) {
                                                console.log(err.code)
                                                res.end('false');
                                            }
                                            res.end('false');
                                        }
                                        collection.update({
                                            _id: item._id
                                        }, {
                                            $push: {
                                                subjects
                                            }
                                        }, function (err, result) {
                                            db.close();
                                            res.end('true');
                                        });
                                    });
                                })
                            }
                        });
                    } else if (triggerCount > 0) {
                        if (subjects.subject_id == null || subjects.subject_name == null) {
                            res.end('null');
                        } else {
                            collection.update({
                                teacher_id: item.teacher_id
                            }, {
                                $push: {
                                    subjects
                                }
                            }, function (err, result) {
                                db.close();
                                res.end('true');
                            });
                        }
                    }
                })

            });
        });
    })

// Get Assigned Subjects to Teachers
router.route('/listsubjectstoteacher_by_sectionId/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var status = 1;
        var subjectsList = teachers = [];

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getEmployees(next) {
                        //   console.log("getSubjects");
                        db.collection('subjects').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getteachersList(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var cursor = db.collection('teacher_subjects').aggregate([
                                    {
                                        $match: {
                                            'subjects': {
                                                $elemMatch: { subject_id: subject_id }
                                            }

                                        }
                                    },
                                    { $unwind: '$subjects' },
                                    {
                                        $match: {
                                            'subjects.subject_id': subject_id
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
                                            "teacher_name": "$teacher_doc.first_name",
                                        }
                                    }
                                ]).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    subjectData.teachers = results
                                    // console.log(studentData.fee);

                                    if (subjectsResultLength == count) {

                                        next(null, subjectsResult);
                                        // next(null, classData);
                                    }

                                })
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
                            teachers: result1
                        });

                    }
                }
            )
        });
    });

// Delete Assigned Subject to Teacher
router.route('/delete_subject_teacher/:teacher_id/:subject_id')
    .put(function (req, res, next) {
        var teacher_id = req.params.teacher_id;
        var subject_id = req.params.subject_id;
        //  var myquery = { bus_route_id: bus_route_id },{ stations: { $elemMatch: { station_name: station_name } } }

        mongo.connect(url, function (err, db) {
            //  var data = db.collection('bus_routes').find({bus_route_id});
            db.collection('teacher_subjects').update({ teacher_id: teacher_id },
                { $pull: { subjects: { teacher_id: teacher_id, subject_id: subject_id } } }, function (err, numAffected) {
                    if (numAffected.result.nModified == 1) {
                        db.close();
                        res.send('true')
                    } else {
                        db.close();
                        res.send('false')
                    }
                });
        });
    });


router.route('/subject_edit/:subject_id/:name/:value')
    .post(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('subjects').update({ subject_id }, {
                $set: {
                    [name]: value
                }
            }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
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

router.route('/all_subjects_of_chapters_completed_topics/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var chaptersObject = [];
        var subjectsObject = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSubjects(next) {
                        //   console.log("getSubjects");
                        db.collection('subjects').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getChaptersData(result, next) {
                        //   console.log("getChaptersData");                      
                        var count = 0;
                        var subjectResult = result;
                        var subjectResultLength = result.length;
                        if (subjectResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            subjectResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                // console.log(subject_id);
                                db.collection('coursework').find({
                                    subject_id
                                }).sort({ name: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    subjectData.chapters = results
                                    // console.log(subjectData.chapters);

                                    if (subjectResultLength == count) {

                                        next(null, subjectResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    }, function getchaptersTopicsData(result, next) {
                        //  console.log(result);
                        var count = 0;
                        var subjectResult = result;
                        var subjectDataLength = result.length;
                        //  console.log(classData.sections);
                        if (subjectDataLength == 0) {
                            next(null, []);
                        } else {
                            // console.log("In fourth step sections attendance")
                            subjectResult.forEach(function (subjectData) {
                                subjectChapters = [];
                                // attendenceClass = [];

                                var chaptersCount = 0;
                                var subjectName = subjectData.name;
                                var subjectsData = subjectData;
                                var subject_id = subjectData.subject_id;

                                subjectChapters = subjectData.chapters;
                                //  console.log(subject_id);
                                //  console.log(subjectData.chapters +"hema"+ chaptersCount);
                                chaptersObject = [];
                                for (i = 0; i < subjectChapters.length; i++) {
                                    var chapterName = subjectChapters[i].title;
                                    var no_of_topics = subjectChapters[i].no_of_topics;
                                    // console.log(subjectChapters[i]);
                                    var completed_topics = subjectChapters[i].completed_topics;
                                    var remaining_topics = no_of_topics - completed_topics;
                                    var percent = completed_topics * 100 / no_of_topics;
                                    var remaining_percent = remaining_topics * 100 / no_of_topics;
                                    var chapter_code = subjectChapters[i].chapter_code;
                                    chaptersObject.push({ "chapterName": chapterName, "no_of_topics": no_of_topics, "completed_topics": completed_topics, "percent": percent });

                                }
                                subjectsObject.push({ "subjectName": subjectName, "chapters": chaptersObject })

                                count++;

                                if (subjectDataLength == count) {
                                    next(null, subjectsObject);
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
                            subjects: result1
                        });

                    }
                }
            );
        });
    });

module.exports = router;