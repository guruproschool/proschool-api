// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var router = express.Router();
var url = config.dburl;

// Add Stations

router.route('/stations/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        var item = {
            station_id: 'getauto',
            school_id: school_id,
            station_name: req.body.station_name,
            station_code: req.body.station_code,
            station_geo_location: req.body.station_geo_location,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'stations', function (err, autoIndex) {
                var collection = db.collection('stations');
                collection.ensureIndex({
                    "station_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.station_name == null) {
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
                                            station_id: school_id + '-STN-' + autoIndex

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
        var school_id =req.params.school_id;
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('stations').find({school_id: school_id, status: 1});
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    stations: resultArray
                });
            });
        });
    });

// Get Station Details by Id
router.route('/station_details/:station_id')
    .get(function (req, res, next) {
        var station_id = req.params.station_id;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('stations').find({ station_id: station_id, status: 1 });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    stations: resultArray
                });
            });
        });
    });

// Edit Station
router.route('/edit_station/:station_id')
    .put(function (req, res, next) {
        var myquery = { station_id: req.params.station_id };
        var req_station_name = req.body.station_name;
        var req_station_code = req.body.station_code;
        var req_station_geolocation = req.body.station_geo_location;

        mongo.connect(url, function (err, db) {
            db.collection('stations').update(myquery, { $set: { station_name: req_station_name, station_code: req_station_code, station_geo_location: req_station_geolocation } }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Soft Delete Station
router.route('/delete_station/:station_id')
    .put(function (req, res, next) {
        var myquery = { station_id: req.params.station_id };

        mongo.connect(url, function (err, db) {
            db.collection('stations').update(myquery, { $set: { status: 0} }, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

// Hard Delete Station
router.route('/hard_delete_station/:station_id')
    .delete(function (req, res, next) {
        var myquery = { station_id: req.params.station_id };

        mongo.connect(url, function (err, db) {
            db.collection('stations').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });

//  Modified
// Chapters bulk upload via excel sheet

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

router.route('/bulk_upload_transport_stations/:school_id')
    .post(function (req, res, next) {
        var school_id = req.params.school_id;
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
            console.log(req.file.path);
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
                    console.log(result[0]);
                    var test = result;
                    var count = 0;

                    if (test.length > 0) {
                        test.forEach(function (key, value) {

                            var item = {
                                station_id: 'getauto',
                                school_id: school_id,
                                station_name: key.stationname,
                                station_code: key.stationcode,
                                station_geo_location: key.stationgeolocation,
                                status: status,
                            }
                            mongo.connect(url, function (err, db) {
                                autoIncrement.getNextSequence(db, 'transport', function (err, autoIndex) {

                                    var collection = db.collection('transport');
                                    collection.ensureIndex({
                                        "station_id": 1,
                                    }, {
                                            unique: true
                                        }, function (err, result) {
                                            if (item.station_name == null) {
                                                res.end('null');
                                            } else {
                                                item.station_id = 'STN-' + autoIndex;
                                                collection.insertOne(item, function (err, result) {
                                                    if (err) {
                                                        console.log(err);
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


