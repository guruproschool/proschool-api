// flow
var express = require("express");
var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var assert = require('assert');
var router = express.Router();
var url = config.dburl;

// Add Schools

router.route('/book/:school_id')
    .post(function (req, res, next) {
        var status = 1;
        var school_id = req.params.school_id;
        books = [];
        var item = {
            book_id: 'getauto',
            school_id: school_id,
            book_title: req.body.book_title,
            author_name: req.body.author_name,
            book_price: req.body.book_price,
            isbn: req.body.isbn,
            qty: req.body.qty,
            rack_number: req.body.rack_number,
            inward_date: req.body.inward_date,
            book_description: req.body.book_description,
            subject: req.body.subject,

        };
        mongo.connect(url, function (err, db) {
            autoIncrement.getNextSequence(db, 'books', function (err, autoIndex) {
                var collection = db.collection('books');
                collection.ensureIndex({
                    "book_id": 1,
                }, {
                        unique: true
                    }, function (err, result) {
                        if (item.book_title == null) {
                            res.end('null');
                        } else {
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
                                            book_id: 'BOOK-' + autoIndex
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
            var cursor = db.collection('books').find({ school_id });           
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    books: resultArray
                });
            });
        });
    });


// Modified
// Get Book Details By BookId

router.route('/book_details/:book_id')
    .get(function (req, res, next) {
        var book_id = req.params.book_id;
        var status = 1;
        var resultArray = [];
        mongo.connect(url, function (err, db) {
            assert.equal(null, err);
            var cursor = db.collection('books').find({ book_id });
            cursor.forEach(function (doc, err) {
                assert.equal(null, err);
                resultArray.push(doc);
            }, function () {
                db.close();
                res.send({
                    books: resultArray
                });
            });
        });
    });

router.route('/book_edit/:book_id/:name/:value')
    .post(function (req, res, next) {
        var book_id = req.params.book_id;
        var name = req.params.name;
        var value = req.params.value;
        mongo.connect(url, function (err, db) {
            db.collection('books').update({ book_id }, { $set: { [name]: value } }, function (err, result) {
                assert.equal(null, err);
                db.close();
                res.send('true');
            });
        });
    });

//  router.route('/edit_exam_schedule/:exam_sch_id')
// .post(function(req, res, next){
//   var exam_sch_id = req.params.exam_sch_id;
//   var name = req.body.name;
//   var value = req.body.value;
//   mongo.connect(url, function(err, db){
//         db.collection('exam_schedule').update({exam_sch_id},{$set:{[name]: value}}, function(err, result){
//           assert.equal(null, err);
//            db.close();
//            res.send('true');
//         });
//   });
// });

router.route('/edit_book/:book_id')
    .put(function (req, res, next) {
        var myquery = { book_id: req.params.book_id };
        var req_book_title = req.body.book_title;
        var req_author_name = req.body.author_name;
        var req_book_price = req.body.book_price;
        var req_qty = req.body.qty;
        var req_rack_number = req.body.rack_number;
        var req_inward_date = req.body.inward_date;
        var req_book_description = req.body.book_description;
        var req_subject_name = req.body.subject;

        mongo.connect(url, function (err, db) {
            db.collection('books').update(myquery, {
                $set: {
                    book_title: req_book_title,
                    author_name: req_author_name,
                    book_price: req_book_price,
                    qty: req_qty,
                    rack_number: req_rack_number,
                    inward_date: req_inward_date,
                    book_description: req_book_description,
                    subject: req_subject_name
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


router.route('/delete_book/:book_id')
    .delete(function (req, res, next) {
        var myquery = { book_id: req.params.book_id };

        mongo.connect(url, function (err, db) {
            db.collection('books').deleteOne(myquery, function (err, result) {
                assert.equal(null, err);
                if (err) {
                    res.send('false');
                }
                db.close();
                res.send('true');
            });
        });
    });



module.exports = router;
