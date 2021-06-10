// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;
var parentUserModule = require('../api_components/parent_user_save');

var parentModule = function () { };

parentModule.prototype.parent = function (parents_account, res, next) {
    var prents_length = parents_account.length;
    var count = 0;
    if (parents_account.length > 0) {
        forEach(parents_account, function (key, value) {
            if (key.parent_account_new == 'TRUE') {
                var status = 1;
                var parent_name = key.name;
                var school_id = key.school_id;
                var student_id = key.student_id;
                var class_id = key.class_id;
                var section_id = key.section_id;
                var students = { student_id: student_id, class_id: class_id, section_id: section_id };

                var item = {
                    parent_id: 'getauto',
                    parent_name: parent_name,
                    school_id: school_id,
                    status: status,
                }

                mongo.connect(url, function (err, db) {
                    autoIncrement.getNextSequence(db, 'parents', function (err, autoIndex) {
                        var collection = db.collection('parents');
                        collection.ensureIndex({
                            "parent_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.parent_name == null || section_id == null || student_id == null) {
                                res.end('null');
                            } else {
                                item.parent_id = school_id + '-P' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    if (err) {
                                        if (err.code == 11000) {
                                            res.end('false3');
                                        }
                                        res.end('false4');
                                    }
                                    collection.update({
                                        _id: item._id
                                    }, {
                                        $push: {
                                            students
                                        }
                                    }, function (err, result) {
                                        // db.close();
                                        // res.end('true');
                                        var userData = {};
                                        userData.email = school_id + '-P' + autoIndex;
                                        userData.password = school_id + '-P' + autoIndex;
                                        userData.uniqueId = school_id + '-P' + autoIndex;
                                        userData.role = "parent";
                                        userData.school_id = school_id;
                                        parentUserModule.parentUserModuleSave(userData);
                                    });
                                    count++;
                                    db.close();

                                    if (count == parents_account.length) {
                                        // res.send('true');
                                    }
                                });
                            }
                        });
                    });
                });
            }
            else if (key.parent_account_new == 'FALSE') {
                var parent_id = key.parent_id;
                var student_id = key.student_id;
                mongo.connect(url, function (err, db) {
                    var collection = db.collection('parents');
                    collection.update({
                        "parent_id": parent_id
                    }, {
                        "$addToSet": {
                            "students": {
                                student_id: student_id
                            }
                        }
                    },
                        function (err, numAffected) {
                            if (err) {
                            }

                            if (numAffected.result.nModified == 1) {
                            } else {
                            }
                        });
                });

            }
        });

    } else {
        res.end('false');
    }
}

parentModule.prototype.addParent = function (request, res) {

    var count = 0;
    var user_data = [];
    request.forEach(function (req) {
        var status = 1;
        var email = req.email;
        var phone = req.phone;
        var parent_name = req.name;
        var school_id = req.school_id;
        var student_id = req.student_id;
        var class_id = req.class_id;
        var section_id = req.section_id;
        var students = [{ student_id: student_id, class_id: class_id, section_id: section_id }];
        var schools = [school_id];

        var item = {
            parent_id: 'getauto',
            parent_name: parent_name,
            school_id: school_id,
            students: students,
            schools: schools,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'parents', function (err, autoIndex) {
                var collection = db.collection('parents');
                collection.ensureIndex({
                    "parent_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    item.parent_id = 'P' + autoIndex;
                    collection.insertOne(item, function (err, result) {
                        count++;
                        if (err) {
                            console.log(err)
                            if (err.code == 11000) {
                            }
                        }

                        var userData = {};
                        userData.email = email;
                        userData.phone = phone;
                        userData.login = 'P' + autoIndex;
                        userData.password = 'P' + autoIndex;
                        userData.uniqueId = 'P' + autoIndex;
                        userData.role = "parent";
                        userData.school_id = school_id;
                        userData.student_id = student_id;
                        user_data.push(userData);

                        if (count === request.length) {
                            parentUserModule.parentUserModuleSave(user_data, res);
                            db.close();
                        }
                    });
                });

            });
        });
    });
}

parentModule.prototype.addStudentToParent = function (request, res) {
    var count = 0;
    var user_data = [];

    request.forEach(function (req) {
        var parent_id = req.parent_id;
        var school_id = req.school_id;
        var student_id = req.student_id;
        var class_id = req.class_id;
        var section_id = req.section_id;
        mongo.connect(url, function (err, db) {
            var item = {
                student_id: student_id,
                class_id: class_id,
                section_id: section_id,
            }
            var collection = db.collection('parents');
            collection.update({
                "parent_id": parent_id
            }, {
                "$push": {
                    "students": item,
                    "schools": school_id
                }
            },
            function (err, numAffected) {
                count++;
                if (err) {
                     //    console.log(err);
                }

                if (numAffected.result.nModified == 1) {
                    //   console.log("true");
                } else {
                     //    console.log("false");
                }

                if(count === request.length) {
                    db.close();
                    res.send({ status: 'true', id: student_id });
                }
            });
        });
    })
}

module.exports = new parentModule();
