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
// var AWS = require('aws-sdk');

// function sendSMS(ToNum, msg, callback) {
//     AWS.config.update({
//         accessKeyId: 'AKIAJ4AYEOQIXGRN7SYA',
//         secretAccessKey: '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',
//         region: 'us-west-2'
//     });

//     var sns = new AWS.SNS();

//     var phoneNum = '+91' + ToNum;
//     var params = {
//         Message: msg,
//         MessageStructure: 'string',
//         PhoneNumber: phoneNum
//     };


//     console.log(params);
//     sns.publish(params, function (err, data) {
//         if (err) {
//             console.log(err, err.stack); // an error occurred

//             callback(null, "failed");
//         } else {
//             console.log(data);           // successful response
//             callback(null, "SUCCESS");
//         }
//     });
// }

// Add Fee Types
router.route('/fee_types/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var item = {
            fee_types_id: 'getauto',
            fee_type: req.body.fee_type,
            school_id: school_id,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'fee_type', function (err, autoIndex) {
                var collection = db.collection('fee_type');
                collection.ensureIndex({
                    "fee_types_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.fee_type == null || item.fee_type == "undefined" || item.fee_type == "") {
                        res.end('null');
                    } else {
                        collection.find({ school_id: school_id }).count(function (err, triggerCount) {
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
                                        fee_types_id: school_id + '-FeeType' + id
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
            var cursor = db.collection('fee_type').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    fee_type: resultArray
                });
            });
        });
    });

// Edit Fee Types
router.route('/edit_fee_types/:fee_types_id')
    .put(function (req, res, next) {
        var myquery = { fee_types_id: req.params.fee_types_id };
        var req_fee_type = req.body.fee_type;

        mongo.connect(url, function (err, db) {
            db.collection('fee_type').update(myquery, {
                $set: {
                    fee_type: req_fee_type,
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

// Soft Delete for Fee Types
router.route('/delete_fee_types/:fee_types_id')
    .put(function (req, res, next) {
        var myquery = { fee_types_id: req.params.fee_types_id };

        mongo.connect(url, function (err, db) {
            db.collection('fee_type').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('class_fee').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('fee_structure').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                        else {
                                            mongo.connect(url, function (err, db) {
                                                db.collection('studentFee').updateMany(myquery, { $set: { status: 0 } }, function (err, result) {
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

// Hard Delete for Fee Types
router.route('/hard_delete_fee_types/:fee_types_id')
    .delete(function (req, res, next) {
        var myquery = { fee_types_id: req.params.fee_types_id };

        mongo.connect(url, function (err, db) {
            db.collection('fee_type').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('class_fee').deleteMany(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('fee_structure').deleteMany(myquery, function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        }
                                        else {
                                            mongo.connect(url, function (err, db) {
                                                db.collection('studentFee').deleteMany(myquery, function (err, result) {
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

// Add Class Fee
router.route('/class_fee/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var class_id = req.body.class_id;
        var fee_types_id = req.body.fee_types_id;
        var fee_type = req.body.fee_type;
        var total_fee = req.body.total_fee;

        var item = {
            class_fee_id: 'getauto',
            school_id: school_id,
            class_id: class_id,
            fee_types_id: fee_types_id,
            total_fee: total_fee,
            status: status,
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'class_fee', function (err, autoIndex) {
                var collection = db.collection('class_fee');
                collection.ensureIndex({
                    "class_fee_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.fee_types_id == null || item.fee_types_id == "" || item.total_fee == null || item.total_fee == "") {
                        res.end('null');
                    } else {
                        collection.find({ class_id: req.body.class_id }).count(function (err, triggerCount) {
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
                                        class_fee_id: req.body.class_id + '-ClassFee' + id
                                    }
                                }, function (err, result) {
                                    if(err) {
                                        res.send('false')
                                    } else {
                                        db.collection('students').find({
                                            class_id: req.body.class_id,
                                        }).toArray(function (err, results) {
                                            if(err) {
                                                res.send('false')
                                            } else {
                                                if(results.length > 0) {
                                                    var count = 0;
                                                    results.forEach(function (doc) {
                                                        var student_id = doc.student_id;
                                                        var section_id = doc.section_id;
                                                        var item = {
                                                            studentFee_id: '',
                                                            student_id: student_id,
                                                            school_id: school_id,
                                                            class_id: class_id,
                                                            section_id: section_id,
                                                            fee_types_id: fee_types_id,
                                                            fee_type: fee_type,
                                                            total_fee: parseInt(total_fee),
                                                            paid_fee: 0,
                                                            discount: 0,
                                                            installment_type: 'none',
                                                            payments: [],
                                                            fee: 'general',
                                                            status: 1
                                                        }
                                                        autoIncrement.getNextSequence(db, 'studentFee', function (err, autoIndex) {
                                                            var collection = db.collection('studentFee');
                                                            collection.ensureIndex({
                                                                "studentFee_id": 1,
                                                            }, {
                                                                unique: true
                                                            }, function (err, result) {
                                                                if (item.total_fee == null) {
                                                                    res.end('null');
                                                                } else {
                                                                    item.studentFee_id = school_id + '-STDFEE-' + autoIndex;
                                                                    console.log(item)
                                                                    collection.insertOne(item, function (err, result) {
                                                                        count++;
                                                                        if (err) {
                                                                            if (err.code == 11000) {
                                                                                console.log(err);
                                                                                res.end('false');
                                                                            }
                                                                            res.end('false');
                                                                        } else {
                                                                            if (count === results.length) {
                                                                                db.close();
                                                                                res.end('true');
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        });
                                                    })
                                                } else {
                                                    db.close();
                                                    res.send('true');
                                                }
                                            }
                                        })
                                    }
                                });
                            });
                        })
                    }
                });
            });
        });
    })

router.route('/class_fee/:class_id')
    .get(function (req, res, next) {

        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('class_fee').aggregate([
                {
                    $match: {
                        class_id: class_id,
                    }
                },
                {
                    "$lookup": {
                        "from": "fee_type",
                        "localField": "fee_types_id",
                        "foreignField": "fee_types_id",
                        "as": "fee_type_doc"
                    }
                },
                {
                    "$unwind": "$fee_type_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "class_fee_id": "$class_fee_id",
                        "class_id": "$class_id",
                        "fee_types_id": "$fee_types_id",
                        "fee_type": "$fee_type_doc.fee_type",
                        "total_fee": "$total_fee",
                        "status": "$status"
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    class_fee: resultArray
                });
            });
        });
    });

// Edit Class Fee
router.route('/edit_class_fee/:class_fee_id')
    .put(function (req, res, next) {
        var myquery = { class_fee_id: req.params.class_fee_id };
        var req_total_fee = req.body.total_fee;
        var class_id = req.body.class_id;
        var fee_types_id = req.body.fee_types_id;

        mongo.connect(url, function (err, db) {
            db.collection('class_fee').update(myquery, {
                $set: {
                    total_fee: req_total_fee,
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('students').find({
                        class_id: class_id,
                    }).toArray(function (err, results) {
                        if(err) {
                            res.send('false')
                        } else {
                            if(results.length > 0) {
                                var count = 0;
                                results.forEach(function (doc) {
                                    var student_id = doc.student_id;
                                    db.collection('studentFee').find({
                                        student_id: student_id,
                                        fee_types_id: fee_types_id,
                                    }).toArray(function (err, result1) {
                                        if(err) {
                                            res.send('false')
                                        } else {
                                            count++;
                                            if(result1.length > 0) {
                                                db.collection('studentFee').update({
                                                    student_id: student_id,
                                                    fee_types_id: fee_types_id,
                                                }, {
                                                    $set: {
                                                        total_fee: parseInt(req_total_fee)
                                                    }
                                                })
                                            } else {
                                                var item = {
                                                    studentFee_id: '',
                                                    student_id: student_id,
                                                    school_id: doc.school_id,
                                                    class_id: doc.class_id,
                                                    section_id: doc.section_id,
                                                    fee_types_id: fee_types_id,
                                                    fee_type: fee_type,
                                                    total_fee: parseInt(req_total_fee),
                                                    paid_fee: 0,
                                                    discount: 0,
                                                    installment_type: 'none',
                                                    payments: [],
                                                    fee: 'general',
                                                    status: 1
                                                }
                                                autoIncrement.getNextSequence(db, 'studentFee', function (err, autoIndex) {
                                                    var collection = db.collection('studentFee');
                                                    collection.ensureIndex({
                                                        "studentFee_id": 1,
                                                    }, {
                                                        unique: true
                                                    }, function (err, result) {
                                                        if (item.total_fee == null) {
                                                            res.end('null');
                                                        } else {
                                                            item.studentFee_id = school_id + '-STDFEE-' + autoIndex;
                                                            collection.insertOne(item, function (err, result) {
                                                                if (err) {
                                                                    if (err.code == 11000) {
                                                                        console.log(err);
                                                                        res.end('false');
                                                                    }
                                                                    res.end('false');
                                                                }
                                                            });
                                                        }
                                                    });
                                                });
                                            }
                                            if (count === results.length) {
                                                db.close();
                                                res.send('true');
                                            }
                                        }
                                    })
                                })
                            } else {
                                db.close();
                                res.send('true');
                            }
                        }
                    })
                }
            });
        });
    });

// Soft Delete Class Fee
router.route('/delete_class_fee/:class_fee_id')
    .put(function (req, res, next) {
        var myquery = { class_fee_id: req.params.class_fee_id };

        mongo.connect(url, function (err, db) {
            db.collection('class_fee').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    db.collection('class_fee').find({
                        class_fee_id: req.params.class_fee_id
                    }).toArray(function (err, results) {
                        if(err) {
                            res.end('false')
                        } else {
                            console.log(results)
                            var fee_type_id = results[0].fee_types_id;
                            var class_id = results[0].fee_types_id;
                            db.collection('fee_structure').updateMany({
                                fee_type_id: fee_type_id, 
                                class_id: class_id
                            }, 
                            { $set: 
                                { status: 0 } 
                            }, 
                            function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    res.send('false');
                                }
                                else {
                                    db.collection('studentFee').updateMany({
                                        fee_type_id: fee_type_id, 
                                        class_id: class_id
                                    }, 
                                    { $set: 
                                        { status: 0 } 
                                    }, 
                                    function (err, result) {
                                        assert.equal(null, err);
                                        if (err) {
                                            res.send('false');
                                        } else {
                                            db.close();
                                            res.send('true');
                                        }
                                    });
                                }
                            });
                        }
                    })
                }
            });
        });
    });

// Hard Delete Class Fee
router.route('/hard_delete_class_fee/:class_fee_id')
    .delete(function (req, res, next) {
        var myquery = { class_fee_id: req.params.class_fee_id };

        mongo.connect(url, function (err, db) {
            db.collection('class_fee').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('fee_structure').deleteMany(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                mongo.connect(url, function (err, db) {
                                    db.collection('studentFee').deleteMany(myquery, function (err, result) {
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

// Restore Class Fee
router.route('/restore_class_fee/:class_fee_id')
.put(function (req, res, next) {
    var myquery = { class_fee_id: req.params.class_fee_id };

    mongo.connect(url, function (err, db) {
        db.collection('class_fee').update(myquery, { $set: { status: 1 } }, function (err, result) {
            assert.equal(null, err);
            if (err) {
                res.send('false');
            }
            else {
                db.collection('class_fee').find({
                    class_fee_id: req.params.class_fee_id
                }).toArray(function (err, results) {
                    if(err) {
                        res.end('false')
                    } else {
                        console.log(results)
                        var fee_type_id = results[0].fee_types_id;
                        var class_id = results[0].fee_types_id;
                        db.collection('fee_structure').updateMany({
                            fee_type_id: fee_type_id, 
                            class_id: class_id
                        }, 
                        { $set: 
                            { status: 1 } 
                        }, 
                        function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            else {
                                db.collection('studentFee').updateMany({
                                    fee_type_id: fee_type_id, 
                                    class_id: class_id
                                }, 
                                { $set: 
                                    { status: 1 } 
                                }, 
                                function (err, result) {
                                    assert.equal(null, err);
                                    if (err) {
                                        res.send('false');
                                    } else {
                                        db.close();
                                        res.send('true');
                                    }
                                });
                            }
                        });
                    }
                })
            }
        });
    });
});

// Add Fee Structure
router.route('/fee_structure/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        if (req.body.discount === '' || req.body.discount === undefined) {
            req.body.discount = 0;
        }
        var item = {
            fee_structure_id: 'getauto',
            class_id: req.body.class_id,
            fee_types_id: req.body.fee_types_id,
            installment_type: req.body.installment_type,
            payment_instalment: req.body.payment_instalment,
            fee_amount: parseInt(req.body.fee_amount),
            discount: parseInt(req.body.discount),
            due_date: req.body.due_date,
            status: status,
        }
        console.log(req.body.discount)
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'fee_structure', function (err, autoIndex) {
                var collection = db.collection('fee_structure');
                collection.ensureIndex({
                    "fee_structure_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.payment_instalment == null || item.payment_instalment == "" || item.fee_amount == null || item.fee_amount == "") {
                        res.end('null');
                    } else {
                        collection.find({ class_id: req.body.class_id }).count(function (err, triggerCount) {
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
                                        fee_structure_id: req.body.class_id + '-FEEST' + id
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

router.route('/class_Feestructure/:class_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('fee_structure').aggregate([
                {
                    $match: {
                        class_id: class_id,
                        status: 1
                    }
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "fee_structure_id": "$fee_structure_id",
                        "class_id": "$class_id",
                        "installment_type": "$installment_type",
                        "payment_instalment": "$payment_instalment",
                        "fee_amount": "$fee_amount",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    feestructure: resultArray
                });
            });
        });
    });

router.route('/fee_structure/:installment_type/:class_id/:fee_types_id')
    .get(function (req, res, next) {
        var class_id = req.params.class_id;
        var fee_types_id = req.params.fee_types_id;
        var installment_type = req.params.installment_type;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('fee_structure').aggregate([
                {
                    $match: {
                        class_id: class_id,
                        fee_types_id: fee_types_id,
                        installment_type: installment_type,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "fee_type",
                        "localField": "fee_types_id",
                        "foreignField": "fee_types_id",
                        "as": "fee_type_doc"
                    }
                },
                {
                    "$unwind": "$fee_type_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "fee_structure_id": "$fee_structure_id",
                        "class_id": "$class_id",
                        "fee_types_id": "$fee_types_id",
                        "fee_type": "$fee_type_doc.fee_type",
                        "installment_type": "$installment_type",
                        "payment_instalment": "$payment_instalment",
                        "fee_amount": "$fee_amount",
                        "discount": "$discount",
                        "due_date": "$due_date",
                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    feestructure: resultArray
                });
            });
        });
    });

router.route('/fee_structure/:student_id/:class_id/:installment_type/:fee_types_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var class_id = req.params.class_id;
        var installment_type = req.params.installment_type;
        var fee_types_id = req.params.fee_types_id;
        var resultArray = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getClassFee(next) {
                        var totalFee = 0;
                        var discount = 0;
                        var cursor = db.collection('fee_structure').find({
                            installment_type: installment_type,
                            fee_types_id: fee_types_id,
                            class_id: class_id
                        })
                        cursor.toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function getStudentFee(results, next) {
                        if (results.length > 0) {
                            db.collection('studentFee').find({
                                student_id: student_id,
                                fee_types_id: fee_types_id,
                                installment_type: installment_type,
                                status: 1,
                            }).toArray(function (err, result) {
                                if (err) {
                                    next(err, null);
                                }
                                next(null, results, result);
                                console.log(result)
                            });
                        } else {
                            next(null, [], [])
                        }
                    },
                    function getStudentFee(results, result, next) {
                        if (results.length === 0 || result.length === 0) {
                            console.log('Hello-1')
                            next(null, [])
                        } else {
                            var ClassFee = results;
                            var ClassFeeLength = results.length;
                            var studentFee = result;
                            var FeePayments = result[0].payments;
                            var count = 0;
                            ClassFee.forEach(function (fee) {
                                var fee_structure_id = fee.fee_structure_id;
                                fee.payments = [];
                                fee.fee_paid = 0;
                                count++;
                                FeePayments.forEach(function (pay) {
                                    if (fee_structure_id === pay.fee_structure_id) {
                                        fee.payments.push(pay);
                                        fee.fee_paid += pay.fee_paid;
                                    }
                                })
                                fee.balance_fee = (parseInt(fee.fee_amount) - parseInt(fee.fee_paid) - parseInt(fee.discount))
                                if (count === ClassFeeLength) {
                                    console.log('Hello-2')
                                    next(null, ClassFee)
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
                        res.send({
                            StudentFeeDetails: result1
                        });
                    }
                }
            );
        });
    });

// Edit for Fee Structure
router.route('/edit_fee_structure/:fee_structure_id')
    .put(function (req, res, next) {
        var myquery = { fee_structure_id: req.params.fee_structure_id };
        var req_fee_amount = req.body.fee_amount;
        var req_discount = req.body.discount;
        var req_due_date = req.body.due_date;
        console.log(req.body)

        mongo.connect(url, function (err, db) {
            db.collection('fee_structure').update(myquery, {
                $set: {
                    fee_amount: req_fee_amount,
                    discount: req_discount,
                    due_date: req_due_date,
                },
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('fee_structure').find({
                        fee_types_id: req.body.fee_types_id,
                        class_id: req.body.class_id,
                        installment_type: req.body.installment_type,
                        status: 1
                    }).toArray( function (err, results) {
                        if(err) {
                            res.send('false')
                        } else {
                            console.log(results)
                            var discount = 0;
                            results.forEach(function (res1) {
                                discount += res1.discount;
                            });
                            console.log(discount)
                            db.collection('studentFee').updateMany({
                                class_id: req.body.class_id,
                                fee_types_id: req.body.fee_types_id,
                                installment_type: req.body.installment_type,
                            }, {
                                $set: {
                                    discount: discount
                                }
                            }, function(err, result) {
                                if (err) {
                                    res.send('false');
                                } else {
                                    db.close();
                                    res.send('true');
                                }
                            })
                        }
                    })
                }
            });
        });
    });

// Soft Delete Fee Structure
router.route('/delete_fee_structure/:fee_structure_id')
    .put(function (req, res, next) {
        var myquery = { fee_structure_id: req.params.fee_structure_id };

        mongo.connect(url, function (err, db) {
            db.collection('fee_structure').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.collection('fee_structure').find(myquery).toArray(function (err, result1) {
                        if(err) {
                            res.send('false')
                        } else {
                            var class_id = result1[0].class_id;
                            var fee_types_id = result1[0].fee_types_id;
                            var installment_type = result1[0].installment_type;
                            db.collection('studentFee').updateMany({
                                class_id: class_id,
                                fee_types_id: fee_types_id,
                                installment_type: installment_type
                            }, {
                                $set: {
                                    discount: 0
                                }
                            }, function (err, resultt) {
                                if(err) {
                                    res.send('false')
                                } else {
                                    db.close();
                                    res.send('true');
                                }
                            })
                        }
                    })
                }
            });
        });
    });

// Hard Delete Fee Structure
router.route('/hard_delete_fee_structure/:fee_structure_id')
    .delete(function (req, res, next) {
        var myquery = { fee_structure_id: req.params.fee_structure_id };

        mongo.connect(url, function (err, db) {
            db.collection('fee_structure_id').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Student Payment Mode
router.route('/student_fee/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var student_id = req.body.student_id;
        if(req.body.fee === 'special') {
            var installment_type = 'One Time';
        } else {
            var installment_type = 'none';
        }
        var item = {
            studentFee_id: 'getauto',
            student_id: student_id,
            school_id: school_id,
            class_id: req.body.class_id,
            section_id: req.body.section_id,
            fee_types_id: req.body.fee_types_id,
            fee_type: req.body.fee_type,
            total_fee: parseInt(req.body.total_fee),
            paid_fee: 0,
            discount: parseInt(req.body.discount),
            installment_type: installment_type,
            payments: [],
            fee: req.body.fee,
            status: 1
        }

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'studentFee', function (err, autoIndex) {
                var collection = db.collection('studentFee');
                collection.ensureIndex({
                    "studentFee_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.fee_types_id == null || item.fee_types_id == "") {
                        res.end('null');
                    } else {
                        collection.find({ student_id: student_id }).count(function (err, triggerCount) {
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
                                        studentFee_id: req.body.student_id + '-FEE' + id
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

router.route('/edit_studentFee/:studentFee_id')
    .put(function (req, res, next) {

        var fee_types_id = req.body.fee_types_id;
        var class_id = req.body.class_id;
        var req_discount = req.body.discount;
        var req_installment_type = req.body.installment_type;

        var myquery = { studentFee_id: req.params.studentFee_id };

        mongo.connect(url, function (err, db) {
            db.collection('studentFee').find({
                studentFee_id: req.params.studentFee_id
            }).toArray(function (err, result1) {
                if(err) {
                    res.send('false');
                } else {
                    if(result1.length > 0) {
                        var installment_type = result1[0].installment_type;
                        if(installment_type === req_installment_type) {
                            db.collection('studentFee').update(myquery,
                                {
                                    $set: {
                                        discount: req_discount,
                                    }
                                },
                                function (err, result) {
                                    assert.equal(null, err);
                                    if (err) {
                                        res.send('false');
                                    } else {
                                        db.close();
                                        res.send('true');
                                    }
                            });
                        } else {
                            db.collection('fee_structure').find({
                                installment_type: req_installment_type, 
                                fee_types_id: fee_types_id,
                                class_id: class_id,
                                status: 1
                            }).toArray(function (err, results) {
                                if(err) {
                                    res.send('false')
                                } else {
                                    if(results.length > 0) {
                                        var discount = 0;
                                        results.forEach(function (doc) {
                                            discount += doc.discount;
                                        })
                                        console.log(discount)
                                        db.collection('studentFee').update(myquery,
                                            {
                                                $set: {
                                                    discount: discount,
                                                    installment_type: req_installment_type
                                                }
                                            },
                                            function (err, result) {
                                                assert.equal(null, err);
                                                if (err) {
                                                    res.send('false');
                                                } else {
                                                    db.close();
                                                    res.send('true');
                                                }
                                        });
                                    } else {
                                        db.close();
                                        res.send({data: 'Fee Structure Not Found'});
                                    }
                                }
                            })
                        }
                    }
                }
            })
        });
    })

router.route('/delete_studentFee/:studentFee_id')
    .put(function (req, res, next) {

        var myquery = { studentFee_id: req.params.studentFee_id };

        mongo.connect(url, function (err, db) {
            db.collection('studentFee').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.send('true');
                }
            });
        });

    })

router.route('/hard_delete_studentFee/:studentFee_id')
    .delete(function (req, res, next) {

        var myquery = { studentFee_id: req.params.studentFee_id };

        mongo.connect(url, function (err, db) {
            db.collection('fee_structure').delete(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.send('true');
                }
            });
        });

    })

router.route('/restore_studentFee/:studentFee_id')
    .put(function (req, res, next) {

        var myquery = { studentFee_id: req.params.studentFee_id };

        mongo.connect(url, function (err, db) {
            db.collection('studentFee').update(myquery, { $set: { status: 1 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else {
                    db.close();
                    res.send('true');
                }
            });
        });

    })

router.route('/student_paymentMode/:student_id/:school_id')
    .put(function (req, res, next) {
        var myquery = { student_id: req.params.student_id };
        var student_id = req.params.student_id;
        var school_id = req.params.school_id;

        var installment_type = req.body.installment_type;
        var phone = req.body.phone;
        var email = req.body.email;
        var class_id = req.body.class_id;
        var section_id = req.body.section_id;
        var results = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function putStudentPayment(next) {
                        db.collection('students').update(myquery, {
                            $set: {
                                payment_mode: installment_type,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            next(null, result)
                        })
                    },
                    function getClassFee(result, next) {
                        db.collection('class_fee').aggregate([
                            {
                                $match: {
                                    class_id: class_id,
                                    status: 1
                                },
                            },
                            {
                                "$lookup": {
                                    "from": "fee_type",
                                    "localField": "fee_types_id",
                                    "foreignField": "fee_types_id",
                                    "as": "fee_types_doc"
                                }
                            },
                            {
                                "$unwind": "$fee_types_doc"
                            },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "class_fee_id": "$class_fee_id",
                                    "fee_types_id": "$fee_types_id",
                                    "fee_type": "$fee_types_doc.fee_type",
                                    "total_fee": "$total_fee",
                                }
                            }
                        ]).toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function putStudentFee(result1, next) {
                        var cursor = db.collection('studentFee').find({
                            student_id: student_id,
                            status: 1
                        });
                        cursor.toArray(function (err, results) {
                            if (err) {
                                res.send('false')
                            }
                            if (results.length == 0) {
                                var count = 0;
                                result1.forEach(function (doc) {
                                    db.collection('fee_structure').find({
                                        fee_types_id: doc.fee_types_id,
                                        installment_type: installment_type,
                                        class_id: class_id,
                                        status: 1
                                    }).toArray(function (err, resultt) {
                                        if (err) {
                                            res.send('false')
                                        } else {
                                            var discount = 0;
                                            resultt.forEach(function (res1) {
                                                discount += res1.discount;
                                            })
                                            var item = {
                                                studentFee_id: '',
                                                student_id: student_id,
                                                school_id: school_id,
                                                class_id: class_id,
                                                section_id: section_id,
                                                fee_types_id: doc.fee_types_id,
                                                fee_type: doc.fee_type,
                                                total_fee: parseInt(doc.total_fee),
                                                paid_fee: 0,
                                                discount: discount,
                                                installment_type: installment_type,
                                                payments: [],
                                                fee: 'general',
                                                status: 1
                                            }
                                            console.log(item)
                                            autoIncrement.getNextSequence(db, 'studentFee', function (err, autoIndex) {
                                                var collection = db.collection('studentFee');
                                                collection.ensureIndex({
                                                    "studentFee_id": 1,
                                                }, {
                                                    unique: true
                                                }, function (err, result) {
                                                    if (item.total_fee == null) {
                                                        res.end('null');
                                                    } else {
                                                        item.studentFee_id = school_id + '-STDFEE-' + autoIndex;
                                                        collection.insertOne(item, function (err, result) {
                                                            if (err) {
                                                                if (err.code == 11000) {
                                                                    console.log(err);
                                                                    res.end('false');
                                                                }
                                                                res.end('false');
                                                            }
                                                        });
                                                        count++;
                                                        if (count === result1.length) {
                                                            next(null, 'true')
                                                        }
                                                    }
                                                });
                                            });
                                        }
                                    })
                                })
                            } else if (results.length > 0) {
                                var count = 0;
                                results.forEach(function (res1) {
                                    var fee_types_id = res1.fee_types_id;
                                    db.collection('fee_structure').find({
                                        fee_types_id: fee_types_id,
                                        installment_type: installment_type,
                                        class_id: class_id,
                                        status: 1
                                    }).toArray(function (err, resultt) {
                                        if (err) {
                                            res.send('false')
                                        } else {
                                            var discount = 0;
                                            resultt.forEach(function (res1) {
                                                discount += res1.discount;
                                            })
                                            db.collection('studentFee').updateMany({
                                                student_id: req.params.student_id,
                                                fee_types_id: fee_types_id
                                            }, {
                                                $set: {
                                                    installment_type: installment_type,
                                                    discount: discount,
                                                    "payments.$.Score": -8
                                                },
                                            }, function (err, result) {
                                                count++;
                                                assert.equal(null, err);
                                                if (err) {
                                                    res.send('false');
                                                } else {
                                                    if (count === results.length) {
                                                        next(null, 'true')
                                                    }
                                                }
                                            })
                                        }
                                    })
                                })
                            }
                        })
                    }
                ],
                function (err, result2) {
                    db.close();
                    if (err) {
                        res.send({ error: err });
                    } else {
                        res.send(result2);
                    }
                }
            )
        });
    });

router.route('/modify_paymentMode/:studentFee_id')
    .put(function (req, res, next) {

        var fee_types_id = req.body.fee_types_id;
        var class_id = req.body.class_id;
        var installment_type = req.body.installment_type;

        mongo.connect(url, function (err, db) {
            db.collection('fees').find({
                fee_types_id: fee_types_id,
                class_id: class_id,
                installment_type: installment_type,
                status: 1
            }).toArray(function (err, results) {
                if (err) {
                    res.send('false')
                } else {
                    if(results.length > 0) {
                        var discount = 0;
                        results.forEach(function (result) {
                            discount += result.discount;
                        })
                        db.collection('studentFee').update({
                            studentFee_id: req.params.studentFee_id
                        },
                        {
                            $set: {
                                installment_type: installment_type,
                                discount: discount
                            }
                        },
                        function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            }
                            db.close();
                            res.send('true');
                        });
                    } else {
                        db.close();
                        res.send({data: 'Fee Structure not Available'});
                    }
                }
            })
        });
    })

// Fee Collection
router.route('/fee_collection/:student_id')
    .post(function (req, res, next) {
        var status = 1;
        var student_id = req.params.student_id;
        var fee_types_id = req.body.fee_types_id;
        var fee_structure_id = req.body.fee_structure_id;
        var myquery = { student_id: student_id, status: 1 }
        current_date = new Date();
        var month = current_date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var day = current_date.getDate();
        if (day < 10) {
            day = '0' + day;
        }
        var year = current_date.getFullYear();
        var payment_date = year + '-' + month + '-' + day;

        var item = {
            pay_receipt_id: 'getauto',
            fee_structure_id: fee_structure_id,
            fee_paid: parseInt(req.body.fee_paid),
            installment: req.body.installment,
            payment_date: payment_date,
            payment_mode: req.body.payment_mode,
            payment_status: 'received',
            status: status,
        }
        mongo.connect(url, function (err, db) {
            var cursor = db.collection('studentFee').find({
                student_id: student_id,
                fee_types_id: fee_types_id,
                status: 1
            }).toArray(function (err, result1) {
                if (result1.length > 0) {
                    var index = (result1[0].payments.length + 1);
                } else {
                    var index = 1;
                }
                console.log(result1)
                item.pay_receipt_id = result1[0].studentFee_id + '-' + 'PAY' + index;
                db.collection('studentFee').update(
                    { student_id: student_id, fee_types_id: fee_types_id, status: 1 },
                    {
                        $push: {
                            "payments": item,
                        },
                        $inc: {
                            paid_fee: item.fee_paid
                        }
                    }, function (err, result) {
                        assert.equal(null, err);
                        if (err) {
                            res.send('false');
                        }
                        db.close();
                        res.send('true');
                    }
                );
            })
        });
    })

router.route('/delete_collectedFee/:studentFee_id')
    .put(function (req, res, next) {

        var myquery = { studentFee_id: req.params.studentFee_id };
        var pay_receipt_id = req.body.pay_receipt_id;
        var totalpaid = req.body.totalpaid;
        var deletepaid = req.body.deletepaid;

        var new_paid = (parseInt(totalpaid) - parseInt(deletepaid));

        mongo.connect(url, function (err, db) {
            db.collection('studentFee').update(
                myquery,
                {
                    "$pull": {
                        "payments": {
                            pay_receipt_id: pay_receipt_id

                        }
                    },
                    $set: {
                        paid_fee: new_paid
                    }
                },
                function (err, result) {
                    assert.equal(null, err);
                    if (err) {
                        res.send('false');
                    }
                    db.close();
                    res.send('true');
                });
        });

    })

router.route('/student_typewise_fee_details/:student_id/:fee_types_id/:class_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var class_id = req.params.class_id;
        var student_id = req.params.student_id;
        var fee_types_id = req.params.fee_types_id;
        if (fee_types_id === 'all') {
            var query = { class_id: class_id, status: 1 }
        } else {
            var query = { class_id: class_id, fee_types_id: fee_types_id, status: 1 }
        }
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getClassFee(next) {
                        var totalFee = 0;
                        var cursor = db.collection('class_fee').find(query)
                        cursor.forEach(function (doc, err) {
                            totalFee += parseInt(doc.total_fee)
                            next(null, totalFee);
                        })
                    },
                    function getSchoolTermFee(totalFee, next) {
                        console.log(totalFee)
                        db.collection('studentFee').find({
                            student_id: student_id,
                            status: 1,
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            if (result.length == 0) {
                                feeDetails.push({ totalFee: totalFee, totalStudentFee: 0, totalBalanceFee: 0, totalDiscount: 0, totalFine: 0, payment_mode: '' })
                                next(null, feeDetails);
                            } else {
                                var totalStudentFee = 0;
                                if (fee_types_id === 'all') {
                                    var feePayments = result[0].payments;
                                } else {
                                    var feePayments = result[0].payments.filter(data => data.fee_types_id === fee_types_id);
                                }

                                feePayments.forEach(function (feeData) {
                                    totalStudentFee += feeData.fee_paid;
                                })

                                var totalBalanceFee = (parseInt(totalFee) - parseInt(totalStudentFee));

                                feeDetails.push({ totalFee: totalFee, totalStudentFee: totalStudentFee, totalBalanceFee: totalBalanceFee, totalDiscount: 0, totalFine: 0, payment_mode: result[0].payment_mode })
                            }
                            next(null, feeDetails);
                        });
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
                            StudentFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_installment_fee_details/:student_id/:fee_types_id/:installment/:class_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var installment = req.params.installment;
        var student_id = req.params.student_id;
        var class_id = req.params.class_id;
        var fee_types_id = req.params.fee_types_id;

        var query = { class_id: class_id, fee_types_id: fee_types_id, payment_instalment: installment, status: 1 }

        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getClassFee(next) {
                        var totalFee = 0;
                        var discount = 0;
                        var cursor = db.collection('fee_structure').find(query)
                        cursor.toArray(function (err, results) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, results);
                        });
                    },
                    function getSchoolTermFee(results, next) {
                        var totalFee = results[0].fee_amount;
                        var totalDiscount = results[0].discount;
                        db.collection('studentFee').find({
                            student_id: student_id,
                            fee_types_id: fee_types_id,
                            status: 1,
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            if (result.length == 0) {
                                feeDetails.push({ totalFee: totalFee, totalStudentFee: 0, totalBalanceFee: totalFee, totalDiscount: totalDiscount, totalFine: 0, payment_mode: '' })
                                next(null, feeDetails);
                            } else {
                                var totalStudentFee = 0;
                                var feePayments = result[0].payments.filter(data => data.installment === installment);

                                feePayments.forEach(function (feeData) {
                                    totalStudentFee += feeData.fee_paid;
                                })

                                var totalBalanceFee = (parseInt(totalFee) - parseInt(totalStudentFee) - parseInt(totalDiscount));

                                feeDetails.push({ totalFee: totalFee, totalStudentFee: totalStudentFee, totalBalanceFee: totalBalanceFee, totalDiscount: totalDiscount, totalFine: 0, installment_type: result[0].installment_type })
                            }
                            next(null, feeDetails);
                        });
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
                            StudentFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/sectionFee_collection/:section_id')
    .get(function (req, res, next) {
        var section_id = req.params.section_id;
        var resultArray = [];
        var totalFee = 0;
        var paidFee = 0;
        var balanceFee = 0;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('studentFee').find({ section_id: section_id, status: 1 });
            cursor.forEach(function (doc, err) {
                console.log(doc)
                doc.balance_fee = (parseInt(doc.total_fee) - parseInt(doc.paid_fee));
                totalFee += parseInt(doc.total_fee);
                paidFee += parseInt(doc.paid_fee);
                balanceFee += (parseInt(doc.total_fee) - parseInt(doc.paid_fee));
                assert.equal(null, err);
            }, function () {
                if (totalFee === 0) {
                    var paidPercent = 0;
                    var balancePercent = 0;
                    var totalPercent = 0;
                } else {
                    var paidPercent = parseFloat(((paidFee / totalFee) * 100).toFixed(2));
                    var balancePercent = (100 - paidPercent);
                    var totalPercent = 100;
                }
                db.close();
                res.send({
                    totalFee: totalFee, paidFee: paidFee, balanceFee: balanceFee, totalPercent: totalPercent, paidPercent: paidPercent, balancePercent: balancePercent
                });
            });
        });
    });

router.route('/fee_collection/:student_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            db.collection('studentFee').find({
                student_id: student_id,
            }).toArray(function (err, results) {
                if (err) {
                    res.send('false')
                } else {
                    results.forEach(function (result) {
                        result.balance_fee = (parseInt(result.total_fee) - parseInt(result.paid_fee) - parseInt(result.discount));
                    })
                    db.close();
                    res.send({ StudentFeeDetails: results });
                }
            })
        });
    });

router.route('/student_FeeCollection/:student_id')
    .get(function (req, res, next) {
        var student_id = req.params.student_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            async.waterfall(
                [
                    function getStudentFee(next) {
                        db.collection('studentFee').find({ student_id: student_id, status: 1 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getSubjects(result, next) {
                        var StudentResult = result;
                        var StudentResultLength = result.length;
                        if (StudentResultLength === 0) {
                            next(null, [])
                        } else {
                            var count = 0;
                            StudentResult.forEach(function (studentData) {
                                var class_id = studentData.class_id;
                                var fee_types_id = studentData.fee_types_id;
                                var installment_type = studentData.installment_type;
                                db.collection('fee_structure').find({
                                    class_id: class_id,
                                    fee_types_id: fee_types_id,
                                    installment_type: installment_type,
                                    status: 1
                                }).toArray(function (err, result1) {
                                    count++;
                                    if (result1.length > 0) {
                                        var discount = 0;
                                        result1.forEach(function (res) {
                                            discount += res.discount
                                        })
                                        studentData.discount = discount;
                                    } else {
                                        studentData.discount = 0;
                                    }
                                    studentData.balance_fee = (parseInt(studentData.total_fee) - parseInt(studentData.paid_fee) - parseInt(studentData.discount));
                                    studentData.total_fee = parseInt(studentData.total_fee);
                                    delete studentData.payments;
                                    if (StudentResultLength === count) {
                                        next(null, StudentResult)
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
                        res.send({ StudentFeeDetails: result1 });

                    }
                }
            )
        });
    });

router.route('/fee_by_Date/:select_date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);

            var cursor = db.collection('student_fee').aggregate([
                {
                    $match: {
                        current_date: select_date,
                        school_id: school_id
                    },
                },
                {
                    $lookup: {
                        from: "fee_type",
                        localField: "fee_types_id",
                        foreignField: "fee_types_id",
                        as: "fee_doc"
                    }
                },
                {
                    $unwind: "$fee_doc"
                },
                {
                    $lookup: {
                        from: "fee_term",
                        localField: "fee_term_id",
                        foreignField: "fee_term_id",
                        as: "fee_term_doc"
                    }
                },
                {
                    $unwind: "$fee_term_doc"
                },
                {
                    $lookup: {
                        from: "students",
                        localField: "student_id",
                        foreignField: "student_id",
                        as: "student_doc"
                    }
                },
                {
                    $unwind: "$student_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_Name": "$student_doc.first_name",
                        "student_last": "$student_doc.last_name",
                        "section_id": "$student_doc.section_id",
                        "student_id": "$student_id",
                        "fee_types_id": "$fee_types_id",
                        "fee_type": "$fee_doc.fee_type",
                        "fee_term_id": "$fee_term_id",
                        "fee_term": "$fee_term_doc.fee_term",
                        "payment_mode": "$payment_mode",
                        "discount": "$discount",
                        "fine": "$fine",
                        "current_date": "$current_date",
                        "total_fee": "$total_fee",
                        "fee_paid": "$fee_paid",
                        "fee_category": "$feetype.fee_category",

                    }
                }
            ])
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                var feePaid = 0;
                for (i = 0; i < resultArray.length; i++) {
                    feePaid += parseInt(resultArray[i].fee_paid);
                }
                db.close();
                res.send({
                    fee: resultArray,
                    feePaid: feePaid
                });
            });

        });
    });

router.route('/fee_by_Month/:select_month/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_month = parseInt(req.params.select_month);

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('student_fee').aggregate([
                {
                    $match: {
                        school_id: school_id
                    },
                },
                {
                    "$redact": {
                        "$cond": [
                            { "$eq": [{ "$month": "$current_date" }, select_month] },
                            "$$KEEP",
                            "$$PRUNE"
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "fee_type",
                        localField: "fee_types_id",
                        foreignField: "fee_types_id",
                        as: "fee_doc"
                    }
                },
                {
                    $unwind: "$fee_doc"
                },
                {
                    $lookup: {
                        from: "fee_term",
                        localField: "fee_term_id",
                        foreignField: "fee_term_id",
                        as: "fee_term_doc"
                    }
                },
                {
                    $unwind: "$fee_term_doc"
                },
                {
                    $lookup: {
                        from: "students",
                        localField: "student_id",
                        foreignField: "student_id",
                        as: "student_doc"
                    }
                },
                {
                    $unwind: "$student_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "student_Name": "$student_doc.first_name",
                        "student_last": "$student_doc.last_name",
                        "section_id": "$student_doc.section_id",
                        "student_id": "$student_id",
                        "fee_types_id": "$fee_types_id",
                        "fee_type": "$fee_doc.fee_type",
                        "fee_term_id": "$fee_term_id",
                        "fee_term": "$fee_term_doc.fee_term",
                        "payment_mode": "$payment_mode",
                        "discount": "$discount",
                        "fine": "$fine",
                        "current_date": "$current_date",
                        "total_fee": "$total_fee",
                        "fee_paid": "$fee_paid",

                    }
                }
            ]).sort({ _id: -1 })
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                var feePaid = 0;
                for (i = 0; i < resultArray.length; i++) {
                    feePaid += parseInt(resultArray[i].fee_paid);
                }
                db.close();
                res.send({
                    fee: resultArray,
                    feePaid: feePaid
                });
            });

        });
    });

router.route('/totalFee_collection/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var totalClassFee = 0;
        var paidFees = 0;
        var balanceFees;
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolClassed(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('school_classes').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassStudents(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                db.collection('students').find({
                                    class_id: class_id,
                                    status: 1
                                }).sort({ name: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        classData.studentsCount = results.length
                                    } else {
                                        classData.studentsCount = 0;
                                    }
                                    if (classResultLength == count) {
                                        next(null, classResult);
                                    }
                                })
                            })
                        }
                    },
                    function getClassFeeData(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                classData.totalFees = 0;
                                var studentsCount = classData.studentsCount;
                                db.collection('class_fee').find({
                                    class_id: class_id,
                                    status: 1
                                }).sort({ name: 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        results.forEach(function (data) {
                                            totalClassFee += (parseInt(data.total_fee) * parseInt(studentsCount));
                                            classData.totalFees += (parseInt(data.total_fee) * parseInt(studentsCount));
                                        })
                                    } else {
                                        totalClassFee += 0;
                                        classData.totalFees += 0;
                                    }
                                    if (classResultLength == count) {
                                        next(null, classResult);
                                    }
                                })
                            })
                        }
                    },
                    function getStudentFeeData(result, next) {
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;

                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                classData.paidFees = 0;
                                db.collection('studentFee').find({
                                    class_id: class_id,
                                    status: 1
                                }).sort({ name: 1 }).toArray(function (err, result1) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (result1.length > 0) {
                                        result1.forEach(function (data) {
                                            paidFees += parseInt(data.paid_fee);
                                            classData.paidFees += parseInt(data.paid_fee);
                                            if(data.fee === 'special') {
                                                classData.totalFees += parseInt(data.total_fee);
                                                totalClassFee += parseInt(data.total_fee);
                                            }
                                        })
                                    } else {
                                        paidFees += 0;
                                        classData.paidFees += 0;
                                    }
                                    classData.balanceFees = (parseInt(classData.totalFees) - parseInt(classData.paidFees));
                                    if (parseInt(classData.totalFees) === 0) {
                                        classData.paidpercentage = 0;
                                        classData.balancepercentage = 0;
                                        classData.totalpercentage = 0;
                                    } else {
                                        classData.paidpercentage = parseInt((parseInt(classData.paidFees) / parseInt(classData.totalFees) * 100).toFixed(2));
                                        classData.balancepercentage = parseInt((parseInt(classData.balanceFees) / parseInt(classData.totalFees) * 100).toFixed(2));
                                        classData.totalpercentage = 100;
                                    }
                                    if (classResultLength == count) {
                                        next(null, classResult);
                                    }
                                })
                            })
                        }
                    }
                ],
                function (err, result1) {

                    balanceFees = parseInt(totalClassFee) - parseInt(paidFees);
                    paidpercentage = parseInt(parseInt(paidFees) / parseInt(totalClassFee) * 100);
                    balancepercentage = (100 - paidpercentage);
                    if (totalClassFee === 0) {
                        totalpercentage = 0;
                    } else {
                        totalpercentage = 100;
                    }
                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });
                    } else {
                        res.send({
                            totalFees: totalClassFee, paidFees: paidFees, balanceFees: balanceFees, totalpercentage: totalpercentage, paidpercentage: paidpercentage, balancepercentage: balancepercentage, classFee: result1
                        });
                    }
                }
            );
        });
    });

router.route('/feetypes/:school_id/:class_id')
    .get(function (req, res, next) {
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('fee_master').find({ school_id, class_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    feetypes: resultArray
                });
            });
        });
    });

router.route('/school_fee_details_for_dashboard/:date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var feeDetails = [];
        var select_date = new Date(req.params.date);
        var endDate = new Date(select_date);
        var n = select_date.getDay();
        endDate.setDate(endDate.getDate() + 1)
        var lastDayDate = new Date(select_date);
        lastDayDate.setDate(lastDayDate.getDate() - 1)
        var presentDate = new Date(select_date);
        presentDate.setDate(presentDate.getDate() + 1)
        var lastweekS_Date = new Date(select_date);
        lastweekS_Date.setDate(lastweekS_Date.getDate() - (7 + n))
        var m = lastweekS_Date.getDay();
        var lastweekE_Date = new Date(select_date);
        lastweekE_Date.setDate(lastweekE_Date.getDate() - (n))
        var p = lastweekE_Date.getDay();
        console.log(lastweekS_Date)
        console.log(m)
        console.log(lastweekE_Date)
        console.log(p)

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolClasses(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('school_classes').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getFeetypesData(result, next) {
                        //  console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                // console.log(class_id);
                                db.collection('fee_master').find({
                                    class_id
                                }).toArray(function (err, feeresults) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    classData.fee = feeresults;

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getClassStudents(classResult, next) {
                        var classResultLength = classResult.length;
                        var count = 0;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                // console.log(class_id);
                                db.collection('students').find({
                                    class_id
                                }).toArray(function (err, studentresults) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    classData.students = studentresults

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }
                                })
                            })
                        }
                    },
                    function getTotalStudentFee(classResult, next) {
                        // console.log(result);                        
                        var data = db.collection('student_fee').find({
                            school_id: school_id
                        }).toArray(function (err, studentFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult);
                        });
                    },
                    function getTodayFeePaid(classResult, studentFeeResult, next) {
                        // console.log(result);                        
                        var cursor = db.collection('student_fee').aggregate([
                            {
                                $match: {
                                    current_date: {
                                        $gte: new Date(select_date.toISOString()),
                                        $lt: new Date(endDate.toISOString())
                                    },
                                    school_id: school_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "fee_type",
                                    localField: "fee_types_id",
                                    foreignField: "fee_types_id",
                                    as: "fee_doc"
                                }
                            },
                            {
                                $unwind: "$fee_doc"
                            },
                            {
                                $lookup: {
                                    from: "students",
                                    localField: "student_id",
                                    foreignField: "student_id",
                                    as: "student_doc"
                                }
                            },
                            {
                                $unwind: "$student_doc"
                            },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "student_Name": "$student_doc.first_name",
                                    "student_id": "$student_id",
                                    "fee_types_id": "$fee_types_id",
                                    "fee_type": "$fee_doc.fee_type",
                                    "payment_mode": "$payment_mode",
                                    "discount": "$discount",
                                    "fine": "$fine",
                                    "current_date": "$current_date",
                                    "fee_paid": "$fee_paid",
                                    "total_fee": "$total_fee",
                                }
                            }
                        ]).toArray(function (err, todayFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult, todayFeeResult);
                        });
                    },
                    function getYesterDayFeePaid(classResult, studentFeeResult, todayFeeResult, next) {
                        // console.log(result);                        
                        var cursor = db.collection('student_fee').aggregate([
                            {
                                $match: {
                                    current_date: {
                                        $gte: new Date(lastDayDate.toISOString()),
                                        $lt: new Date(select_date.toISOString())
                                    },
                                    school_id: school_id,
                                },
                            },
                            {
                                $lookup: {
                                    from: "fee_type",
                                    localField: "fee_types_id",
                                    foreignField: "fee_types_id",
                                    as: "fee_doc"
                                }
                            },
                            {
                                $unwind: "$fee_doc"
                            },
                            {
                                $lookup: {
                                    from: "students",
                                    localField: "student_id",
                                    foreignField: "student_id",
                                    as: "student_doc"
                                }
                            },
                            {
                                $unwind: "$student_doc"
                            },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "student_Name": "$student_doc.first_name",
                                    "student_id": "$student_id",
                                    "fee_types_id": "$fee_types_id",
                                    "fee_type": "$fee_doc.fee_type",
                                    "payment_mode": "$payment_mode",
                                    "discount": "$discount",
                                    "fine": "$fine",
                                    "current_date": "$current_date",
                                    "fee_paid": "$fee_paid",
                                    "total_fee": "$total_fee",
                                }
                            }
                        ]).toArray(function (err, yesterdayFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult);
                        });
                    },
                    function getYesterDayRemaingFee(classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, next) {
                        // console.log(result);                        
                        var data = db.collection('student_fee').find({
                            current_date: {
                                $lt: new Date(select_date.toISOString())
                            },
                            school_id: school_id,

                        }).toArray(function (err, yesterRemaingFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult);
                        });
                    },
                    function getLastWeekFeePaid(classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult, next) {
                        // console.log(result);                        
                        var cursor = db.collection('student_fee').aggregate([
                            {
                                $match: {
                                    current_date: {
                                        $gte: new Date(lastweekS_Date.toISOString()),
                                        $lt: new Date(lastweekE_Date.toISOString())
                                    },
                                    school_id: school_id,


                                },
                            },
                            {
                                $lookup: {
                                    from: "fee_type",
                                    localField: "fee_types_id",
                                    foreignField: "fee_types_id",
                                    as: "fee_doc"
                                }
                            },
                            {
                                $unwind: "$fee_doc"
                            },
                            {
                                $lookup: {
                                    from: "students",
                                    localField: "student_id",
                                    foreignField: "student_id",
                                    as: "student_doc"
                                }
                            },
                            {
                                $unwind: "$student_doc"
                            },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "student_Name": "$student_doc.first_name",
                                    "student_id": "$student_id",
                                    "fee_types_id": "$fee_types_id",
                                    "fee_type": "$fee_doc.fee_type",
                                    "payment_mode": "$payment_mode",
                                    "discount": "$discount",
                                    "fine": "$fine",
                                    "current_date": "$current_date",
                                    "fee_paid": "$fee_paid",
                                    "total_fee": "$total_fee",
                                }
                            }
                        ]).toArray(function (err, lastWeekFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult, lastWeekFeeResult);
                        });
                    },
                    function getLastWeekDayRemaingFee(classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult, lastWeekFeeResult, next) {
                        // console.log(result);                        
                        var data = db.collection('student_fee').find({
                            current_date: {
                                $lt: new Date(lastweekE_Date.toISOString())
                            },
                            school_id: school_id,

                        }).toArray(function (err, lastWeekRemaingFeeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult, lastWeekFeeResult, lastWeekRemaingFeeResult);
                        });
                    }, function getFinalFeeData(classResult, studentFeeResult, todayFeeResult, yesterdayFeeResult, yesterRemaingFeeResult, lastWeekFeeResult, lastWeekRemaingFeeResult, next) {
                        // console.log("getAttendanceData");
                        //  console.log(attResult);
                        //  console.log(result);
                        var count = 0;

                        /* student Total Fee Paid Details */
                        studentFeePaid = 0;
                        if (studentFeeResult != 0) {
                            var studentFeeLength = studentFeeResult.length;
                            // console.log(studentFeeResult);

                            for (a = 0; a < studentFeeLength; a++) {

                                if (studentFeeResult[a].fee_paid) {
                                    studentFeePaid += parseInt(studentFeeResult[a].fee_paid);
                                }

                            }
                        }
                        // console.log(studentFeePaid);

                        /* Today Total Fee Details */

                        todayfeePaid = dayBefore = dayBeforeTotalCollection = lastWeek = lastWeekTotalCollection = 0;

                        if (todayFeeResult) {
                            if (todayFeeResult.length != 0) {
                                for (t = 0; t < todayFeeResult.length; t++) {
                                    todayfeePaid += parseInt(todayFeeResult[t].fee_paid);
                                }
                            }
                        }
                        //      console.log(todayfeePaid);

                        /* Yesterday Total Fee Details */

                        if (yesterdayFeeResult) {
                            if (yesterdayFeeResult.length != 0) {
                                for (y = 0; y < yesterdayFeeResult.length; y++) {
                                    dayBefore += parseInt(yesterdayFeeResult[y].fee_paid);
                                }
                            }
                        }
                        //   console.log(dayBefore);

                        /*  Total Fee Collection Before today */

                        if (yesterRemaingFeeResult) {
                            if (yesterRemaingFeeResult.length != 0) {
                                for (yr = 0; yr < yesterRemaingFeeResult.length; yr++) {
                                    dayBeforeTotalCollection += parseInt(yesterRemaingFeeResult[yr].fee_paid);
                                }
                            }
                        }
                        //  console.log(dayBeforeTotalCollection);


                        /* Last Week Total Fee Details */

                        if (lastWeekFeeResult) {
                            if (lastWeekFeeResult.length != 0) {
                                for (l = 0; l < lastWeekFeeResult.length; l++) {
                                    lastWeek += parseInt(lastWeekFeeResult[l].fee_paid);
                                }
                            }
                        }
                        // console.log(lastWeek);

                        /*  Total Fee Collection Before Last Week */

                        if (lastWeekRemaingFeeResult) {
                            if (lastWeekRemaingFeeResult.length != 0) {
                                for (lwr = 0; lwr < lastWeekRemaingFeeResult.length; lwr++) {
                                    lastWeekTotalCollection += parseInt(lastWeekRemaingFeeResult[lwr].fee_paid);
                                }
                            }
                        }
                        //  console.log(lastWeekTotalCollection);

                        // var classResult = classResult;
                        var classDataLength = classResult.length;
                        var allClassesTotalAmount = 0;

                        if (classDataLength == 0) {
                            next(null, []);
                        } else {

                            classResult.forEach(function (classData) {
                                classStudents = [];
                                classFeeTypes = [];
                                var feeTypeAmount = 0;
                                feeAmountForAllStudentsInClass = 0;
                                allFeeTypesAmountForStudentInClass = 0;
                                var classesData = classData;

                                var classFeeLength = classData.fee.length;
                                var classFeeData = classData.fee;
                                var classStudentsLength = classData.students.length;
                                var class_id = classData.class_id;
                                var className = classData.name;
                                if (classFeeLength == 0) {
                                    count++;
                                    // console.log("count 0")
                                } else {
                                    if (classStudentsLength != 0) {

                                        for (i = 0; i < classFeeLength; i++) {
                                            //  console.log(classStudentsLength);
                                            feeTypeAmount = parseInt(classFeeData[i].fee_amount);
                                            //  console.log(feeTypeAmount);
                                            feeAmountForAllStudentsInClass = feeTypeAmount * parseInt(classStudentsLength);
                                            allFeeTypesAmountForStudentInClass += parseInt(feeAmountForAllStudentsInClass);

                                        }
                                    }
                                    //  console.log(allTypesAmountForStudentInClass);

                                    count++;
                                }
                                allClassesTotalAmount += allFeeTypesAmountForStudentInClass;

                                if (classDataLength == count) {
                                    todayFeeCollected = todayfeePaid;
                                    // totalFeeCollected = allClassesTotalAmount;
                                    remainingFeeBalance = allClassesTotalAmount - studentFeePaid;
                                    yesterdayFeeCollected = dayBefore;
                                    yesterdayRemainingFeeBalance = allClassesTotalAmount - dayBeforeTotalCollection;
                                    lastweekFeeCollected = lastWeek;
                                    lastweekRemainingFeeBalance = allClassesTotalAmount - lastWeekTotalCollection;

                                    feeDetails.push({
                                        schoolTotalFee: allClassesTotalAmount,
                                        TodayfeePaid: todayfeePaid,
                                        TotalFeeCollectedYet: studentFeePaid,
                                        TodayreaminingFeeBalanceYet: remainingFeeBalance,
                                        yesterdayfeePaid: yesterdayFeeCollected,
                                        yesterdayTotalFeeCollected: dayBeforeTotalCollection,
                                        yesterdayRemainingFeeBalance: yesterdayRemainingFeeBalance,
                                        lastweekfeePaid: lastWeek,
                                        lastweekTotalFeeCollected: lastWeekTotalCollection,
                                        lastweekRemainingFeeBalance: lastweekRemainingFeeBalance



                                    })
                                    next(null, feeDetails);
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
                            feeReports: result1
                        });

                    }
                }
            );
        });
    });

// Edit for Fee Types

router.route('/edit_fee_type/:fee_types_id')
    .put(function (req, res, next) {
        var myquery = { fee_types_id: req.params.fee_types_id };
        var req_fee_type = req.body.fee_type;

        mongo.connect(url, function (err, db) {
            db.collection('fee_type').update(myquery, {
                $set: {
                    fee_type: req_fee_type,
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

router.route('/edit_fee_collection/:student_fee_id')
    .put(function (req, res, next) {
        var myquery = { student_fee_id: req.params.student_fee_id };
        var req_payment_mode = req.body.payment_mode;
        var req_fee_type = req.body.fee_type;
        var req_discount = req.body.discount;
        var req_fine = req.body.fine;


        mongo.connect(url, function (err, db) {
            db.collection('student_fee').update(myquery, {
                $set: {
                    payment_mode: req_payment_mode,
                    fee_type: req_fee_type,
                    discount: req_discount,
                    fine: req_fine
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

router.route('/delete_fee_collection/:student_fee_id')
    .delete(function (req, res, next) {
        var myquery = { student_fee_id: req.params.student_fee_id };

        mongo.connect(url, function (err, db) {
            db.collection('student_fee').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/section_student_fee_paid_details/:section_id/:fee_types_id/:fee_term_id')
    .get(function (req, res, next) {
        var resultArray = [];
        // var school_id = req.params.school_id;
        // var class_id = req.params.class_id;
        var section_id = req.params.section_id;
        var fee_term_id = req.params.fee_term_id;
        var splited = section_id.split("-");
        var class_id = splited[0] + '-' + splited[1];
        var fee_types_id = req.params.fee_types_id;
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getstudents(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getStudentsData(result, next) {
                        //   console.log("getSectionsData");                      
                        var count = 0;
                        var studentResult = result;
                        var studentResultLength = result.length;
                        if (studentResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            studentResult.forEach(function (studentData) {
                                var student_id = studentData.student_id;
                                // console.log(student_id);     
                                if (fee_term_id == "null") {
                                    var cursor = db.collection('student_fee').find({
                                        student_id: student_id, fee_types_id: fee_types_id
                                    }).sort({ 'student_id': 1 })
                                } else if (fee_types_id == "null") {
                                    var cursor = db.collection('student_fee').find({
                                        student_id: student_id, fee_term_id: fee_term_id
                                    }).sort({ 'student_id': 1 })
                                } else if (fee_term_id == "all" && fee_types_id == "all") {
                                    var cursor = db.collection('student_fee').find({
                                        student_id: student_id
                                    }).sort({ 'student_id': 1 })
                                } else {
                                    var cursor = db.collection('student_fee').find({
                                        student_id: student_id, fee_types_id: fee_types_id, fee_term_id: fee_term_id
                                    }).sort({ 'student_id': 1 })
                                }
                                cursor.toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.fee = results
                                    // console.log(studentData.fee);

                                    if (studentResultLength == count) {

                                        next(null, studentResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getFeeTypesByClassId(result, next) {
                        console.log(fee_term_id);
                        console.log(fee_types_id);
                        if (fee_term_id == "null") {
                            var data = db.collection('fee_master').find({
                                fee_types_id: fee_types_id,
                                class_id: class_id
                            })
                        } else if (fee_types_id == "null") {
                            var data = db.collection('fee_master').find({
                                fee_term_id: fee_term_id,
                                class_id: class_id
                            })
                        } else if (fee_term_id == "all" && fee_types_id == "all") {
                            var data = db.collection('fee_master').find({
                                class_id: class_id
                            })
                        } else {
                            var data = db.collection('fee_master').find({
                                fee_types_id: fee_types_id,
                                fee_term_id: fee_term_id,
                                class_id: class_id
                            })
                        }

                        data.toArray(function (err, feeResult) {
                            if (err) {
                                next(err, null);
                            }
                            // console.log("total attenance result")
                            // console.log(attResult);
                            next(null, result, feeResult);
                        });
                    }, function getStudentFeeDetails(result, feeResult, next) {
                        // console.log("getAttendanceData");
                        //  console.log(result);
                        //  console.log(feeResult);
                        var count = 0;

                        var studentResult = result;
                        var studentDataLength = result.length;
                        if (feeResult.length == 0) {
                            res.end("false");
                        }
                        else if (feeResult.length >= 1) {
                            if (studentDataLength == 0) {
                                next(null, []);
                            } else {
                                // console.log("In fourth step sections attendance")

                                studentResult.forEach(function (studentData) {

                                    var feeLength = studentData.fee.length;
                                    var studentFee = studentData.fee;
                                    var studentId = studentData.student_id;
                                    var section_id = studentData.section_id;
                                    var studentName = studentData.first_name;
                                    var student_last = studentData.last_name;
                                    var phone = studentData.phone;
                                    var totalfee = 0
                                    for (var j = 0; j < feeResult.length; j++) {
                                        totalfee += feeResult[j].fee_amount;
                                    }

                                    due_date = feeResult[0].due_date;
                                    var balance = 0;
                                    paidAmount = 0;
                                    TotalDiscount = TotalFine = 0;
                                    fine = discount = 0;
                                    if (feeLength == 0) {
                                        count++;
                                        balance = totalfee - paidAmount + fine - discount;
                                        // console.log("count 0")
                                    } else {

                                        for (var i = 0; i < feeLength; i++) {

                                            //if (studentFee[i].fee_types_id == feeResult[0].fee_types_id && studentFee[i].fee_term_id == feeResult[0].fee_term_id) {

                                            feePaid = studentFee[i].fee_paid;
                                            feePaid = parseInt(feePaid);
                                            fine = studentFee[i].fine;
                                            fine = parseInt(fine);
                                            discount = studentFee[i].discount;
                                            discount = parseInt(discount);
                                            //console.log(typeof (feePaid) + " " + feePaid);
                                            paidAmount += feePaid;
                                            TotalDiscount += discount;
                                            TotalFine += fine;
                                            //}
                                        }

                                        balance = totalfee - paidAmount - TotalDiscount + TotalFine;
                                        count++;
                                    }
                                    // console.log(studentName);
                                    //  console.log("totalfee:" + totalfee + " paid:" + paidAmount + " balance:" + balance);
                                    studentFeeDetails.push({ "student_id": studentId, "section_id": section_id, "studentName": studentName, "student_last": student_last, "phone": phone, "totalFee": totalfee, "paidAmount": paidAmount, "fine": TotalFine, "Discount": TotalDiscount, "Balance": balance, "DueDate": due_date })

                                    //  feeDetails.push({"studentfee":studentFeeDetails});

                                    if (studentDataLength == count) {
                                        next(null, studentFeeDetails);
                                    }
                                });
                            }
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
                            studentFee: result1
                        });

                    }
                }
            );
        });
    });

router.route('/section_student_fee_paid_details/:section_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var class_id = splited[0] + '-' + splited[1];
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getstudents(next) {
                        db.collection('students').find({
                            section_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getStudentsData(result, next) {
                        var count = 0;
                        var studentResult = result;
                        var studentResultLength = result.length;
                        if (studentResultLength == 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                var student_id = studentData.student_id;
                                db.collection('student_fee').find({
                                    student_id: student_id,
                                }).sort({ 'student_id': 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.fee = results
                                    console.log(studentData.fee);

                                    if (studentResultLength == count) {

                                        next(null, studentResult);
                                    }

                                })
                            })
                        }
                    },
                    function getFeeTypesByClassId(result, next) {
                        var data = db.collection('fee_master').find({
                            class_id: class_id
                        }).toArray(function (err, feeResult) {
                            if (err) {
                                next(err, null);
                            }
                            console.log(feeResult)
                            next(null, result, feeResult);
                        });
                    },
                    function getfeeterms(result, feeResult, next) {
                        var data = db.collection('fee_term').find({
                            school_id: school_id
                        }).toArray(function (err, termResult) {
                            if (err) {
                                next(err, null);
                            }
                            console.log(termResult)
                            next(null, result, feeResult, termResult);
                        });

                    }, function getStudentFeeDetails(result, feeResult, termResult, next) {
                        var count = 0;
                        var termResult = result;
                        var termResultLength = result.length;
                        var studentResult = result;
                        var studentDataLength = result.length;
                        if (feeResult.length == 0) {
                            res.end("false");
                        }
                        else if (feeResult.length >= 1) {

                            studentResult.forEach(function (studentData) {

                                var feeLength = feeResult.length;
                                var studentFee = studentData.fee;
                                var studentFeeLength = studentFee.length;
                                var studentId = studentData.student_id;
                                var section_id = studentData.section_id;
                                var studentName = studentData.first_name;
                                var student_last = studentData.last_name;
                                var phone = studentData.phone;
                                var totalfee = 0;
                                var balance = 0;
                                paidAmount = 0;
                                TotalDiscount = TotalFine = 0;
                                fine = discount = 0;
                                if (feeLength == 0) {
                                    count++;
                                    balance = totalfee - paidAmount + fine - discount;

                                } else {
                                    for (var j = 0; j < feeLength; j++) {
                                        totalfee += feeResult[j].fee_amount;
                                    }

                                    for (var i = 0; i < studentFeeLength; i++) {

                                        feePaid = studentFee[i].fee_paid;
                                        feePaid = parseInt(feePaid);
                                        fine = studentFee[i].fine;
                                        fine = parseInt(fine);
                                        discount = studentFee[i].discount;
                                        discount = parseInt(discount);
                                        paidAmount += feePaid;
                                        TotalDiscount += discount;
                                        TotalFine += fine;
                                    }

                                    balance = totalfee - paidAmount - TotalDiscount + TotalFine;
                                    count++;
                                }
                                studentFeeDetails.push({ "student_id": studentId, "section_id": section_id, "studentName": studentName, "student_last": student_last, "phone": phone, "totalFee": totalfee, "paidAmount": paidAmount, "fine": TotalFine, "Discount": TotalDiscount, "Balance": balance })

                                if (studentDataLength == count) {
                                    next(null, studentFeeDetails);
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
                            studentFee: result1
                        });

                    }
                }
            );
        });
    });

router.route('/section_student_termfee_details/:section_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var section_id = req.params.section_id;
        var splited = section_id.split("-");
        var class_id = splited[0] + '-' + splited[1];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getstudents(next) {
                        db.collection('students').find({
                            section_id: section_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getStudentsData(result, next) {
                        var count = 0;
                        var studentResult = result;
                        var studentResultLength = result.length;
                        if (studentResultLength == 0) {
                            next(null, []);
                        } else {
                            studentResult.forEach(function (studentData) {
                                var student_id = studentData.student_id;
                                db.collection('student_fee').find({
                                    student_id: student_id,
                                    status: 1
                                }).sort({ 'student_id': 1 }).toArray(function (err, results) {
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    studentData.fee = results
                                    console.log(studentData);

                                    if (studentResultLength == count) {

                                        next(null, studentResult);
                                    }

                                })
                            })
                        }
                    },
                    function getFeeTypesByClassId(result, next) {
                        var data = db.collection('fee_master').find({
                            class_id: class_id,
                            status: 1
                        }).toArray(function (err, feeResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, feeResult);
                        });
                    },
                    function getfeeterms(result, feeResult, next) {
                        var data = db.collection('fee_term').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, termResult) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result, feeResult, termResult);
                        });

                    }, function getStudentFeeDetails(result, feeResult, termResult, next) {
                        var count = 0;
                        var termResult = termResult;
                        var termResultLength = termResult.length;
                        var feeResult = feeResult;
                        var feeResultLength = feeResult.length;
                        var studentResult = result;
                        var studentResultLength = result.length;
                        if (feeResult.length == 0) {
                            res.end("false");
                        }
                        else if (feeResult.length >= 1) {

                            termFee = [];
                            termResult.forEach(function (TermData) {
                                var fee_term_id = TermData.fee_term_id;
                                var fee_term = TermData.fee_term;
                                var studentFeeDetails = [];
                                studentResult.forEach(function (studentData) {
                                    var student_id = studentData.student_id;
                                    var student_name = studentData.first_name + ' ' + studentData.last_name;
                                    var student_fee = studentData.fee;

                                    var totalFee = 0;
                                    var totalPaidFee = 0;
                                    var totalDiscount = 0;
                                    var totalFine = 0;

                                    var count1 = 0;

                                    for (i = 0; i < feeResultLength; i++) {
                                        if (feeResult[i].fee_term_id === fee_term_id) {
                                            totalFee += feeResult[i].fee_amount;
                                        }
                                    }

                                    for (j = 0; j < student_fee.length; j++) {
                                        if (student_fee[j].fee_term_id === fee_term_id) {
                                            totalPaidFee += student_fee[j].fee_paid;
                                            totalDiscount += student_fee[j].discount;
                                            totalFine += student_fee[j].fine;
                                        }
                                    }
                                    var totalBalance = (totalFee - totalPaidFee - totalDiscount + totalFine);
                                    studentFeeDetails.push({ student_id: student_id, student_name: student_name, totalFee: totalFee, totalPaidFee: totalPaidFee, totalDiscount: totalDiscount, totalFine: totalFine, totalBalance: totalBalance })
                                })

                                termFee.push({ fee_term_id: fee_term_id, fee_term: fee_term, students: studentFeeDetails });

                                count++;

                                if (termResultLength == count) {
                                    next(null, termFee)
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
                            studentFee: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_termwise_fee_details/:student_id/:fee_term_id/:fee_types_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var student_id = req.params.student_id;
        var fee_term_id = req.params.fee_term_id;
        var fee_types_id = req.params.fee_types_id
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getStudentFee(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('school_classes').find({
                            school_id
                        }, { status: 0, _id: 0 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassFeeData(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;

                                // console.log(class_id);
                                db.collection('fee_master').find({
                                    class_id
                                }).sort({ name: 1 }).toArray(function (err, results) {
                                    var totalFeeMaster = 0;
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        results.forEach(function (data) {
                                            totalFeeMaster += parseInt(data.fee_amount);

                                        })

                                    } else {
                                        totalFeeMaster = 0;
                                    }
                                    //  classData.fees = results
                                    classData.totalFeeMaster = totalFeeMaster;

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentsCountInClass(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;

                                // console.log(class_id);
                                var resultCount = db.collection('students').find({
                                    class_id: class_id
                                }).count(function (err, results) {
                                    // console.log(results);
                                    var totalFeeMaster = 0
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results == 0) {
                                        totalFeeMaster = classData.totalFeeMaster;
                                    } else {
                                        totalFeeMaster = parseInt(results) * parseInt(classData.totalFeeMaster);
                                    }
                                    //  classData.fees = results
                                    classData.totalFeeMaster = totalFeeMaster;

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentFeeData(result, next) {
                        console.log(result);
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;

                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                // console.log(class_id);
                                db.collection('student_fee').find({
                                    class_id
                                }).sort({ name: 1 }).toArray(function (err, result1) {
                                    var totalStudentFee = 0
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (result1.length > 0) {
                                        result1.forEach(function (data) {
                                            totalStudentFee += parseInt(data.fee_paid);

                                        })

                                    } else {
                                        totalStudentFee = 0;
                                    }

                                    // classData.paidFee = result1;
                                    classData.totalStudentFee = totalStudentFee;

                                    if (classResultLength == count) {

                                        next(null, classResult);
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
                            FeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/total_classwise_fee_details/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolClassed(next) {
                        //   console.log("getSchoolClassed");
                        db.collection('school_classes').find({
                            school_id
                        }, { status: 0, _id: 0 }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result);
                        });
                    },
                    function getClassFeeData(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;

                                // console.log(class_id);
                                db.collection('fee_master').find({
                                    class_id
                                }).sort({ name: 1 }).toArray(function (err, results) {
                                    var totalFeeMaster = 0;
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results.length > 0) {
                                        results.forEach(function (data) {
                                            totalFeeMaster += parseInt(data.fee_amount);

                                        })

                                    } else {
                                        totalFeeMaster = 0;
                                    }
                                    //  classData.fees = results
                                    classData.totalFeeMaster = totalFeeMaster;

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentsCountInClass(result, next) {
                        //    console.log(result);                      
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;
                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;

                                // console.log(class_id);
                                var resultCount = db.collection('students').find({
                                    class_id: class_id
                                }).count(function (err, results) {
                                    // console.log(results);
                                    var totalFeeMaster = 0
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (results == 0) {
                                        totalFeeMaster = classData.totalFeeMaster;
                                    } else {
                                        totalFeeMaster = parseInt(results) * parseInt(classData.totalFeeMaster);
                                    }
                                    //  classData.fees = results
                                    classData.totalFeeMaster = totalFeeMaster;

                                    if (classResultLength == count) {

                                        next(null, classResult);
                                        // next(null, classData);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentFeeData(result, next) {
                        console.log(result);
                        var count = 0;
                        var classResult = result;
                        var classResultLength = result.length;

                        if (classResultLength == 0) {
                            next(null, []);
                        } else {
                            //  console.log("In Second step sections")
                            classResult.forEach(function (classData) {
                                var class_id = classData.class_id;
                                // console.log(class_id);
                                db.collection('student_fee').find({
                                    class_id
                                }).sort({ name: 1 }).toArray(function (err, result1) {
                                    var totalStudentFee = 0
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    if (result1.length > 0) {
                                        result1.forEach(function (data) {
                                            totalStudentFee += parseInt(data.fee_paid);

                                        })

                                    } else {
                                        totalStudentFee = 0;
                                    }

                                    // classData.paidFee = result1;
                                    classData.totalStudentFee = totalStudentFee;

                                    if (classResultLength == count) {

                                        next(null, classResult);
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
                            FeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_term_fee_details/:student_id/:fee_term_id/:class_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var student_id = req.params.student_id;
        var fee_term_id = req.params.fee_term_id;
        var feeDetails = studentFeeDetails = [];
        var studFee = classFee = [];
        var TermFeeDetails = [];
        var fee_term = " ";

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getTerm(next) {
                        db.collection('fee_term').find({
                            fee_term_id: fee_term_id
                        }).toArray(function (err, result1) {
                            if (err) {
                                next(err, null);
                            }
                            fee_term = result1[0].fee_term;
                            next(null, result1);
                        });
                    },
                    function getSchoolTypeFee(result1, next) {
                        db.collection('fee_type').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, result);
                        });
                    },
                    function getTotalFeeForTypeFromFeeMaster(result, next) {
                        var count = 0;
                        var TypeResult = result;
                        var TypeResultLength = result.length;
                        if (TypeResultLength == 0) {
                            next(null, []);
                        } else {
                            TypeResult.forEach(function (TypeData) {
                                var fee_types_id = TypeData.fee_types_id;

                                db.collection('fee_master').find({
                                    fee_types_id: fee_types_id,
                                    fee_term_id: fee_term_id,
                                    class_id: class_id
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        var totalTypeFee = 0;
                                        results.forEach(function (data) {
                                            totalTypeFee = data.fee_amount;
                                        })

                                    } else {
                                        totalTypeFee = 0;
                                    }
                                    count++;

                                    TypeData.totalTypeFee = totalTypeFee;
                                    // console.log(TermData)
                                    if (TypeResultLength == count) {

                                        next(null, TypeResult);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentFeeData(result, next) {
                        var count = 0;
                        var TypeResult = result;
                        var TypeResultLength = result.length;
                        if (TypeResultLength == 0) {
                            next(null, []);
                        } else {
                            TypeResult.forEach(function (TypeData) {
                                var fee_types_id = TypeData.fee_types_id;
                                db.collection('student_fee').find({
                                    fee_types_id: fee_types_id,
                                    fee_term_id: fee_term_id,
                                    student_id: student_id
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        var totalFeePaid = 0;
                                        var totalDiscount = 0;
                                        var totalFine = 0;
                                        results.forEach(function (data) {
                                            totalFeePaid += parseInt(data.fee_paid);
                                            totalDiscount += parseInt(data.discount);
                                            totalFine += parseInt(data.fine);
                                        })

                                    } else {
                                        totalFeePaid = 0;
                                        totalDiscount = 0;
                                        totalFine = 0;
                                    }
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    TypeData.totalFeePaid = totalFeePaid;
                                    TypeData.totalDiscount = totalDiscount;
                                    TypeData.totalFine = totalFine;
                                    // console.log(TermData)
                                    if (TypeResultLength == count) {

                                        next(null, TypeResult);
                                    }

                                })
                            })
                        }
                    },
                    function getTypeFeeDataForTerm(result, next) {

                        var count = 0;
                        var TypeResult = result;
                        var TypeResultLength = result.length;
                        var termFee = 0;
                        var termFeePaid = 0;
                        var termDiscount = 0;
                        var termFine = 0;
                        var termBalance = 0;

                        if (TypeResultLength == 0) {
                            next(null, []);
                        } else {
                            TypeResult.forEach(function (TypeData) {
                                // for (i = 0; i <= TermResultLength; i++) {

                                var TypeData = TypeData;
                                totalTypeFees = TypeData.totalTypeFee;
                                FeeType = TypeData.fee_type;
                                totalFeePaid = TypeData.totalFeePaid;
                                totalDiscount = TypeData.totalDiscount;
                                totalFine = TypeData.totalFine;
                                balance_Fee = (totalTypeFees + totalFine - totalDiscount) - totalFeePaid
                                studentFeeDetails.push({ fee_term_id: fee_term_id, FeeType: FeeType, TotalTypeFees: totalTypeFees, PaidTermFees: totalFeePaid, BalanceFee: balance_Fee, TotalDiscount: totalDiscount, TotalFine: totalFine })
                                termFee += totalTypeFees;
                                termFeePaid += totalFeePaid;
                                termDiscount += totalDiscount;
                                termFine += totalFine;
                                termBalance += balance_Fee;
                                count++;

                            })

                            TermFeeDetails.push({ fee_term: fee_term, termFee: termFee, termFeePaid: termFeePaid, termDiscount: termDiscount, termFine: termFine, termBalance: termBalance, studentFeeDetails: studentFeeDetails })

                            if (TypeResultLength == count) {
                                next(null, TermFeeDetails);
                            }

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
                            TermFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_term-typewise_fee_details/:student_id/:fee_term_id/:fee_types_id/:class_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var class_id = req.params.class_id;
        var student_id = req.params.student_id;
        var fee_term_id = req.params.fee_term_id;
        var fee_types_id = req.params.fee_types_id
        var feeDetails = studentFeeDetails = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getSchoolTermFee(next) {
                        db.collection('fee_master').find({
                            class_id: class_id,
                            fee_types_id: fee_types_id,
                            fee_term_id: fee_term_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, result);
                        });
                    },
                    function getStudentFeeData(result, next) {
                        var feeResult = result;
                        var feeResultLength = result.length;
                        // console.log(feeResult);
                        if (feeResultLength == 0) {
                            feeDetails.push({ totalFee: 0, totalStudentFee: 0, totalBalanceFee: 0, totalDiscount: 0, totalFine: 0 })
                            next(null, feeDetails);
                        } else {
                            db.collection('student_fee').find({
                                student_id: student_id,
                                fee_types_id: fee_types_id,
                                fee_term_id: fee_term_id
                            }).toArray(function (err, results) {
                                var totalStudentFee = 0;
                                var totalBalanceFee = 0;
                                var totalDiscount = 0;
                                var totalFine = 0;
                                if (err) {
                                    next(err, null);
                                }
                                if (results.length > 0) {

                                    results.forEach(function (data) {
                                        totalStudentFee += parseInt(data.fee_paid);
                                        totalDiscount += parseInt(data.discount);
                                        totalFine += parseInt(data.fine);
                                    })

                                } else {
                                    var totalFee = 0;
                                    totalStudentFee = 0;
                                }
                                var totalFee = feeResult[0].fee_amount;
                                totalBalanceFee = (totalFee + totalFine - totalStudentFee - totalDiscount);
                                feeDetails.push({ totalFee: totalFee, totalStudentFee: totalStudentFee, totalBalanceFee: totalBalanceFee, totalDiscount: totalDiscount, totalFine: totalFine })

                                next(null, feeDetails);

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
                            StudentFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_termwise_fee_details/:student_id/:class_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var student_id = req.params.student_id;
        var feeDetails = studentFeeDetails = [];
        var studFee = classFee = totalFeeDetails = [];
        var totalFee = PaidFee = BalanceFee = Discount = Fine = 0;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSchoolTypeFee(next) {
                        db.collection('fee_term').find({
                            school_id: school_id,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, result);
                        });
                    },
                    function getTotalFeeForTermFromFeeMaster(result, next) {
                        var count = 0;
                        var TermResult = result;
                        var TermResultLength = result.length;
                        if (TermResultLength == 0) {
                            next(null, []);
                        } else {
                            TermResult.forEach(function (TermData) {
                                var fee_term_id = TermData.fee_term_id;
                                db.collection('fee_master').find({
                                    fee_term_id: fee_term_id,
                                    class_id: class_id,
                                    status: 1
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        var totalTermFee = 0;
                                        results.forEach(function (data) {
                                            totalTermFee += parseInt(data.fee_amount);
                                        })

                                    } else {
                                        totalTermFee = 0;
                                    }
                                    count++;

                                    TermData.totalTermFee = totalTermFee;
                                    // console.log(TermData)
                                    if (TermResultLength == count) {

                                        next(null, TermResult);
                                    }

                                })
                            })
                        }
                    },
                    function getStudentFeeData(result, next) {
                        var count = 0;
                        var TermResult = result;
                        var TermResultLength = result.length;
                        if (TermResultLength == 0) {
                            next(null, []);
                        } else {
                            TermResult.forEach(function (TermData) {
                                var fee_term_id = TermData.fee_term_id;
                                db.collection('student_fee').find({
                                    fee_term_id: fee_term_id,
                                    student_id: student_id
                                }).toArray(function (err, results) {
                                    if (results.length > 0) {
                                        var totalFeePaid = 0;
                                        var totalDiscount = 0;
                                        var totalFine = 0;
                                        results.forEach(function (data) {
                                            totalFeePaid += parseInt(data.fee_paid);
                                            totalDiscount += parseInt(data.discount);
                                            totalFine += parseInt(data.fine);
                                        })

                                    } else {
                                        totalFeePaid = 0;
                                        totalDiscount = 0;
                                        totalFine = 0;
                                    }
                                    count++;
                                    if (err) {
                                        next(err, null);
                                    }
                                    TermData.totalFeePaid = totalFeePaid;
                                    TermData.totalDiscount = totalDiscount;
                                    TermData.totalFine = totalFine;
                                    // console.log(TermData)
                                    if (TermResultLength == count) {

                                        next(null, TermResult);
                                    }

                                })
                            })
                        }
                    },
                    function getTermFeeData(result, next) {

                        var count = 0;
                        var TermResult = result;
                        var TermResultLength = result.length;

                        if (TermResultLength == 0) {
                            next(null, []);
                        } else {
                            TermResult.forEach(function (TermData) {
                                // for (i = 0; i <= TermResultLength; i++) {

                                var TermData = TermData;
                                totalTermFees = TermData.totalTermFee;
                                FeeTerm = TermData.fee_term;
                                fee_term_id = TermData.fee_term_id;
                                totalFeePaid = TermData.totalFeePaid;
                                totalDiscount = TermData.totalDiscount;
                                totalFine = TermData.totalFine;
                                balance_termFee = (totalTermFees + totalFine - totalDiscount) - totalFeePaid
                                studentFeeDetails.push({ FeeTerm: FeeTerm, fee_term_id: fee_term_id, TotalTermFees: totalTermFees, PaidTermFees: totalFeePaid, BalanceTermFee: balance_termFee, TotalDiscount: totalDiscount, TotalFine: totalFine })
                                count++;
                                totalFee += totalTermFees;
                                PaidFee += totalFeePaid;
                                BalanceFee += balance_termFee;
                                Discount += totalDiscount;
                                Fine += totalFine;
                            })
                            totalFeeDetails.push({ totalFee: totalFee, PaidFee: PaidFee, BalanceFee: BalanceFee, Discount: Discount, Fine: Fine, TermwiseFee: studentFeeDetails })
                            if (TermResultLength == count) {
                                next(null, totalFeeDetails);
                            }

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
                            TermFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_termwise_fee_details_android/:student_id/:class_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var class_id = req.params.class_id;
        var student_id = req.params.student_id;
        var feeDetails = studentFeeDetails = [];
        var studFee = [];
        var classFee = [];
        var totalFeeDetails = [];
        var TermFee = [];
        var TypeFee = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSchoolTermFee(next) {
                        db.collection('fee_term').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            // TermFee = result;
                            next(null, result);
                        });
                    },
                    function getSchoolTypeFee(result, next) {
                        var count = 0;
                        var TermResult = result;
                        var TermResultLength = result.length;
                        if (TermResultLength == 0) {
                            next(null, []);
                        } else {
                            TermResult.forEach(function (TermData) {
                                db.collection('fee_type').find({
                                    school_id
                                }).toArray(function (err, results) {
                                    if (err) {
                                        next(err, null);
                                    }
                                    TermData.FeeTypes = results;
                                    count++;
                                    if (TermResultLength == count) {
                                        next(null, TermResult);
                                    }
                                });
                            })
                        }
                    },
                    function getTotalFeeForTermFromFeeMaster(TermResult, next) {
                        var count = 0;
                        var TermResults = TermResult;
                        var TermResultsLength = TermResult.length;
                        // console.log(TermResults)
                        TermResult.forEach(function (TermData) {
                            var TypeResult = TermData.FeeTypes;
                            var fee_term_id = TermData.fee_term_id;
                            if (TypeResult.length == 0) {
                                next(null, []);
                            } else {
                                TermData.FeeTypes.forEach(function (TypeData) {
                                    var fee_types_id = TypeData.fee_types_id;
                                    db.collection('fee_master').find({
                                        class_id: class_id,
                                        fee_term_id: fee_term_id,
                                        fee_types_id: fee_types_id
                                    }).toArray(function (err, result1) {
                                        if (err) {
                                            next(err, null);
                                        }
                                        if (result1.length > 0) {
                                            var total_fee = result1[0].fee_amount;
                                        } else {
                                            var total_fee = 0;
                                        }
                                        TypeData.total_fee = total_fee;
                                        count++;
                                        if (TermResultsLength == count) {
                                            next(null, TermResults)
                                        }
                                    })
                                })
                            }
                        })
                    },
                    function getStudentFeeData(TermResults, next) {
                        var count = 0;
                        var TermResult = TermResults;
                        var TermResultLength = TermResults.length;

                        // console.log(TermResult)
                        TermResult.forEach(function (TermData) {
                            var fee_term_id = TermData.fee_term_id;
                            var fee_term = TermData.fee_term;
                            var TypeResult = TermData.FeeTypes;
                            var TermTotalFee = 0;
                            var TermPaidFee = 0;
                            var TermDiscount = 0;
                            var TermFine = 0;
                            TermData.FeeTypes.forEach(function (TypeData) {
                                var fee_types_id = TypeData.fee_types_id;
                                var fee_type = TypeData.fee_type;
                                //console.log(fee_type)
                                var total_fee = TypeData.total_fee;
                                console.log(total_fee)
                                db.collection('student_fee').find({
                                    fee_types_id: fee_types_id,
                                    fee_term_id: fee_term_id,
                                    student_id: student_id
                                }).toArray(function (err, result2) {
                                    //console.log(result2)
                                    var totalFeePaid = 0;
                                    var totalDiscount = 0;
                                    var totalFine = 0;
                                    if (result2) {
                                        result2.forEach(function (data) {
                                            totalFeePaid += parseInt(data.fee_paid);
                                            totalDiscount += parseInt(data.discount);
                                            totalFine += parseInt(data.fine);

                                        })

                                    }
                                    // console.log(totalFeePaid)
                                    var BalanceFee = (total_fee - totalFeePaid - totalDiscount + totalFine)
                                    TypeFee.push({ fee_type_id: fee_types_id, fee_type: fee_type, total_fee: total_fee, totalFeePaid: totalFeePaid, BalanceFee: BalanceFee })
                                    // TypeData.totalFeePaid = totalFeePaid;
                                    // TypeData.totalDiscount = totalDiscount;
                                    // TypeData.totalFine = totalFine;
                                    // TypeData.BalanceFee = BalanceFee;
                                    TermTotalFee += total_fee;
                                    TermPaidFee += totalFeePaid;
                                    TermDiscount += totalDiscount;
                                    TermFine += totalFine;

                                })
                                //console.log(TypeFee);
                                var TermBalanceFee = (TermTotalFee - TermPaidFee - TermDiscount + TermFine)
                                TermData.TermTotalFee = TermTotalFee;
                                TermData.TermPaidFee = TermPaidFee;
                                TermData.TermDiscount = TermDiscount;
                                TermData.TermFine = TermFine;
                                TermData.TermBalanceFee = TermBalanceFee;
                                count++;
                                if (TermResultLength == count) {

                                    next(null, TermResult);
                                }
                            })

                        })
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
                            TermFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

router.route('/student_fee_details/:student_id/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var student_id = req.params.student_id;
        var feeDetails = studentFee = [];
        var studFee = classFee = [];

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [

                    function getSchoolTermFee(next) {
                        db.collection('fee_term').find({
                            school_id
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }

                            next(null, result);
                        });
                    },
                    function getSchoolTypeFee(result, next) {
                        db.collection('fee_type').find({
                            school_id
                        }).toArray(function (err, result1) {
                            if (err) {
                                next(err, null);
                            }
                            next(null, result1);
                        });
                    },
                    function getStudentFeeDetails(result, result1, next) {
                        var cursor = db.collection('student_fee').aggregate([
                            {
                                $match: {
                                    student_id: student_id,
                                }
                            },
                            {
                                "$lookup": {
                                    "from": "fee_type",
                                    "localField": "fee_types_id",
                                    "foreignField": "fee_types_id",
                                    "as": "fee_types_doc"
                                }
                            },
                            {
                                "$unwind": "$fee_types_doc"
                            },
                            {
                                "$lookup": {
                                    "from": "fee_term",
                                    "localField": "fee_term_id",
                                    "foreignField": "fee_term_id",
                                    "as": "fee_term_doc"
                                }
                            },
                            {
                                "$unwind": "$fee_term_doc"
                            },
                            {
                                "$project": {
                                    "_id": "$_id",
                                    "student_fee_id": "$student_fee_id",
                                    "student_id": "$student_id",
                                    "class_id": "$class_id",
                                    "fee_types_id": "$fee_types_id",
                                    "fee_type": "$fee_types_doc.fee_type",
                                    "fee_term_id": "$fee_term_id",
                                    "fee_term": "$fee_term_doc.fee_term",
                                    "total_fee": "$total_fee",
                                    "fee_paid": "$fee_paid",
                                    "payment_mode": "$payment_mode",
                                    "discount": "$discount",
                                    "fine": "$fine"
                                }
                            },
                        ])
                        cursor.forEach(function (doc, err) {
                            assert.equal(null, err);
                            resultArray.push(doc);
                        }, function () {
                            db.close();
                            res.send({
                                studentFeeDetails: resultArray
                            });
                        });
                    },
                    function getTermwiseFeeData(result, result1, studentFeeDetails, next) {

                        var count = 0;
                        var TermResult = result;
                        var TermResultLength = result.length;
                        var TypeResult = result1;
                        var TypeResultLength = result1.length;
                        var studentFee = studentFeeDetails;
                        var studentFeeLength = studentFeeDetails.length;
                        if (studentFeeLength == 0) {
                            next(null, []);
                        } else {
                            TermResult.forEach(function (TermData) {
                                var TermData = TermData;
                                console.log(JSON.stringify(TermData));
                                var FeeTerm_id = TermData.fee_term_id;
                                TypeResult.forEach(function (TypeData) {
                                    var TypeData = TypeData;
                                    var FeeType_id = TypeData.fee_types_id;
                                    for (j = 0; j < studentFee; j++) {
                                        if (FeeTerm_id == studentFee[j].fee_term_id && FeeType_id == studentFee[j].fee_types_id) {

                                        }
                                    }
                                })
                                for (j = 0; j < TermResultLength; j++) {

                                }
                                balance_termFee = (totalTermFees + Fine - Discount) - PaidTermFees
                                studentFeeDetails.push({ FeeTerm: FeeTerm, totalTermFees: totalTermFees, PaidTermFees: PaidTermFees, balance_termFee: balance_termFee, Discount: Discount, Fine: Fine, StudentFee: FeePaid })
                                count++;

                            })


                            if (TermResultLength == count) {
                                next(null, studentFeeDetails);
                            }

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
                            studentFeeDetails: result1
                        });

                    }
                }
            );
        });
    });

module.exports = router;