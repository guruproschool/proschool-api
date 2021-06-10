// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var forEach = require('async-foreach').forEach;
var router = express.Router();
var url = config.dburl;
var employeeUserModule = require('./employee_user_save');

var employeeModule = function () { };

employeeModule.prototype.employee = function (teachers_account, res, next) {
    // console.log(teachers_account[0]);
    // var prents_length = parents_account.length;
    var count = 0;
    if (teachers_account.length > 0) {
        forEach(teachers_account, function (key, value) {
            // if (key.teachers_account == 'TRUE') {
            if (key.job_category == "teaching") {
                var status = 1;
                var teacher_name = key.name;
                var school_id = key.school_id;
                var employee_id = key.employee_id;
                var joined_on = key.joined_on;

                var item = {
                    teacher_id: 'getauto',
                    teacher_name: teacher_name,
                    school_id: school_id,
                    employee_id: employee_id,
                    joined_on: joined_on,
                    status: status,
                }

                mongo.connect(url, function (err, db) {
                    autoIncrement.getNextSequence(db, 'teachers', function (err, autoIndex) {
                        var collection = db.collection('teachers');
                        collection.ensureIndex({
                            "teacher_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.teacher_name == null || employee_id == null || school_id == null) {
                                res.end('null');
                            } else {
                                //   item.teacher_id = school_id + '-TCH-' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    if (err) {
                                        //  console.log(err);
                                        if (err.code == 11000) {

                                            // res.end('false');
                                        }
                                        //  res.end('false');
                                    }
                                    collection.update({
                                        _id: item._id
                                    }, {
                                        $set: {
                                            teacher_id: school_id + '-TCH-' + autoIndex
                                        },
                                    }, function (err, result) {
                                        // db.close();
                                        // res.end('true');
                                        var userData = {};
                                        userData.email = school_id + '-TCH-' + autoIndex;
                                        userData.password = school_id + '-TCH-' + autoIndex;
                                        userData.uniqueId = school_id + '-TCH-' + autoIndex;
                                        // userData.email = parentId+autoIndex;
                                        // userData.password = parentId+autoIndex;
                                        // userData.uniqueId = parentId+autoIndex;
                                        userData.role = "teacher";
                                        userData.employeeId = employee_id;
                                        userData.school_id = school_id;
                                        teacherUserModule.teacherUserModuleSave(userData);
                                    });
                                    count++;
                                    db.close();

                                    if (count == teachers_account.length) {
                                        // res.send('true');
                                    }
                                });
                            }
                        });

                    });
                });
            }
            else if (key.job_category == "non-teaching") {

                var status = 1;
                var nonTeacher_name = key.name;
                var school_id = key.school_id;
                var splited = school_id.split("-");
                var schoolId = splited[1];
                var schoolAutoId = schoolId.slice(3);
                var employee_id = key.employee_id;
                var joined_on = key.joined_on;

                var item = {
                    nonTeacher_id: 'getauto',
                    nonTeacher_name: nonTeacher_name,
                    school_id: school_id,
                    employee_id: employee_id,
                    joined_on: joined_on,
                    status: status,
                }

                mongo.connect(url, function (err, db) {
                    autoIncrement.getNextSequence(db, 'nonTeacher', function (err, autoIndex) {
                        var collection = db.collection('nonTeacher');
                        collection.ensureIndex({
                            "nonTeacher_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.nonTeacher_name == null || employee_id == null || school_id == null) {
                                res.end('null');
                            } else {
                                //   item.teacher_id = school_id + '-TCH-' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    if (err) {
                                        //  console.log(err);
                                        if (err.code == 11000) {

                                            // res.end('false');
                                        }
                                        //  res.end('false');
                                    }
                                    collection.update({
                                        _id: item._id
                                    }, {
                                        $set: {
                                            nonTeacher_id: school_id + '-NON-TCH-' + autoIndex
                                        },
                                    }, function (err, result) {
                                        // db.close();
                                        // res.end('true');
                                        var userData = {};
                                        userData.email = "91" + schoolAutoId + 'N' + autoIndex;
                                        userData.password = "91" + schoolAutoId + 'N' + autoIndex;
                                        userData.uniqueId = school_id + '-NON-TCH-' + autoIndex;
                                        userData.employeeId = employee_id;
                                        // userData.email = parentId+autoIndex;
                                        // userData.password = parentId+autoIndex;
                                        // userData.uniqueId = parentId+autoIndex;
                                        userData.role = "non-teaching";
                                        userData.school_id = school_id;
                                        teacherUserModule.teacherUserModuleSave(userData);
                                    });
                                    count++;
                                    db.close();

                                    if (count == teachers_account.length) {
                                        // res.send('true');
                                    }
                                });
                            }
                        });

                    });
                });
            }
            else if (key.job_category == "administrative") {

                var status = 1;
                var adminstrative_name = key.name;
                var school_id = key.school_id;
                var splited = school_id.split("-");
                var schoolId = splited[1];
                var schoolAutoId = schoolId.slice(3);
                var employee_id = key.employee_id;
                var joined_on = key.joined_on;

                var item = {
                    adminstrative_id: 'getauto',
                    adminstrative_name: adminstrative_name,
                    school_id: school_id,
                    employee_id: employee_id,
                    joined_on: joined_on,
                    status: status,
                }

                mongo.connect(url, function (err, db) {
                    autoIncrement.getNextSequence(db, 'adminstrative', function (err, autoIndex) {
                        var collection = db.collection('adminstrative');
                        collection.ensureIndex({
                            "adminstrative_id": 1,
                        }, {
                            unique: true
                        }, function (err, result) {
                            if (item.adminstrative_name == null || employee_id == null || school_id == null) {
                                res.end('null');
                            } else {
                                //   item.teacher_id = school_id + '-TCH-' + autoIndex;
                                collection.insertOne(item, function (err, result) {
                                    if (err) {
                                        //  console.log(err);
                                        if (err.code == 11000) {

                                            // res.end('false');
                                        }
                                        //  res.end('false');
                                    }
                                    collection.update({
                                        _id: item._id
                                    }, {
                                        $set: {
                                            adminstrative_id: school_id + '-ADM-' + autoIndex
                                        },
                                    }, function (err, result) {
                                        // db.close();
                                        // res.end('true');
                                        var userData = {};
                                        userData.email = "91" + schoolAutoId + 'A' + autoIndex;
                                        userData.password = "91" + schoolAutoId + 'A' + autoIndex;
                                        userData.uniqueId = school_id + '-ADM-' + autoIndex;
                                        // userData.email = parentId+autoIndex;
                                        // userData.password = parentId+autoIndex;
                                        // userData.uniqueId = parentId+autoIndex;
                                        userData.role = "adminstrative";
                                        userData.school_id = school_id;
                                        teacherUserModule.teacherUserModuleSave(userData);
                                        userData.employeeId = employee_id;
                                    });
                                    count++;
                                    db.close();

                                    if (count == teachers_account.length) {
                                        // res.send('true');
                                    }
                                });
                            }
                        });

                    });
                });
            }


        });

    }
}
employeeModule.prototype.addTeacher = function (request, res) {
    var count = 0;
    var user_data = [];
    request.forEach(function (req) {
        var status = 1;
        var employee_type = req.employee_type;
        var teacher_name = req.name;
        var school_id = req.school_id;
        var employee_id = req.employee_id;
        var email = req.email;
        var phone = req.phone;
        var role = req.role;

        var item = {
            teacher_id: 'getauto',
            teacher_name: teacher_name,
            school_id: school_id,
            employee_id: employee_id,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'teachers', function (err, autoIndex) {
                var collection = db.collection('teachers');
                collection.ensureIndex({
                    "teacher_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    item.teacher_id = school_id + '-T' + autoIndex
                    collection.insertOne(item, function (err, result) {
                        count++;
                        if (err) {
                            if (err.code == 11000) {
                                // res.end('false');
                            }
                            // res.end('false');
                        }
                        var userData = {};
                        userData.email = email;
                        userData.phone = phone;
                        userData.login = employee_id;
                        userData.password = employee_id;
                        userData.uniqueId = employee_id;
                        userData.role = "teacher";
                        userData.school_id = school_id;
                        userData.otp = '';
                        userData.otp_expiry = '';
                        user_data.push(userData);

                        if (count === request.length) {
                            db.close();
                            if(employee_type === 'new') {
                                employeeUserModule.employeeUserModuleSave(user_data, res);                                
                            } else if(employee_type === 'existing') {
                                res.send({data: true, id: employee_id})
                            }
                        }
                    });
                });
            });
        });
    })
}

employeeModule.prototype.addNonTeacher = function (request, res) {
    var count = 0;
    var user_data = [];

    request.forEach(function (req) {
        var status = 1;
        var employee_type = req.employee_type;
        var nonteacher_name = req.name;
        var school_id = req.school_id;
        var employee_id = req.employee_id;
        var email = req.email;
        var phone = req.phone;
        var role = req.role;

        var item = {
            nonteacher_id: 'getauto',
            nonteacher_name: nonteacher_name,
            school_id: school_id,
            employee_id: employee_id,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'non-teachers', function (err, autoIndex) {
                var collection = db.collection('non-teachers');
                collection.ensureIndex({
                    "non-teacher_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    item.nonteacher_id = school_id + '-NT' + autoIndex;
                    collection.insertOne(item, function (err, result) {
                        count++;
                        if (err) {
                            if (err.code == 11000) {
                                // res.end('false');
                            }
                            // res.end('false');
                        }
                        var userData = {};
                        userData.email = email;
                        userData.phone = phone;
                        userData.login = employee_id;
                        userData.password = employee_id;
                        userData.uniqueId = employee_id;
                        userData.role = "non-teacher";
                        userData.school_id = school_id;
                        userData.otp = '';
                        userData.otp_expiry = '';
                        user_data.push(userData);

                        if (count === request.length) {
                            db.close();
                            if(employee_type === 'new') {
                                employeeUserModule.employeeUserModuleSave(user_data, res);                                
                            } else if(employee_type === 'existing') {
                                res.send({data: true, id: employee_id})
                            }
                        }
                    });
                });
            });
        });
    })
}

employeeModule.prototype.addAdministrator = function (request, res) {
    var count = 0;
    var user_data = [];

    request.forEach(function (req) {
        var status = 1;
        var employee_type = req.employee_type;
        var administrator_name = req.name;
        var school_id = req.school_id;
        var employee_id = req.employee_id;
        var email = req.email;
        var phone = req.phone;
        var role = req.role;
    
        var item = {
            administrator_id: 'getauto',
            administrator_name: administrator_name,
            school_id: school_id,
            employee_id: employee_id,
            status: status,
        }
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'administrators', function (err, autoIndex) {
                var collection = db.collection('administrators');
                collection.ensureIndex({
                    "administrator_id": 1,
                }, {
                    unique: true
                }, function (err, result) {
                    item.administrator_id = school_id + '-Ad' + autoIndex;
                    collection.insertOne(item, function (err, result) {
                        count++;
                        if (err) {
                            if (err.code == 11000) {
                                // res.end('false');
                            }
                            // res.end('false');
                        }
                        var userData = {};
                        userData.email = email;
                        userData.phone = phone;
                        userData.login = employee_id;
                        userData.password = employee_id;
                        userData.uniqueId = employee_id;
                        userData.role = "administrator";
                        userData.school_id = school_id;
                        userData.otp = '';
                        userData.otp_expiry = '';
                        user_data.push(userData);

                        if (count === request.length) {
                            db.close();
                            if(employee_type === 'new') {
                                employeeUserModule.employeeUserModuleSave(user_data, res);                                
                            } else if(employee_type === 'existing') {
                                res.send({data: true, id: employee_id})
                            }
                        }
                    });
                });
            });
        });
    })
}

module.exports = new employeeModule();
