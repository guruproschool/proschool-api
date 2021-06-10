// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = config.dburl;

// Expenses
router.route('/expenses/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            expense_id: 'getauto',
            school_id: school_id,
            employee_id: req.body.employee_id,
            amount: req.body.amount,
            date: req.body.date,
            time: req.body.time,
            category: req.body.category,
            expense_type: 'miscellaneous',
            payment_status: req.body.payment_status,
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'expenses', function (err, autoIndex) {
                var collection = db.collection('expenses');
                collection.ensureIndex({
                    "expense_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.employee_id == null || item.amount == null || item.date == null || item.category == null) {
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
                                        expense_id: school_id + '-EXP' + id
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
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('expenses').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "expense_id": "$expense_id",
                        "employee_id": "$employee_doc.employee_id",
                        "first_name": "$employee_doc.first_name",
                        "amount": "$amount",
                        "approved_date": "$approved_date",
                        "payment_date": "$payment_date",
                        "expense_type": "$expense_type",
                        "category": "$category",
                        "payment_status": "$payment_status",
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    expenses: resultArray
                });
            });
        });
    });

// Update Expense Status
router.route('/update_expense/:expense_id')
    .put(function (req, res, next) {
        var myquery = { expense_id: req.params.expense_id };
        var payment_status = req.body.payment_status;
        var claim_id = req.body.claim_id;

        var current_date = new Date();
        var date = current_date.getDate();
        if (date < 10) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        if (payment_status === 'pending') {
            var payment_date = '';
        } else if (payment_status === 'completed') {
            var payment_date = year + '-' + month + '-' + date;
        }

        console.log(req.params.expense_id)
        mongo.connect(url, function (err, db) {
            db.collection('expenses').update(myquery, {
                $set: {
                    payment_status: payment_status,
                    payment_date: payment_date
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                if (payment_status === 'completed') {
                    mongo.connect(url, function (err, db) {
                        db.collection('claims').update({ claim_id: claim_id }, {
                            $set: {
                                payment_status: 'Paid'
                            }
                        }, function () {
                            db.close();
                        })
                    })
                }
                res.send('true');
            });
        });
    });

// Daily Expenses
router.route('/daily_expenses/:select_date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;
        console.log(this.select_date)
        var total_payment = 0;
        var paid_payment = 0;
        var paid_percentage;
        var balance_percentage;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('expenses').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        approved_date: select_date,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "expense_id": "$expense_id",
                        "employee_id": "$employee_doc.employee_id",
                        "first_name": "$employee_doc.first_name",
                        "amount": "$amount",
                        "date": "$date",
                        "expense_type": "$expense_type",
                        "category": "$category",
                        "payment_status": "$payment_status",
                    }
                }
            ]);
            cursor.toArray(function (err, results) {
                if(results.length > 0) {
                    results.forEach(function (result) {
                        total_payment += result.amount;
                        if (result.payment_status === 'completed') {
                            paid_payment += result.amount;
                        }
                    })
                } else {
                    total_payment += 0;
                    paid_payment += 0;
                }

                console.log(total_payment)
                if(total_payment > 0) {
                    total_percentage = 100;
                    paid_percentage = parseFloat((parseInt(paid_payment) / parseInt(total_payment) * 100).toFixed(2));
                    balance_percentage = parseFloat((100 - paid_percentage).toFixed(2));
                } else {
                    total_percentage = 0;
                    paid_percentage = 0;
                    balance_percentage = 0;
                }
                db.close();
                res.send({
                    total_payment: total_payment, paid_payment: paid_payment, total_percentage: total_percentage, paid_percentage: paid_percentage, balance_percentage: balance_percentage, expenses: results
                });
            });
            // cursor.forEach(function (doc, err) {
            //     total_payment += doc.amount;
            //     if (doc.payment_status === 'completed') {
            //         paid_payment += doc.amount;
            //     }
            //     if(total_payment > 0) {
            //         paid_percentage = parseInt((parseInt(paid_payment) / parseInt(total_payment) * 100).toFixed(2));
            //         balance_percentage = parseInt(100 - paid_percentage);
            //     } else {
            //         paid_percentage = 0;
            //         balance_percentage = 0;
            //     }
            //     assert.equal(null, err);
            //     resultArray.push(doc);
            // }, function () {
            //     db.close();
            //     res.send({
            //         total_payment: total_payment, paid_payment: paid_payment, paid_percentage: paid_percentage, balance_percentage: balance_percentage, expenses: resultArray
            //     });
            // });
        });
    });

// Claims
router.route('/claims/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            claim_id: 'getauto',
            school_id: school_id,
            employee_type: req.body.employee_type,
            employee_id: req.body.employee_id,
            amount: req.body.amount,
            date: req.body.date,
            category: req.body.category,
            description: req.body.description,
            claim_status: "pending",
            approved_date: '',
            payment_status: 'pending',
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'claims', function (err, autoIndex) {
                var collection = db.collection('claims');
                collection.ensureIndex({
                    "claim_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.employee_id == null || item.amount == null || item.date == null || item.category == null) {
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
                                        claim_id: school_id + '-CLM' + id
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
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('claims').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "employee",
                        "localField": "employee_id",
                        "foreignField": "employee_id",
                        "as": "employee_doc"
                    }
                },
                {
                    "$unwind": "$employee_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "claim_id": "$claim_id",
                        "employee_type": "$employee_type",
                        "employee_id": "$employee_doc.employee_id",
                        "first_name": "$employee_doc.first_name",
                        "amount": "$amount",
                        "date": "$date",
                        "category": "$category",
                        "claim_status": "$claim_status",
                        "approved_date": "$approved_date",
                        "payment_status": "$payment_status",
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    claims: resultArray
                });
            });
        });
    });

// router.route('/employee_claims/:employee_id')
//     .get(function (req, res, next) {
//         var resultArray = [];
//         var approved_claims = [];
//         var pending_claims = [];
//         var rejected_claims = [];
//         var result = '';

//         var employee_id = req.params.employee_id;

//         mongo.connect(url, function (err, db) {
//             assert.equal(null, err);
//             var cursor = db.collection('claims').find({
//                 employee_id: employee_id,
//                 status: 1
//             });
//             cursor.forEach(function (doc, err) {
//                 assert.equal(null, err);
//                 if(doc.claim_status === 'Approved') {
//                     approved_claims.push(doc)
//                 } else if(doc.claim_status === 'pending') {
//                     pending_claims.push(doc)
//                 } else if(doc.claim_status === 'rejected') {
//                     rejected_claims.push(doc)
//                 }
//             }, function () {
//                 db.close();
//                 res.send({approved_claims: approved_claims, pending_claims: pending_claims, rejected_claims: rejected_claims});
//             });
//         })
//     })

router.route('/employee_claims/:employee_id')
    .get(function (req, res, next) {
        var resultArray1 = [];
        var resultArray2 = [];
        var approved_claims = [];
        var pending_claims = [];
        var paid_claims = [];
        var employee_id = req.params.employee_id;

        mongo.connect(url, function (err, db) {

            async.waterfall(
                [
                    function getClaims(next) {
                        db.collection('claims').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id,
                                    status: 1
                                },
                            },
                            {
                                $project:
                                {
                                    "claim_id": "$claim_id",
                                    "school_id": "$school_id",
                                    "employee_id": "$employee_id",
                                    "amount": "$amount",
                                    "submission_date": "$date",
                                    "category": "$category",
                                    "status": "$claim_status",
                                    "approved_date": "$approved_date",
                                    "payment_date": "",
                                    "description": "$description"
                                }
                            }
                        ]).toArray(function (err, resultArray1) {
                            if (err) {
                                next(err, null);
                            }
                            resultArray1.forEach(function (doc) {
                                if (doc.status === 'Approved') {
                                    approved_claims.push(doc);
                                } else if (doc.status === 'pending') {
                                    pending_claims.push(doc);
                                }
                            })
                            next(null, pending_claims, approved_claims);
                        })
                    },
                    function getPaidClais(pending_claims, approved_claims, next) {

                        var cursor = db.collection('expenses').aggregate([
                            {
                                $match: {
                                    employee_id: employee_id,
                                    payment_status: 'completed',
                                    status: 1
                                },
                            },
                            {
                                $lookup: {
                                    from: "claims",
                                    localField: "claim_id",
                                    foreignField: "claim_id",
                                    as: "claim_doc"
                                }
                            },
                            {
                                $unwind: "$claim_doc"
                            },
                            {
                                $project:
                                {
                                    "claim_id": "$claim_id",
                                    "school_id": "$school_id",
                                    "employee_id": "$employee_id",
                                    "amount": "$amount",
                                    "submission_date": "$claim_doc.date",
                                    "category": "$category",
                                    "status": "Paid",
                                    "approved_date": "$approved_date",
                                    "payment_date": "$payment_date",
                                    "description": "$claim_doc.description"
                                }
                            }
                        ]);
                        cursor.toArray(function (err, resultArray2) {
                            if (err) {
                                next(err, null);
                            }
                            resultArray2.forEach(function (doc) {
                                paid_claims.push(doc)
                            })
                            next(null, pending_claims, approved_claims, paid_claims);
                        })
                    }
                ],
                function (err, pending_claims, approved_claims, paid_claims) {

                    db.close();
                    if (err) {
                        res.send({
                            error: err
                        });

                    } else {

                        res.send({
                            pending_claims: pending_claims, approved_claims: approved_claims, paid_claims: paid_claims
                        });

                    }
                }
            );
        });
    })

router.route('/employee_claims/:select_date/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;
        var select_date = req.params.select_date;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('claims').aggregate([
                {
                    $match: {
                        employee_id: employee_id,
                        status: 1
                    },
                },
                {
                    $lookup: {
                        from: "expenses",
                        localField: "claim_id",
                        foreignField: "claim_id",
                        as: "expense_doc"
                    }
                },
                { $unwind: "$expense_doc" },
                {
                    $project:
                        {
                            "claim_id": "$claim_id",
                            "amount": "$amount",
                            "date": "$date",
                            "category": "$category",
                            "status": "$claim_status",
                            "payment_status": "$expense_doc.payment_status",
                        }
                }
            ]).sort({_id: -1}).limit(10)
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc)
            }, function () {
                db.close();
                res.send({claims: resultArray});
            });
        })
    })

router.route('/employee_Paidclaims/:employee_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var employee_id = req.params.employee_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('expenses').aggregate([
                {
                    $match: {
                        employee_id: employee_id,
                        payment_status: 'completed',
                        status: 1
                    },
                },
                {
                    $lookup: {
                        from: "claims",
                        localField: "claim_id",
                        foreignField: "claim_id",
                        as: "claim_doc"
                    }
                },
                {
                    $unwind: "$claim_doc"
                },
                {
                    $project:
                    {
                        "claim_id": "$claim_id",
                        "school_id": "$school_id",
                        "employee_id": "$employee_id",
                        "amount": "$amount",
                        "submission_date": "$claim_doc.date",
                        "category": "$category",
                        "status": "$payment_status",
                        "approved_date": "$approved_date",
                        "payment_date": "$payment_date",
                        "description": "$claim_doc.description"
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc)
            }, function () {
                db.close();
                res.send({ paid_claims: resultArray });
            });
        })
    })

// Edit Claims
router.route('/edit_claims/:claim_id')
    .put(function (req, res, next) {
        var myquery = { claim_id: req.params.claim_id };
        var req_employee_type = req.body.employee_type;
        var req_employee_id = req.body.employee_id;
        var req_category = req.body.category;
        var req_amount = req.body.amount;
        var req_date = req.body.date;

        var req_approved_date = req.body.approved_date;

        var claim_status = req.body.claim_status;

        mongo.connect(url, function (err, db) {
            db.collection('claims').update(myquery, {
                $set: {
                    employee_type: req_employee_type,
                    employee_id: req_employee_id,
                    category: req_category,
                    amount: req_amount,
                    date: req_date,
                    approved_date: req_approved_date
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                } else if (claim_status === 'Approved') {
                    db.collection('expenses').update(myquery, {
                        $set: {
                            employee_id: req_employee_id,
                            amount: req_amount,
                            category: req_category,
                            approved_date: req_approved_date
                        }
                    })
                }
                db.close();
                res.send('true');
            });
        });
    });

// Soft Delete Claims
router.route('/delete_claims/:claim_id')
    .put(function (req, res, next) {
        var myquery = { claim_id: req.params.claim_id };

        mongo.connect(url, function (err, db) {
            db.collection('claims').update(myquery, { $set: { status: 0, claim_status: 'pending' } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    if (err.code == 11000) {
                        console.log(err);
                        res.end('false');
                    }
                    res.end('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('expenses').update(myquery, { $set: { status: 0, payment_status: 'pending' } }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                if (err.code == 11000) {
                                    console.log(err);
                                    res.end('false');
                                }
                                res.end('false');
                            } else {
                                db.close();
                                res.send('true');
                            }
                        });
                    });
                }
            });
        });
    });

// Hard Delete Claims
router.route('/hard_delete_claims/:claim_id')
    .delete(function (req, res, next) {
        var myquery = { claim_id: req.params.claim_id };

        mongo.connect(url, function (err, db) {
            db.collection('claims').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    mongo.connect(url, function (err, db) {
                        db.collection('expenses').deleteOne(myquery, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                if (err.code == 11000) {
                                    console.log(err);
                                    res.end('false');
                                }
                                res.end('false');
                            } else {
                                db.close();
                                res.send('true');
                            }
                        });
                    });
                }
            });
        });
    });

// Update Claims
router.route('/update_claim/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var myquery = { claim_id: req.body.claim_id };
        var claim_status = req.body.claim_status;
        if (claim_status === 'Approved') {
            var payment_status = 'Not Paid';
        } else if (claim_status === 'pending') {
            var payment_status = 'pending';
        }
        var resultArray = [];
        var current_date = new Date();
        var date = current_date.getDate();
        if (date < 10) {
            date = '0' + date;
        }
        var month = current_date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        var year = current_date.getFullYear();
        var approved_date = year + '-' + month + '-' + date;
        console.log(req.body.claim_status)

        var item = {
            expense_id: 'getauto',
            school_id: school_id,
            claim_id: req.body.claim_id,
            employee_id: req.body.employee_id,
            amount: req.body.amount,
            approved_date: approved_date,
            time: req.body.time,
            payment_date: '',
            category: req.body.category,
            expense_type: 'claims',
            payment_status: 'pending',
            status: status
        };

        mongo.connect(url, function (err, db) {
            if (claim_status === 'pending') {
                var approval_date = '';
            } else {
                var approval_date = approved_date;
            }
            db.collection('claims').update(myquery, { $set: { claim_status: claim_status, approved_date: approval_date, payment_status: payment_status } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                else {
                    var collection = db.collection('expenses');
                    collection.find({
                        claim_id: req.body.claim_id
                    }).toArray(function (err, resultArray) {
                        console.log(resultArray)
                        if (resultArray.length === 0) {
                            autoIncrement.getNextSequence(db, 'expenses', function (err, autoIndex) {
                                collection.ensureIndex({
                                    "expense_id": 1,
                                }, {
                                    unique: true
                                }, function (err, result) {
                                    console.log(item)
                                    if (item.employee_id == null || item.amount == null || item.approved_date == null || item.category == null) {
                                        res.end('null');
                                    } else {
                                        collection.find({ school_id: school_id }).count(function (err, triggerCount) {
                                            var id = triggerCount + 1;
                                            collection.insertOne(item, function (err, result) {
                                                console.log('Expense Added')
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
                                                        expense_id: school_id + '-EXP' + id
                                                    }
                                                }, function (err, result) {
                                                    db.close();
                                                    res.end('true');
                                                });
                                            });
                                        })
                                    }
                                })
                            })
                        } else if (resultArray.length > 0) {
                            if (claim_status === 'pending') {
                                var update_status = 0;
                            } else {
                                var update_status = 1;
                            }
                            collection.update(myquery, { $set: { status: update_status } }, function (err, result) {
                                if (err) {
                                    if (err.code == 11000) {
                                        console.log(err);
                                        res.end('false');
                                    }
                                    res.end('false');
                                } else {
                                    db.close();
                                    res.send('true');
                                }
                            })
                        }
                    })
                    // forEach(function (doc, err) {
                    //     console.log(doc)
                    //     resultArray.push(doc);
                    // })

                    // } else {
                    //     db.collection('expenses').update(myquery, { $set: { status: 0 } },
                    //         function (err, result) {
                    //             assert.equal(null, err);
                    //             if (err) {
                    //                 if (err.code == 11000) {
                    //                     console.log(err);
                    //                     res.end('false');
                    //                 }
                    //                 res.end('false');
                    //             } else {
                    //                 db.close();
                    //                 res.send('true');
                    //             }
                    //         });
                }
            });
        });
    });

router.route('/reject_claim/:claim_id')
    .put(function (req, res, next) {
        var myquery = { claim_id: req.params.claim_id };
        mongo.connect(url, function (err, db) {
            db.collection('claims').update(myquery, {
                $set: {
                    claim_status: 'rejected',
                    payment_status: 'No Payment',
                }
            }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
            })
        })
    })

// Add Payments 
router.route('/addpayment/:school_id')
    .post(function (req, res, next) {

        var school_id = req.params.school_id;
        var payment_toPay = req.body.payment_toPay;
        var payment_balance = req.body.balance_payment;
        var payment_id = req.body.payment_id;
        var payment_paid = parseInt(req.body.payment);
        var payment = {
            payment: payment_paid,
            payment_date: req.body.payment_date,
        }
        console.log(payment_balance)
        console.log(payment_paid)

        if (payment_paid == payment_balance) {
            var status = 'Paid';
            var payment_color = '#89ad4d';
        } else if (payment_paid == 0) {
            var status = 'Not Paid';
            var payment_color = '#e04b4a';
        } else {
            var status = 'Partially Paid';
            var payment_color = '#29b2e1';
        }

        console.log(payment_balance - payment_paid)

        if ((payment_balance - payment_paid) < 0) {
            res.send(null)
        } else {
            mongo.connect(url, function (err, db) {
                if (payment_paid == null || payment_paid == undefined || payment_paid == '') {
                    res.end('null')
                } else if (payment_id == null || payment_id == undefined || payment_id == '') {
                    res.end('null')
                } else {
                    var collection = db.collection('payments');
                    collection.findOneAndUpdate(
                        { payment_id: payment_id },
                        {
                            $inc: { payment_paid: payment_paid, payment_balance: -payment_paid },
                            $push: { payments: payment },
                            $set: { payment_status: status }
                        },
                        {
                            multi: true
                        }, function (err, result) {
                            if (err) {
                                console.log(err);
                                res.end('false')
                            }
                            db.close();
                            res.send('true')
                        }
                    );
                }
            })
        }
    })

// Get Payments
router.route('/payments/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('payments').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "material",
                        "localField": "material",
                        "foreignField": "material_id",
                        "as": "material_doc"
                    }
                },
                {
                    "$unwind": "$material_doc"
                },
                {
                    "$lookup": {
                        "from": "vendor",
                        "localField": "vendor",
                        "foreignField": "vendor_id",
                        "as": "vendor_doc"
                    }
                },
                {
                    "$unwind": "$vendor_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "payment_id": "$payment_id",
                        "material_id": "$material_doc.material_id",
                        "material": "$material_doc.material",
                        "vendor_id": "$vendor_doc.vendor_id",
                        "vendor_name": "$vendor_doc.vendor_name",
                        "payment_toPay": "$payment_toPay",
                        "payment_paid": "$payment_paid",
                        "payment_balance": "$payment_balance",
                        "payment_status": "$payment_status",
                        "payment_dueDate": "$payment_dueDate",
                        "payments": "$payments",
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    payments: resultArray
                });
            });
        });
    });

// Edit Payment
router.route('/edit_payment/:payment_id')
    .put(function (req, res, next) {
        var myquery = { payment_id: req.params.payment_id };
        var req_payment = req.body.payment;
        var req_payment_date = req.body.payment_date;

        mongo.connect(url, function (err, db) {
            db.collection('payments').update(myquery, {
                $set: {
                    payment: req_payment,
                    payment_date: req_payment_date,
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

// Soft Delete Payment
router.route('/delete_payment/:payment')
    .put(function (req, res, next) {
        var payment = parseInt(req.params.payment);
        var myquery = { payment_id: req.body.payment_id };
        var payment_toPay = req.body.payment_toPay;
        var payment_paid = req.body.payment_paid;
        var payment_balance = req.body.payment_balance;

        var new_paymentPaid = payment_paid - payment;
        var new_paymentBalance = payment_balance + payment;

        console.log(payment_paid)
        console.log(payment_toPay)
        console.log(payment)

        if(new_paymentPaid === payment_toPay) {
            var status = 'Paid';
            var payment_color = '#89ad4d';
        } else if(new_paymentPaid < payment_toPay && new_paymentPaid > 0) {
            var status = 'Partially Paid';
            var payment_color = '#29b2e1';
        } else if(new_paymentPaid === 0){
            var status = 'Not Paid';
            var payment_color = '#e04b4a';
        }

        // if (payment_toPay === payment_paid || payment_toPay > payment_paid) {
        //     var status = 'Partially Paid';
        //     var payment_color = '#29b2e1';
        // } else if (payment_paid === payment) {
        //     var status = 'Not Paid';
        //     var payment_color = '#e04b4a';
        // }

        console.log(req.body.payment_id)

        mongo.connect(url, function (err, db) {
            db.collection('payments').update(myquery,
                {
                    $inc: { payment_paid: -payment, payment_balance: payment },
                    $pull: { "payments": { "payment": payment } },
                    $set: { payment_status: status, payment_color: payment_color }
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
    });

// Hard Delete Payment
router.route('/hard_delete_payment/:payment_id')
    .delete(function (req, res, next) {
        var myquery = { vendor_id: req.params.vendor_id };

        mongo.connect(url, function (err, db) {
            db.collection('payments').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                res.send('true');
            });
        });
    });

// Daily Payments
router.route('/daily_payments/:select_date/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;
        var select_date = req.params.select_date;
        var total_payment = 0;
        var paid_payment = 0;
        var paid_percentage;
        var balance_percentage;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('payments').aggregate([
                {
                    $match: {
                        school_id: school_id,
                        payment_dueDate: select_date,
                        status: 1
                    }
                },
                {
                    "$lookup": {
                        "from": "material",
                        "localField": "material",
                        "foreignField": "material_id",
                        "as": "material_doc"
                    }
                },
                {
                    "$unwind": "$material_doc"
                },
                {
                    "$lookup": {
                        "from": "vendor",
                        "localField": "vendor",
                        "foreignField": "vendor_id",
                        "as": "vendor_doc"
                    }
                },
                {
                    "$unwind": "$vendor_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "payment_id": "$payment_id",
                        "material_id": "$material_doc.material_id",
                        "material": "$material_doc.material",
                        "vendor_id": "$vendor_doc.vendor_id",
                        "vendor_name": "$vendor_doc.vendor_name",
                        "payment_toPay": "$payment_toPay",
                        "payment_paid": "$payment_paid",
                        "payment_balance": "$payment_balance",
                        "payment_status": "$payment_status",
                        "payment_dueDate": "$payment_dueDate",
                    }
                }
            ]);
            cursor.toArray(function (err, results) {
                if(results.length > 0) {
                    results.forEach(function (result) {
                        total_payment += result.payment_toPay;
                        paid_payment += result.payment_paid;
                    })
                } else {
                    total_payment += 0;
                    paid_payment += 0;
                }

                console.log(total_payment)
                if(total_payment > 0) {
                    total_percentage = 100;
                    paid_percentage = parseFloat((parseInt(paid_payment) / parseInt(total_payment) * 100).toFixed(2));
                    balance_percentage = parseFloat((100 - paid_percentage).toFixed(2));
                } else {
                    total_percentage = 0;
                    paid_percentage = 0;
                    balance_percentage = 0;
                }
                db.close();
                res.send({
                    total_payment: total_payment, paid_payment: paid_payment, total_percentage: total_percentage, paid_percentage: paid_percentage, balance_percentage: balance_percentage, payments: results
                });
            });
        });
    });

module.exports = router;
