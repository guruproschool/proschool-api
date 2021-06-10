// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var forEach = require('async-foreach').forEach;
var async = require('async');
var router = express.Router();
var url = config.dburl;

// Add ASSESMENTS
router.route('/education_rate/:student_id')
    .post(function(req, res, next) {
        var status = 1;
        var student_id = req.params.student_id;
        subjects = [];
        var item = {
            education_rate_id: 'getauto',
            student_id: student_id,
            rate: 1,
            status: status,
        }
        mongo.connect(url, function(err, db) {
            autoIncrement.getNextSequence(db, 'education_rating', function(err, autoIndex) {
                var collection = db.collection('education_rating');
                collection.ensureIndex({
                    "education_rate_id": 1,
                }, {
                    unique: true
                }, function(err, result) {
                    if (item.student_id == null) {
                        res.end('null');
                    } else {
                        collection.insertOne(item, function(err, result) {
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
                                    education_rate_id: 'EDU-RATE-'+autoIndex
                                },
                                $push: {
                                  subjects
                                }
                            }, function(err, result) {
                                db.close();
                                res.end('true');
                            });
                        });
                    }
                });
            });
        });
    })

    .get(function(req, res, next) {
        var resultArray = [];
        mongo.connect(url, function(err, db) {
            assert.equal(null, err);
            var cursor = db.collection('education_rating').find();
            cursor.forEach(function(doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function() {
                db.close();
                res.send({
                    education_rating: resultArray
                });
            });
        });
    });

router.route('/student_assessment/:student_id/:section_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var section_id = req.params.section_id;
        var student_id = req.params.student_id;
        var assignmentMarks = [];
        var classTestsMarks = [];
        var projectWorksMarks = [];
        var examMarks = [];
        var studentMarks = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionSubjects(next) {
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
                    function getAssignmentMarks(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var subject_name = subjectData.name;
                                db.collection('assignment_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: student_id,
                                            subject_id: subject_id
                                        }
                                    },
                                    {
                                        "$lookup": {
                                            "from": "assignments",
                                            "localField": "assignment_id",
                                            "foreignField": "assignment_id",
                                            "as": "assignments_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$assignments_doc"
                                    },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "subject_name": "$subject_doc.name",
                                            "maxMarks": "$assignments_doc.maxMarks",
                                            "marks": "$marks",
                                            "average_score": "$assignments_doc.average_marks",
                                        }
                                    },
                                ]).toArray(function (err, results) {
                                    console.log(results)
                                    var AtotalMaxMarks = 0;
                                    var AtotalMarks = 0;
                                    var Aaverage = 0;
                                    if (results) {
                                        results.forEach(function (data) {
                                            AtotalMaxMarks += parseInt(data.maxMarks);
                                            AtotalMarks += parseInt(data.marks);
                                            Aaverage += parseInt(data.average_score);
                                        })
                                    }
                                    
                                    if(AtotalMaxMarks === 0) {
                                        var Apercentage = 0;
                                    } else {
                                        var Apercentage = parseInt(((AtotalMarks / AtotalMaxMarks) * 100).toFixed(2));
                                    }
                                    
                                    var total_assignments = results.length;
                                    // if(total_assignments === 0) {
                                    //     var average_score = 0;
                                    // } else {
                                    //     var average_score = Aaverage / total_assignments;
                                    // }
                                    subjectData.assignmentMarks = { AtotalMarks: AtotalMarks, AtotalMaxMarks: AtotalMaxMarks, Apercentage: Apercentage, average_score: Aaverage, total_assignments: total_assignments };
                                    
                                    count++;
                                    if (subjectsResultLength == count) {
                                        next(null, subjectsResult);
                                    }
                                })
                            })
                        }
                    },
                    function getclassTestsMarks(result, next) {
                        var count1 = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var subject_name = subjectData.name;
                                db.collection('CT_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: student_id,
                                            subject_id: subject_id
                                        }
                                    },
                                    {
                                        "$lookup": {
                                            "from": "classTests",
                                            "localField": "classTest_id",
                                            "foreignField": "classTest_id",
                                            "as": "classTest_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$classTest_doc"
                                    },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "subject_name": "$subject_doc.name",
                                            "maxMarks": "$classTest_doc.maxMarks",
                                            "marks": "$marks",
                                            "average_score": "$classTest_doc.average_marks",
                                        }
                                    },
                                ]).toArray(function (err, results) {
                                    //console.log(result2)
                                    var CtotalMaxMarks = 0;
                                    var CtotalMarks = 0;
                                    var Caverage = 0;
                                    if (results) {
                                        results.forEach(function (data) {
                                            CtotalMaxMarks += parseInt(data.maxMarks);
                                            CtotalMarks += parseInt(data.marks);
                                            Caverage += parseInt(data.average_score);
                                        })
                                    }
                                    
                                    if(CtotalMaxMarks === 0) {
                                        var Cpercentage = 0;
                                    } else {
                                        var Cpercentage = parseInt(((CtotalMarks / CtotalMaxMarks) * 100).toFixed(2));
                                    }
                                    
                                    var total_classtests = results.length;
                                    subjectData.classTestsMarks = { CtotalMarks: CtotalMarks, CtotalMaxMarks: CtotalMaxMarks, Cpercentage: Cpercentage, average_score: Caverage, total_classtests: total_classtests }
                                    
                                    count1++;
                                    if (subjectsResultLength == count1) {
                                        next(null, subjectsResult);
                                    }
                                })
                            })
                        }
                    },
                    function getprojectWorksMarks(result, next) {
                        var count2 = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            subjectsResult.forEach(function (subjectData) {
                                var subject_id = subjectData.subject_id;
                                var subject_name = subjectData.name;
                                db.collection('PW_marks').aggregate([
                                    {
                                        $match: {
                                            student_id: student_id,
                                            subject_id: subject_id
                                        }
                                    },
                                    {
                                        "$lookup": {
                                            "from": "projectworks",
                                            "localField": "projectwork_id",
                                            "foreignField": "projectwork_id",
                                            "as": "projectwork_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$projectwork_doc"
                                    },
                                    {
                                        "$lookup": {
                                            "from": "subjects",
                                            "localField": "subject_id",
                                            "foreignField": "subject_id",
                                            "as": "subject_doc"
                                        }
                                    },
                                    {
                                        "$unwind": "$subject_doc"
                                    },
                                    {
                                        "$project": {
                                            "_id": "$_id",
                                            "student_id": "$student_id",
                                            "subject_name": "$subject_doc.name",
                                            "maxMarks": "$projectwork_doc.maxMarks",
                                            "marks": "$marks",
                                            "average_score": "$projectwork_doc.average_marks",
                                        }
                                    },
                                ]).toArray(function (err, results) {
                                    //console.log(result2)
                                    var PtotalMaxMarks = 0;
                                    var PtotalMarks = 0;
                                    var Paverage = 0;
                                    if (results) {
                                        results.forEach(function (data) {
                                            PtotalMaxMarks += parseInt(data.maxMarks);
                                            PtotalMarks += parseInt(data.marks);
                                            Paverage += parseInt(data.average_score);
                                        })
                                    }
                                    
                                    if(PtotalMaxMarks === 0) {
                                        var Ppercentage = 0;
                                    } else {
                                        var Ppercentage = parseInt(((PtotalMarks / PtotalMaxMarks) * 100).toFixed(2));
                                    }
                                    
                                    var total_projectworks = results.length;
                                    subjectData.projectWorksMarks = { PtotalMarks: PtotalMarks, PtotalMaxMarks: PtotalMaxMarks, Ppercentage: Ppercentage, average_score: Paverage, total_projectworks: total_projectworks }
                                    
                                    count2++;
                                    if (subjectsResultLength == count2) {
                                        next(null, subjectsResult);
                                    }
                                })
                            })
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
                            studentassessment: result1
                        });

                    }
                }
            );
        });
    });

router.route('/assessments/:subject_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var subject_id = req.params.subject_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getAssignments(next) {
                        db.collection('assignments').find({
                            subject_id: subject_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            if(result.length > 0) {
                                var assignments = {};
                                assignments.total = result.length;
                                var pending_assignments = 0;
                                var completed_assignments = 0;
                                result.forEach( function(data) {
                                    if(data.submission === 'pending') {
                                        pending_assignments++;
                                    } else if(data.submission === 'completed') {
                                        completed_assignments++;
                                    }
                                })
                                assignments.pending = pending_assignments;
                                assignments.completed = completed_assignments;
                            }
                            next(null, assignments);
                        });
                    },
                    function getClassTests(assignments, next) {
                        db.collection('classTests').find({
                            subject_id: subject_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            if(result.length > 0) {
                                var classTests = {};
                                classTests.total = result.length;
                                var pending_classtests = 0;
                                var completed_classtests = 0;
                                result.forEach( function(data) {
                                    if(data.submission === 'pending') {
                                        pending_classtests++;
                                    } else if(data.submission === 'completed') {
                                        completed_classtests++;
                                    }
                                })
                                classTests.pending = pending_classtests;
                                classTests.completed = completed_classtests;
                            }
                            next(null, assignments, classTests);
                        });
                    },
                    function getProjectworks(assignments, classTests, next) {
                        db.collection('projectworks').find({
                            subject_id: subject_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            if(result.length > 0) {
                                var projectworks = {};
                                projectworks.total = result.length;
                                var pending_projectworks = 0;
                                var completed_projectworks = 0;
                                result.forEach( function(data) {
                                    if(data.submission === 'pending') {
                                        pending_projectworks++;
                                    } else if(data.submission === 'completed') {
                                        completed_projectworks++;
                                    }
                                })
                                projectworks.pending = pending_projectworks;
                                projectworks.completed = completed_projectworks;
                            }
                            next(null, assignments, classTests, projectworks);
                        });
                    },
                ],
                function (err, assignments, classTests, projectworks) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            assignments: assignments, classTests: classTests, projectworks: projectworks
                        });

                    }
                }
            );
        });
    });

router.route('/assignments_submission/:school_id')
    .put(function (req, res, next) {
        school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionSubjects(next) {
                        db.collection('assignments').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getAssignmentMarks(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var assignments = [];
                            subjectsResult.forEach(function (subjectData) {
                                var assignment_id = subjectData.assignment_id;
                                db.collection('assignment_marks').find({
                                    assignment_id: assignment_id
                                }).toArray(function (err, results) {
                                    if (err) {
                                        next(err, null);
                                    }
                                    assignments.push({assignment_id: subjectData.assignment_id, submissions: results.length})
                                    count++;
                                    if (subjectsResultLength == count) {
                                        next(null, assignments);
                                    }
                                });
                            })
                        }
                    },
                    function getAssignmentMarks(assignments, next) {
                        console.log(assignments)
                        var count = 0;
                        var Result = assignments;
                        var ResultLength = assignments.length;
                        if (ResultLength == 0) {
                            next(null, []);
                        } else {
                            Result.forEach(function (subjectData) {
                                var assignment_id = subjectData.assignment_id;
                                console.log(subjectData.submissions)
                                if(subjectData.submissions > 0) {
                             
                                    db.collection('assignments').update({
                                        assignment_id: assignment_id,
                                        status: 1
                                    }, {
                                        $set: {
                                            submission: 'completed',
                                        }
                                    }, function (err, result1) {
                                        console.log('yes')
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                    });
                                }
                                count++;
                                if (ResultLength == count) {
                                    next(null, Result);
                                }
                            })
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

                        res.send('true');

                    }
                }
            );
        });
    });

router.route('/classtests_submission/:school_id')
    .put(function (req, res, next) {
        school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionSubjects(next) {
                        db.collection('classTests').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getAssignmentMarks(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var assignments = [];
                            subjectsResult.forEach(function (subjectData) {
                                var classTest_id = subjectData.classTest_id;
                                db.collection('CT_marks').find({
                                    classTest_id: classTest_id
                                }).toArray(function (err, results) {
                                    if (err) {
                                        next(err, null);
                                    }
                                    assignments.push({classTest_id: subjectData.classTest_id, submissions: results.length})
                                    count++;
                                    if (subjectsResultLength == count) {
                                        next(null, assignments);
                                    }
                                });
                            })
                        }
                    },
                    function getAssignmentMarks(assignments, next) {
                        console.log(assignments)
                        var count = 0;
                        var Result = assignments;
                        var ResultLength = assignments.length;
                        if (ResultLength == 0) {
                            next(null, []);
                        } else {
                            Result.forEach(function (subjectData) {
                                var classTest_id = subjectData.classTest_id;
                                console.log(subjectData.submissions)
                                if(subjectData.submissions > 0) {
                            
                                    db.collection('classTests').update({
                                        classTest_id: classTest_id,
                                        status: 1
                                    }, {
                                        $set: {
                                            submission: 'completed',
                                        }
                                    }, function (err, result1) {
                                        console.log('yes')
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                    });
                                }
                                count++;
                                if (ResultLength == count) {
                                    next(null, Result);
                                }
                            })
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

                        res.send('true');

                    }
                }
            );
        });
    });

router.route('/projectworks_submission/:school_id')
    .put(function (req, res, next) {
        school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSectionSubjects(next) {
                        db.collection('projectworks').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getAssignmentMarks(result, next) {
                        var count = 0;
                        var subjectsResult = result;
                        var subjectsResultLength = result.length;
                        if (subjectsResultLength == 0) {
                            next(null, []);
                        } else {
                            var assignments = [];
                            subjectsResult.forEach(function (subjectData) {
                                var projectwork_id = subjectData.projectwork_id;
                                db.collection('PW_marks').find({
                                    projectwork_id: projectwork_id
                                }).toArray(function (err, results) {
                                    if (err) {
                                        next(err, null);
                                    }
                                    assignments.push({projectwork_id: subjectData.projectwork_id, submissions: results.length})
                                    count++;
                                    if (subjectsResultLength == count) {
                                        next(null, assignments);
                                    }
                                });
                            })
                        }
                    },
                    function getAssignmentMarks(assignments, next) {
                        console.log(assignments)
                        var count = 0;
                        var Result = assignments;
                        var ResultLength = assignments.length;
                        if (ResultLength == 0) {
                            next(null, []);
                        } else {
                            Result.forEach(function (subjectData) {
                                var projectwork_id = subjectData.projectwork_id;
                                console.log(subjectData.submissions)
                                if(subjectData.submissions > 0) {
                            
                                    db.collection('projectworks').update({
                                        projectwork_id: projectwork_id,
                                        status: 1
                                    }, {
                                        $set: {
                                            submission: 'completed',
                                        }
                                    }, function (err, result1) {
                                        console.log('yes')
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                    });
                                }
                                count++;
                                if (ResultLength == count) {
                                    next(null, Result);
                                }
                            })
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

                        res.send('true');

                    }
                }
            );
        });
    });





module.exports = router;
