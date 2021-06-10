// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var router = express.Router();
var url = config.dburl;

// router.route('/addStudentToParent/:parentId/:studentId')
//     .put(function (req, res, next) {
//         var parentId = req.params.parentId;
//         var studentId = req.params.studentId;


//         mongo.connect(url, function (err, db) {
//             var collection = db.collection('users');

//             collection.find({
//                 "_id": new ObjectID(parentId),
//                 "users.student_id": studentId,
//                 "role": "parent"
//             }).toArray(function (err, results) {
//                 if (err) {
//                     res.send('false')
//                 }

//                 if (results.length == 0) {
//                     collection.update({
//                             "_id": new ObjectID(parentId),
//                             "role": "parent"
//                         }, {
//                             "$push": {
//                                 "users": {
//                                     student_id: studentId
//                                 }
//                             }
//                         },
//                         function (err, numAffected) {
//                             if (err) {
//                                 res.send('false')
//                             }
//                             // console.log(numAffected.result);
//                             if (numAffected.result.nModified == 1) {
//                                 res.send('true')
//                             } else {
//                                 res.send('false')
//                             }
//                         });
//                 } else {
//                     res.send('false')
//                 }
//             });
       

//         });
//     });


// router.route('/removeStudentFromParent/:parentId/:studentId')
//     .put(function (req, res, next) {
//         var parentId = req.params.parentId;
//         var studentId = req.params.studentId;


//         mongo.connect(url, function (err, db) {
//             var collection = db.collection('users');

//             collection.update({
//                     "_id": new ObjectID(parentId),
//                     "role": "parent"
//                 }, {
//                     "$pull": {
//                         "users": {
//                             student_id: studentId

//                         }
//                     }
//                 },
//                 function (err, numAffected) {
//                     // console.log(numAffected);
//                     if (err) {
//                         res.send('false')
//                     }
//                     if (numAffected) {
//                         if (numAffected.result.nModified == 1) {
//                             db.close();
//                             res.send('true')
//                         } else {
//                             db.close();
//                             res.send('false')

//                         }

//                     }
//                 });

//         });
//     });





module.exports = router;
