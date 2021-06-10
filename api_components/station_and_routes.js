// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Bus Routes
router.route('/busRoute/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var route_stations = [];
        var item = {
            bus_route_id: 'getauto',
            school_id: school_id,
            route_title: req.body.route_title,
            vehicle_number: req.body.vehicle_number,
            route_stations: route_stations,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'bus_routes', function (err, autoIndex) {
                var collection = db.collection('bus_routes');
                collection.ensureIndex({
                    "bus_routes_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    if (item.route_title == null || item.vehicle_number == null) {
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
                                    bus_route_id: school_id + '-RTE-' + autoIndex

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
            var cursor = db.collection('bus_routes').find({ school_id: school_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    routes: resultArray
                });
            });
        });
    });

// Edit Bus Routes
router.route('/edit_busRoute/:bus_route_id')
    .put(function (req, res, next) {
        var myquery = { bus_route_id: req.params.bus_route_id };
        var req_route_title = req.body.route_title;
        var req_vehicle = req.body.vehicle_number;
        console.log(req.params.bus_route_id)
        console.log(req.body.route_title)
        console.log(req.body.vehicle_number)
        mongo.connect(url, function (err, db) {
            db.collection('bus_routes').update(myquery, { $set: { route_title: req_route_title, vehicle_number: req_vehicle } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Soft Delete Bus Routes
router.route('/delete_busRoute/:bus_route_id')
    .put(function (req, res, next) {
        var myquery = { bus_route_id: req.params.bus_route_id };

        mongo.connect(url, function (err, db) {
            db.collection('bus_routes').update(myquery, { $set: { status: 0 } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Bus Routes
router.route('/hard_delete_busRoute/:bus_route_id')
    .delete(function (req, res, next) {
        var myquery = { station_id: req.params.station_id };

        mongo.connect(url, function (err, db) {
            db.collection('bus_routes').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

router.route('/station_to_bus_route/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var bus_route_id = req.body.bus_route_id;
        var item = {
            station_id: req.body.station_id,
            pickup_time: req.body.pickup_time,
            drop_time: req.body.drop_time,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            db.collection('bus_routes').update({bus_route_id: bus_route_id},
                {
                    $push:
                    {
                        route_stations: item
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
    })

// Get Station Details by Id
router.route('/busRoute_details/:bus_route_id')
    .get(function (req, res, next) {
        var bus_route_id = req.params.bus_route_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('bus_routes').find({ bus_route_id: bus_route_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    busroutes: resultArray
                });
            });
        });
    });
    

module.exports = router;
