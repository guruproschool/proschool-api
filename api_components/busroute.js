// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Timetable
router.route('/bus_route/:school_id')
    .post(function (req, res, next) {
        var status = 1;

        var school_id = req.params.school_id;
        //  var station_name = req.params.station_name;
        var item = {
            route_id: 'getauto',
            school_id: school_id,
            route_title: req.body.route_title,
            vehicle_code: req.body.vehicle_code,
            station: req.body.station,
            //  station_name : station_name,
            pickup_time: req.body.pickup_time,
            drop_time: req.body.drop_time,
            // vehicle_number: req.body.vehicle_number,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'bus_routes', function (err, autoIndex) {
                var collection = db.collection('bus_routes');
                collection.ensureIndex({
                    "route_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.route_id == null) {
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
                                            route_id: 'ROUTE-' + autoIndex
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


// Modifeid
// create new collection to bus_route and vehicle_code


router.route('/bus_route_title/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var item = {
            bus_route_id: 'getauto',
            vehicle_code: req.body.vehicle_code,
            route_title: req.body.route_title,
            school_id: school_id,
            status: status
        };

        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'Bus-Route', function (err, autoIndex) {
                var collection = db.collection('Bus-Route');
                collection.ensureIndex({
                    "bus_route_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.vehicle_code == null || item.route_title == null || item.school_id == null) {
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
                                            bus_route_id: 'BUS-RTE-' + autoIndex
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
        var school_id = req.params.school_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('Bus-Route').find({ school_id, status });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    Bus_Route: resultArray
                });
            });
        });
    });



// router.route('/bus_route/:school_id')
//     .get(function(req, res, next) {         
//         var school_id = req.params.school_id;
//         var resultArray = [];
//         mongo.connect(url, function(err, db) {
//             assert.equal(null, err);
//             var cursor = db.collection('bus_routes').find({school_id});
//             cursor.forEach(function(doc, err) {
//                 assert.equal(null, err);
//                 resultArray.push(doc);
//             }, function() {
//                 db.close();
//                 res.send({
//                     bus_routes: resultArray
//                 });
//             });
//         });
//     });




//Modified
//Add Or Update Stations to Bus-Route-*********


// router.route('/addorupdatestationstobusroute/:bus_route_id')
//  .post(function (req, res, next) {
//      var status = 1;
//      var bus_route_id = req.params.bus_route_id;
//      // var vehicle_code = req.body.vehicle_code;
//      // var route_title = req.body.route_title;
//      stations = [];
//      var item = {
//          // route_id: 'getauto',
//          bus_route_id: bus_route_id,
//          // vehicle_code: req.body.vehicle_code,
//          // route_title : req.body.route_title,
//          status: status,
//      };
//      var stations = {
//          station_id: 'getauto',
//          station_name: req.body.station_name,
//          pickup_time: req.body.pickup_time,
//          drop_time: req.body.drop_time,

//      };

//      mongo.connect(url, function (err, db) {
//          var collection = db.collection('bus_routes');

//          collection.find({
//              "bus_route_id": bus_route_id               
//          }).toArray(function (err, results) {
//              if (err) {
//                  res.send('false')
//              }


//              if (results.length == 0) {


//                  autoIncrement.getNextSequence(db, 'bus_routes', function (err, autoIndex) {

//                      collection.ensureIndex({
//                          "station_id": 1,
//                      }, {
//                          unique: true
//                      }, function (err, result) {
//                          if (item.bus_route_id == null || stations.station_name == null) {
//                              res.end('null');
//                          } else {
//                              collection.insertOne(item, function (err, result) {
//                                  if (err) {
//                                      if (err.code == 11000) {
//                                          res.end('false');
//                                      }
//                                      res.end('false');
//                                  }
//                                  collection.update({
//                                      _id: item._id
//                                  }, {
//                                     push: {
//                                          stations
//                                      }, $set: {
//                                          station_id: 'STN-' + autoIndex
//                                      }
//                                  }, function (err, result) {
//                                      db.close();
//                                      res.end('true');
//                                  });
//                              });
//                          }
//                      });
//                  });


//              } else {

//                 autoIncrement.getNextSequence(db, 'bus_routes', function (err, autoIndex) {

//                      collection.ensureIndex({
//                          "station_id": 1,
//                      }, {
//                          unique: true
//                      }, function(err, result) {

//                  collection.update({
//                          "bus_route_id": bus_route_id
//                      }, {
//                          "$addToSet": {
//                              "stations": {

//                                  station_id : 'STN-' + autoIndex,
//                                  station_name: req.body.station_name,
//                                  pickup_time: req.body.pickup_time,
//                                  drop_time: req.body.drop_time,
//                              }
//                          }
//                      },
//                      function (err, numAffected) {
//                          if (err) {
//                              res.send('false')
//                          }

//                          if (numAffected.result.nModified == 1) {
//                              res.send('true')
//                          } else {
//                              res.send('false')
//                          }
//                      });
//                  });
//              });
//                  // res.send('false')
//              }
//          });


//      });
//  });


router.route('/addorupdatestationstobusroute/:bus_route_id')
    .post(function (req, res, next) {
        var status = 1;
        var bus_route_id = req.params.bus_route_id;
        var station_name = req.body.station_name;

        stations = [];
        var item = {
            route_id: 'getauto',
            bus_route_id: bus_route_id,
            status: status,
        };
        var stations = {
            bus_route_id: bus_route_id,
            station_name: req.body.station_name,
            pickup_time: req.body.pickup_time,
            drop_time: req.body.drop_time,
        };

        mongo.connect(url, function (err, db) {
            var collection = db.collection('bus_routes');

            collection.find({
                "bus_route_id": bus_route_id
            }).toArray(function (err, results) {
                if (err) {
                    res.send('false')
                }


                if (results.length == 0) {

                    autoIncrement.getNextSequence(db, 'bus_routes', function (err, autoIndex) {

                        collection.ensureIndex({
                            "route_id": 1,
                        }, {
                                unique: true
                            }, function (err, result) {
                                if (item.bus_route_id == null || stations.station_name == null) {
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
                                                    route_id: 'ROUTE-' + autoIndex
                                                },
                                                $push: {
                                                    stations
                                                }
                                            }, function (err, result) {
                                                db.close();
                                                res.end('true');
                                            });
                                    });
                                }
                            });
                    });


                } else {
                    var data = collection.find({
                       
                        stations: { $elemMatch: { station_name: station_name, bus_route_id:bus_route_id } }
                       
                    }).count(function (e, triggerCount) {

                        if (triggerCount > 0) {
                            res.send('false');
                        } else {

                            collection.update({
                                "bus_route_id": bus_route_id
                            }, {
                                    "$addToSet": {
                                        "stations": {
                                            bus_route_id: bus_route_id,
                                            station_name: req.body.station_name,
                                            pickup_time: req.body.pickup_time,
                                            drop_time: req.body.drop_time
                                        }
                                    }
                                },
                                function (err, numAffected) {
                                    if (err) {
                                        res.send('false')
                                    }

                                    if (numAffected.result.nModified == 1) {
                                        res.send('true')
                                    } else {
                                        res.send('false')
                                    }
                                });
                            // res.send('false')
                        }
                    });
                }
            });


        });
    });

router.route('/addorupdatestationstobusroute/:bus_route_id')
    .get(function (req, res, next) {
        var bus_route_id = req.params.bus_route_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('bus_routes').find({ bus_route_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    bus_routes: resultArray
                });
            });
        });
    });


router.route('/edit_bus_route/:station_id')
    .put(function (req, res, next) {
        var myquery = { station_id: req.params.station_id };
        // var req_route_title = req.body.route_title;
        // var req_vehicle_code = req.body.vehicle_code;
        var req_station_name = req.body.station;
        var req_pickup_time = req.body.pickup_time;
        var req_drop_time = req.body.drop_time;

        mongo.connect(url, function (err, db) {
            db.collection('bus_routes').update(myquery, {
                $set: {
                    station_name: req_station_name,
                    pickup_time: req_pickup_time,
                    drop_time: req_drop_time
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


// 

router.route('/delete_bus_route/:route_id')
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

//modified
//Edit Bus_Route

router.route('/edit_bus_route_title/:bus_route_id')

    .put(function (req, res, next) {
        var myquery = { bus_route_id: req.params.bus_route_id };
        var req_route_title = req.body.route_title;
        var req_vehicle_code = req.body.vehicle_code;
        // var req_station = req.body.station;
        // var req_pickup_time = req.body.pickup_time;
        // var req_drop_time = req.body.drop_time;

        mongo.connect(url, function (err, db) {
            db.collection('Bus-Route').update(myquery, {
                $set: {
                    route_title: req_route_title,
                    vehicle_code: req_vehicle_code
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
// Delete Bus_Route



router.route('/delete_bus_route_title/:bus_route_id')
    .delete(function (req, res, next) {
        var myquery = { bus_route_id: req.params.bus_route_id };

        mongo.connect(url, function (err, db) {
            db.collection('Bus-Route').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });




router.route('/edit_bus_route_station/:bus_route_id/:station_name')
    .put(function (req, res, next) {
        var bus_route_id = req.params.bus_route_id;        
        var req_pickup_time = req.body.pickup_time;
        var req_drop_time = req.body.drop_time;
        var req_station_name = req.body.station_name;

        var myquery = { stations: { $elemMatch: { station_name: station_name, bus_route_id: bus_route_id } } };
        
        mongo.connect(url, function (err, db) {
            
            db.collection('bus_routes').update(myquery, {
                $set: {
                    "stations.$.station_name": req_station_name,
                    "stations.$.pickup_time": req_pickup_time,
                    "stations.$.drop_time": req_drop_time
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



router.route('/delete_bus_route_station/:bus_route_id/:station_name')
    .put(function (req, res, next) {
        var bus_route_id = req.params.bus_route_id;
        var station_name = req.params.station_name;
        //  var myquery = { bus_route_id: bus_route_id },{ stations: { $elemMatch: { station_name: station_name } } }

        mongo.connect(url, function (err, db) {
            //  var data = db.collection('bus_routes').find({bus_route_id});
            db.collection('bus_routes').update({bus_route_id:bus_route_id},
                { $pull: { stations: { station_name: station_name, bus_route_id: bus_route_id } } }, function (err, result) {

                    //   )
                    //     db.collection('bus_routes').deleteOne(myquery, function (err, result) {
                    // db.collection.deleteOne(  )
                    
                    if (err) {
                        res.send('false');      
                    }
                    db.close();
                    res.send('true');
                });
        });
    });




module.exports = router;
