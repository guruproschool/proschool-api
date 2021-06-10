// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var async = require('async');
var router = express.Router();
var url = 'mongodb://' + config.dbhost + ':27017/s_erp_data';
var Razorpay = require('razorpay');
var crypto = require('crypto');

const instance = new Razorpay({
    key_id: config.RAZOR_PAY_KEY_ID,
    key_secret: config.RAZOR_PAY_KEY_SECRET,
});

router.route('/payment_order/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var order = {
            amount: req.body.amount,
            currency: "INR",
            receipt: req.body.receipt,
            payment_capture: 0
        }

        var item = {
            feeOrder_id: 'getauto',
            order_id: '',
            student_id: req.body.student_id,
            fee_types_id: req.body.fee_types_id,
            payment_instalment: req.body.payment_instalment,
            fee_structure_id: req.body.fee_structure_id,
            amount: parseInt(req.body.amount) / 100,
            payment_status: 0,
            remarks: 'Payment Initiated',
        }

        instance.orders.create(order, async function (err, order) {
            if(err) {
                return res.status(500).json({
                    message: "Something Went Wrong",
                });
            } else {
                mongo.connect(url, function (err, db) {
                    console.log('Hello_1')
                    db.collection('payment_orders').insertOne(order, function (err, result) {
                        if (err) {
                            if (err.code == 11000) {
                                console.log(err);
                                res.end('false');
                            }
                            res.end('false');
                        } else {
                            autoIncrement.getNextSequence(db, 'Fee_orders', function (err, autoIndex) {
                                var collection = db.collection('schoolFee_orders');
                                collection.ensureIndex({
                                    "order_id": 1,
                                }, {
                                    unique: true
                                }, function (err, result) {
                                    collection.find({ school_id: school_id }).count(function (err, triggerCount) {
                                        var id = triggerCount + 1;
                                        item.feeOrder_id = school_id + '-FO' + id;
                                        item.order_id = order.id;
                                        collection.insertOne(item, function (err, result) {
                                            if (err) {
                                                if (err.code == 11000) {
                                                    console.log(err);
                                                    res.end('false');
                                                }
                                                res.end('false');
                                            }
                                            db.close();
                                            res.status(200).json({success:true, status:"Order created Successfully", value:order, key:config.RAZOR_PAY_KEY_SECRET})
                                        });
                                    })
                                });
                            });
                        }
                    })
                });
            }
        })
    })

router.route('/payment_capture/:payment_id')
    .post(function (req, res, next) {
        var order_id = req.body.order_id;
        var payment_amount = parseInt(req.body.payment_amount);
        var payment_currency = 'INR';

        var razorpay_payment_id = req.params.payment_id;
        var razorpay_order_id = req.body.razorpay_order_id;
        var razorpay_signature = req.body.razorpay_signature;
        console.log(typeof payment_amount)
        console.log(payment_amount)

        var hmac = crypto.createHmac('SHA256', config.RAZOR_PAY_KEY_SECRET);
        var generated_signature = hmac.update(order_id + "|" + razorpay_payment_id).digest("hex");

        if (generated_signature === razorpay_signature) {
            console.log(razorpay_signature);
            instance.payments.capture(razorpay_payment_id, payment_amount, payment_currency, function (err, payment) {
                if(err) {
                    return res.status(500).json({
                        message: err,
                    });
                } else {
                    console.log('Hello-'+ 1)
                    mongo.connect(url, function (err, db) {
                        db.collection('schoolFee_orders').findOneAndUpdate({order_id: order_id}, {
                            $set: {
                                payment_status: 1,
                                remarks: 'Payment Captured',
                            }
                        }, { returnNewDocument: true },
                        function (err, doc) {
                            assert.equal(null, err);
                            if (err) {
                                res.send('false');
                            } else {
                                console.log(doc)
                                var student_id = doc.value.student_id;
                                var fee_types_id = doc.value.fee_types_id;
                                var fee_structure_id = doc.value.fee_structure_id;
                                var payment_instalment = doc.value.payment_instalment;

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
                                    fee_structure_id: fee_structure_id,
                                    fee_paid: parseInt(payment_amount) / 100,
                                    installment: payment_instalment,
                                    payment_date: payment_date,
                                    payment_mode: 'online',
                                    payment_status: 'received',
                                    status: 1,
                                }

                                db.collection('studentFee').update(
                                    { student_id: student_id, fee_types_id: fee_types_id, status: 1 },
                                    {
                                        $push: {
                                            "payments": item,
                                        },
                                        $inc: {
                                            paid_fee: item.fee_paid
                                        }
                                    }, function (err, doc) {
                                        assert.equal(null, err);
                                        console.log('Hello-'+ 3)
                                        if (err) {
                                            res.send('false');
                                        }
                                        db.close();
                                        res.send('true');
                                    });
                            }
                        });
                    });
                }
            })
        } else {
            res.send({signature1: razorpay_signature, signature2: generated_signature})
        }
    })

router.route('/payment_transfer/:payment_id')
    .post(function (req, res, next) {
        var payment_id = req.body.payment_id;
        var account_id = 'acc_GCTjNsQBoTSHXL';

        instance.payments.transfer(payment_id, 
            {"account": account_id, "amount": 100, "currency": "INR", "notes": {}, "linked_account_notes": [], "on_hold": false }, function(err, transfer) {
                if(err) {
                    return res.status(500).json({
                        message: err,
                    })
                } else {
                    res.send('true')
                }
            })
    })

module.exports = router;
