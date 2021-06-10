// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var async = require('async');
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Material
router.route('/material/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            material_id: 'getauto',
            school_id: school_id,
            material: req.body.material,
            category: req.body.category,
            quantity: parseInt(0),
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'material', function (err, autoIndex) {
                var collection = db.collection('material');
                collection.ensureIndex({
                    "material_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.material == null || item.category == null) {
                        res.end('null');
                    } else {
                        collection.find({school_id: school_id}).count(function (err, triggerCount) { 
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
                                        material_id: school_id + '-MAT' + id
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
            var cursor = db.collection('material').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    material: resultArray
                });
            });
        });
    });

// Edit Material
router.route('/edit_material/:material_id')
    .put(function (req, res, next) {
        var material = req.body.material;
        var category = req.body.category;
        var myquery = { material_id: req.params.material_id };

        mongo.connect(url, function (err, db) {
            db.collection('material').update(myquery, {
                $set: {
                    material: material,
                    category: category
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

// Soft Delete
router.route('/delete_material/:material_id')
    .put(function (req, res, next) {
        var myquery = { material_id: req.params.material_id };

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function updateMaterialIn(next) {
                        db.collection('material').update(myquery, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material_in').updateMany({ material: req.params.material_id }, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material_out').updateMany({ material: req.params.material_id }, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('payments').update({ material: req.params.material_id }, {
                            $set: {
                                status: 0
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

// Hard Delete
router.route('/hard_delete_material/:material_id')
    .delete(function (req, res, next) {
        var myquery = { material_id: req.params.material_id };

        mongo.connect(url, function (err, db) {
            db.collection('material').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                res.send('true');
            });
        });
    });

// Add vendor
router.route('/vendor/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            vendor_id: 'getauto',
            school_id: school_id,
            vendor_name: req.body.vendor_name,
            material: req.body.material,
            contact_no: req.body.contact_no,
            email: req.body.email,
            address: req.body.address,
            location: req.body.location,
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'vendor', function (err, autoIndex) {
                var collection = db.collection('vendor');
                collection.ensureIndex({
                    "vendor_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.vendor_name == null || item.contact_no == null) {
                        res.end('null');
                    } else {
                        collection.find({school_id: school_id}).count(function (err, triggerCount) { 
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
                                        vendor_id: school_id + '-VDR' + id
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
            var cursor = db.collection('vendor').aggregate([
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
                    "$project": {
                        "_id": "$_id",
                        "vendor_id": "$vendor_id",
                        "material_id": "$material_doc.material_id",
                        "material": "$material_doc.material",
                        "vendor_name": "$vendor_name",
                        "contact_no": "$contact_no",
                        "email": "$email",
                        "location": "$location",
                        "address": "$address"
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    vendor: resultArray
                });
            });
        });
    });

// Edit Vendor
router.route('/edit_vendor/:vendor_id')
    .put(function (req, res, next) {
        var myquery = { vendor_id: req.params.vendor_id };
        var req_material = req.body.material;
        var req_vendor_name = req.body.vendor_name;
        var req_contact_no = req.body.contact_no;
        var req_email = req.body.email;
        var req_address = req.body.address;
        var req_location = req.body.location;

        mongo.connect(url, function (err, db) {
            db.collection('vendor').update(myquery, {
                $set: {
                    material: req_material,
                    vendor_name: req_vendor_name,
                    contact_no: req_contact_no,
                    email: req_email,
                    address: req_address,
                    location: req_location
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

// Soft Delete Vendor
router.route('/delete_vendor/:vendor_id')
    .put(function (req, res, next) {
        var myquery = { vendor_id: req.params.vendor_id };

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function updateMaterialIn(next) {
                        db.collection('vendor').update(myquery, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material_in').updateMany({ vendor: req.params.vendor_id }, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('payments').update({ vendor: req.params.vendor_id }, {
                            $set: {
                                status: 0
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

// Hard Delete Vendor
router.route('/hard_delete_vendor/:vendor_id')
    .delete(function (req, res, next) {
        var myquery = { vendor_id: req.params.vendor_id };

        mongo.connect(url, function (err, db) {
            db.collection('vendor').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                res.send('true');
            });
        });
    });


router.route('/store/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            vendor_id: 'getauto',
            school_id: school_id,
            store_name: req.body.store_name,
            store_incharge: req.body.store_incharge,
            location: req.body.location,
            status: status
        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'store', function (err, autoIndex) {
                var collection = db.collection('store');
                collection.ensureIndex({
                    "store_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.store_name == null) {
                        res.end('null');
                    } else {
                        collection.find({school_id: school_id}).count(function (err, triggerCount) { 
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
                                        store_id: school_id + '-STR' + id
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
            var cursor = db.collection('store').find({ school_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    store: resultArray
                });
            });
        });
    });

// Add Material-In
router.route('/material_in/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            material_in_id: 'getauto',
            school_id: school_id,
            vendor: req.body.vendor,
            material: req.body.material,
            price: req.body.price,
            purchased_date: req.body.purchased_date,
            no_of_units: req.body.no_of_units,
            payment_dueDate: req.body.payment_duedate,
            status: status
        };

        console.log(item)

        var payment_toPay = (req.body.no_of_units * req.body.price);

        var payment = {
            payment_id: 'getauto',
            material_in_id: 'getauto',
            school_id: school_id,
            vendor: req.body.vendor,
            resource_type: 'Material',
            material: req.body.material,
            payment_toPay: payment_toPay,
            payment_paid: 0,
            payment_balance: payment_toPay,
            payments: [],
            payment_status: 'Not Paid',
            payment_color: "#e04b4a",
            payment_dueDate: req.body.payment_duedate,
            status: 1
        }
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function postmaterial(next) {
                        autoIncrement.getNextSequence(db, 'material_in', function (err, autoIndex) {
                            var collection = db.collection('material_in');
                            collection.ensureIndex({
                                "material_in_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (item.vendor == null || item.material == null || item.price == null) {
                                    res.end('null');
                                } else {
                                    collection.find({school_id: school_id}).count(function (err, triggerCount) { 
                                        var id = triggerCount + 1;
                                        item.material_in_id = school_id + '-MATin' + id;
                                        collection.insertOne(item, function (err, result) {
                                            assert.equal(null, err);
                                            if (err) {
                                                next(err, null);
                                            }
                                            next();
                                        });
                                    })
                                }
                            });
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material').update({ material_id: req.body.material }, {
                            $inc: {
                                quantity: req.body.no_of_units,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function addPayment(next) {
                        autoIncrement.getNextSequence(db, 'payments', function (err, autoIndex) {
                            var collection = db.collection('payments');
                            collection.ensureIndex({
                                "payment_id": 1,
                            }, {
                                unique: true
                            }, function (err, result) {
                                if (payment.payment_toPay == null) {
                                    res.end('null');
                                } else {
                                    collection.find({school_id: school_id}).count(function (err, triggerCount) { 
                                        var id = triggerCount + 1;
                                        payment.payment_id = school_id + '-PAY' + autoIndex;
                                        payment.material_in_id = item.material_in_id;
                                        collection.insertOne(payment, function (err, result) {
                                            assert.equal(null, err);
                                            if (err) {
                                                next(err, null);
                                            }
                                            next();
                                        });
                                    })
                                }
                            });
                        });
                    },
                ],
                function () {
                    db.close();
                    res.send(true)
                }
            )
        })
    })

    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('material_in').aggregate([
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
                    "$lookup": {
                        "from": "payments",
                        "localField": "material_in_id",
                        "foreignField": "material_in_id",
                        "as": "material_in_doc"
                    }
                },
                {
                    "$unwind": "$material_in_doc"
                },
                {
                    "$project": {
                        "_id": "$_id",
                        "material_in_id": "$material_in_id",
                        "material_id": "$material_doc.material_id",
                        "material": "$material_doc.material",
                        "vendor_id": "$vendor_doc.vendor_id",
                        "vendor": "$vendor_doc.vendor_name",
                        "price": "$price",
                        "no_of_units": "$no_of_units",
                        "purchased_date": "$purchased_date",
                        "payment_dueDate": "$payment_dueDate",
                        "payment_paid": "$material_in_doc.payment_paid",
                        "address": "$address"
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    material_in: resultArray
                });
            });
        });
    });

// Edit Material-In
router.route('/edit_material_in/:material_in_id')
    .put(function (req, res, next) {
        var myquery = { material_in_id: req.params.material_in_id };
        var req_material = req.body.material;
        var req_no_of_units = req.body.no_of_units;
        var req_purchased_date = req.body.purchased_date;
        var req_price = req.body.price;
        var req_payment_duedate = req.body.payment_duedate;

        var previous_quantity = req.body.previous_quantity;
        var changed_quantity = previous_quantity - req_no_of_units;

        console.log(changed_quantity)

        var payment_toPay = (req.body.no_of_units * req.body.price);
        var req_payment_paid = req.body.payment_paid;
        var req_payment_balance = (payment_toPay - req_payment_paid);
        var req_payment_toPay = payment_toPay;

        if (req_payment_paid == req_payment_toPay) {
            var status = 'paid';
            var payment_color = '#89ad4d';
        } else if (req_payment_paid == 0) {
            var status = 'Not Paid';
            var payment_color = '#e04b4a';
        } else {
            var status = 'Partially Paid';
            var payment_color = '#29b2e1';
        }

        var max_quantity = 0;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getMaterialQuantity(next) {
                        db.collection('material').find({
                            material_id: req_material,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            console.log(result[0].quantity - changed_quantity)
                            if( (result[0].quantity - changed_quantity) < 0 ) {
                                next(null, [])
                            } else {
                                next(null, result);
                            }

                        });
                    },
                    function updateMaterialIn(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            console.log(result)
                            db.collection('material_in').update(myquery, {
                                $set: {
                                    material: req_material,
                                    no_of_units: req_no_of_units,
                                    price: req_price,
                                    purchased_date: req_purchased_date,
                                    payment_dueDate: req_payment_duedate,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                    function updateMaterial(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            db.collection('material').update({ material_id: req_material }, {
                                $inc: {
                                    quantity: -changed_quantity,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                    function updateMaterial(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            db.collection('payments').update(myquery, {
                                $set: {
                                    material: req_material,
                                    payment_toPay: req_payment_toPay,
                                    payment_paid: req_payment_paid,
                                    payment_balance: req_payment_balance,
                                    payment_dueDate: req_payment_duedate,
                                    payment_status: status,
                                    payment_color: payment_color,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                ],
                function (err, result1) {
                    if(result1.length === 0) {
                        db.close();
                        res.send(null)
                    } else {
                        db.close();
                        res.send('true')
                    }
                }
            )
        })
    });

// Soft Delete Material-In
router.route('/delete_material_in/:material_in_id')
    .put(function (req, res, next) {
        var myquery = { material_in_id: req.params.material_in_id };
        var req_material = req.body.material_id;
        var req_no_of_units = req.body.no_of_units;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function deleteMaterialIn(next) {
                        db.collection('material_in').update(myquery, {
                            $set: {
                                status: 0,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material').update({ material_id: req_material }, {
                            $inc: {
                                quantity: -req_no_of_units,
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('payments').update(myquery, {
                            $set: {
                                status: 0
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

// Hard Delete Material-In
router.route('/hard_delete_material_in/:material_in_id')
    .delete(function (req, res, next) {
        var myquery = { material_in_id: req.params.material_in_id };

        mongo.connect(url, function (err, db) {
            db.collection('material_in').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Max Material-In Date
router.route('/max_material_in/:school_id')
    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('material_in').find({
                school_id: school_id, 
                status: 1
            }).sort({ purchased_date: 1})
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({max_material_in: resultArray[0].purchased_date});
            });
        });
    });

// Add Material-Out
router.route('/material_out/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;

        var item = {
            material_out_id: 'getauto',
            school_id: school_id,
            receiver: req.body.receiver,
            employee_type: req.body.employee_type,
            material: req.body.material,
            received_date: req.body.received_date,
            no_of_units: req.body.no_of_units,
            status: status
        };
        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getMaterialQuantity(next) {
                        db.collection('material').find({
                            material_id: req.body.material,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            console.log(result[0].quantity)
                            if( req.body.no_of_units > result[0].quantity ) {
                                next(null, [])
                            } else {
                                next(null, result);
                            }

                        });
                    },
                    function postmaterial(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            autoIncrement.getNextSequence(db, 'material_out', function (err, autoIndex) {
                                var collection = db.collection('material_out');
                                collection.ensureIndex({
                                    "material_out_id": 1,
                                }, {
                                    unique: true
                                }, function (err, result) {
                                    if (item.receiver == null || item.material == null || item.no_of_units == null) {
                                        res.end('null');
                                    } else {
                                        collection.find({school_id: school_id}).count(function (err, triggerCount) { 
                                            var id = triggerCount + 1;
                                            item.material_out_id = school_id + '-MATout' + id;
                                            collection.insertOne(item, function (err, result) {
                                                assert.equal(null, err);
                                                if (err) {
                                                    next(err, null);
                                                }
                                                next(null, result);
                                            });
                                        })
                                    }
                                });
                            });
                        }
                    },
                    function updateMaterial(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            db.collection('material').update({ material_id: req.body.material }, {
                                $inc: {
                                    quantity: -req.body.no_of_units,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                ],
                function (err, result1) {
                    if(result1.length === 0) {
                        db.close();
                        res.send(null)
                    } else {
                        db.close();
                        res.send('true')
                    }
                }
            )
        })
    })

    .get(function (req, res, next) {
        var resultArray = [];
        var school_id = req.params.school_id;

        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('material_out').aggregate([
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
                        "from": "employee",
                        "localField": "receiver",
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
                        "material_out_id": "$material_out_id",
                        "material_id": "$material_doc.material_id",
                        "material": "$material_doc.material",
                        "employee_type": "$employee_type",
                        "employee_id": "$employee_doc.employee_id",
                        "first_name": "$employee_doc.first_name",
                        "no_of_units": "$no_of_units",
                        "received_date": "$received_date",
                    }
                }
            ]);
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    material_out: resultArray
                });
            });
        });
    });

// Edit Material-Out
router.route('/edit_material_out/:material_out_id')
    .put(function (req, res, next) {
        var myquery = { material_out_id: req.params.material_out_id };
        var req_material = req.body.material;
        var req_employee_type = req.body.employee_type;
        var req_receiver = req.body.receiver;
        var req_received_date = req.body.received_date;
        var req_no_of_units = req.body.no_of_units;

        var previous_quantity = req.body.previous_quantity;
        var changed_quantity = previous_quantity - req_no_of_units;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function getMaterialQuantity(next) {
                        db.collection('material').find({
                            material_id: req_material,
                            status: 1
                        }).toArray(function (err, result) {
                            if (err) {
                                next(err, null);
                            }
                            console.log(changed_quantity + result[0].quantity)
                            if( (changed_quantity + result[0].quantity) < 0 ) {
                                next(null, [])
                            } else {
                                next(null, result);
                            }

                        });
                    },
                    function updateMaterialOut(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            db.collection('material_out').update(myquery, {
                                $set: {
                                    material: req_material,
                                    employee_type: req_employee_type,
                                    receiver: req_receiver,
                                    no_of_units: req_no_of_units,
                                    received_date: req_received_date,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                    function updateMaterial(result, next) {
                        var result = result;
                        if(result.length === 0) {
                            next(null, [])
                        } else {
                            db.collection('material').update({ material_id: req_material }, {
                                $inc: {
                                    quantity: changed_quantity,
                                }
                            }, function (err, result) {
                                assert.equal(null, err);
                                if (err) {
                                    next(err, null);
                                }
                                next(null, result);
                            });
                        }
                    },
                ],
                function (err, result1) {
                    if(result1.length === 0) {
                        db.close();
                        res.send(null)
                    } else {
                        db.close();
                        res.send('true')
                    }
                }
            )
        });
    });

// Soft Delete Material-Out
router.route('/delete_material_out/:material_out_id')
    .put(function (req, res, next) {
        var myquery = { material_out_id: req.params.material_out_id };

        var req_material = req.body.material_id;
        var req_no_of_units = req.body.no_of_units;

        mongo.connect(url, function (err, db) {
            async.waterfall(
                [
                    function updateMaterialIn(next) {
                        db.collection('material_out').update(myquery, {
                            $set: {
                                status: 0
                            }
                        }, function (err, result) {
                            assert.equal(null, err);
                            if (err) {
                                next(err, null);
                            }
                            next();
                        });
                    },
                    function updateMaterial(next) {
                        db.collection('material').update({ material_id: req_material }, {
                            $inc: {
                                quantity: req_no_of_units,
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
        });
    });

// Hard Delete Material-Out
router.route('/hard_delete_material_out/:material_out_id')
    .delete(function (req, res, next) {
        var myquery = { material_out_id: req.params.material_out_id };

        mongo.connect(url, function (err, db) {
            db.collection('material_out').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Stores
router.route('/edit_store_events/:store_id')
    .put(function (req, res, next) {
        var myquery = { store_id: req.params.store_id };
        var req_store_name = req.body.store_name;
        var req_store_incharge = req.body.store_incharge;
        var req_location = req.body.location;

        mongo.connect(url, function (err, db) {
            db.collection('vendor').update(myquery, {
                $set: {
                    store_name: req_store_name,
                    store_incharge: req_store_incharge,
                    location: req_location
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

router.route('/delete_store_events/:store_id')
    .delete(function (req, res, next) {
        var myquery = { store_id: req.params.store_id };

        mongo.connect(url, function (err, db) {
            db.collection('store').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                res.send('true');
            });
        });
    });

module.exports = router;
