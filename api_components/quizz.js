// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Schools
router.route('/questions/:lession_id/:subject_id')
    .post(function (req, res, next) {
        var status = 1;
        var lession_id = req.params.lession_id;
        var subject_id = req.params.subject_id;
        var splited = lession_id.split("-");
        var school_id = splited[0];
        var class_id = splited[0] + '-' + splited[1];

        // var options = [req.body.option_1, req.body.option_2, req.body.option_3, req.body.option_4]

        options = [
            { option: req.body.option_1},
            { option: req.body.option_2},
            { option: req.body.option_3},
            { option: req.body.option_4}
        ]
          
        var item = {
            question_id: 'getauto',            
            school_id: school_id,
            class_id: class_id,
            question: req.body.question,
            subject_id: subject_id,
            lession_id: lession_id,
            options: options,
            answer: req.body.answer,
            status: status,
        };       

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'questions', function (err, autoIndex) {
                var collection = db.collection('questions');
                collection.ensureIndex({
                    "question_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.answer == null || item.answer == "" || item.question == null || item.question == "" || options == "undefined" || item.answer == "undefined" || item.question == "undefined" || item.subject_id == null) {
                            res.end('false');
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
                                            question_id: class_id + '-QUST-' + autoIndex
                                        },
                                        $push: {
                                            options
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

router.route('/questions/:lession_id/:subject_id')
    .get(function (req, res, next) {
        var subject_id = req.params.subject_id;
        var lession_id = req.params.lession_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            //  var cursor = db.collection('questions').find({ "subject_id":subject_id,"class_id":class_id });
            var cursor = db.collection('questions').aggregate([
                {
                    $match: {
                        subject_id: subject_id,
                        lession_id: lession_id
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
                        as: "chapter_doc"
                    }
                },
                {
                    $unwind: "$chapter_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "class_Name": "$class_doc.name",
                        "subject_name": "$subject_doc.name",
                        "question": "$question",
                        "lession_id": "$lession_id",
                        "answer": "$answer",
                        "options": "$options",
                        "question_id": "$question_id",
                        "class_id": "$class_id",
                        "chapter": "$chapter_doc.title",
                        "subject_id": "$subject_id"
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    questions: resultArray
                });
            });
        });
    });


router.route('/Quizz_question/:student_id/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var student_id = req.params.student_id;
        var school_id = req.params.school_id;
        var question_id = req.body.question_id;
        var submitted_answer = req.body.submitted_answer;

        var questions = {};
        var item = {
            quizz_id: 'getauto',
            student_id: student_id,
            question_id: question_id,
            submitted_answer: submitted_answer,
            school_id: school_id,
            status: status,
        };
        questions.question_id = question_id;

        mongo.connect(url, function (err, db) {

            autoIncrement.getNextSequence(db, 'Quizz', function (err, autoIndex) {
                var data = db.collection('questions').find({ question_id });
                data.forEach(function (doc, err) {
                    if (doc.answer == submitted_answer) {
                        result = "yes";
                    }
                    else {
                        result = "no";
                    }
                    questions.result = result;

                    var collection = db.collection('Quizz');
                    collection.ensureIndex({
                        "quizz_id": 1,
                    }, {
                            unique: true
                        }, function (err, result) {
                            if (item.question_id == null || item.submitted_answer == null) {
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
                                                quizz_id: 'QUIZZ-' + autoIndex
                                            },
                                            $push: {
                                                questions
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
        });
    })
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('Quizz').find({ student_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    Quizz: resultArray
                });
            });
        });
    });


router.route('/delete_quizz/:quizz_id')
    .delete(function (req, res, next) {
        var myquery = { quizz_id: req.params.quizz_id };
        mongo.connect(url, function (err, db) {
            db.collection('quizz').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });



router.route('/edit_question/:question_id')
    .put(function (req, res, next) {
        var myquery = { question_id: req.params.question_id };
        var question = req.body.question;
        var answer = req.body.answer;

        // var options = {
        option1 = req.body.option1;
        option2 = req.body.option2;
        option3 = req.body.option3;
        option4 = req.body.option4;
        // }

        mongo.connect(url, function (err, db) {
            db.collection('questions').update(myquery, {
                $set: {
                    question: question,
                    answer: answer,
                    options: [{ option_1: option1, option_2: option2, option_3: option3, option_4: option4 }]
                }
                // $push: {
                //     options
                // }
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


router.route('/delete_question/:question_id')
    .delete(function (req, res, next) {
        var myquery = { question_id: req.params.question_id };
        mongo.connect(url, function (err, db) {
            db.collection('questions').deleteOne(myquery, function (err, result) {
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
