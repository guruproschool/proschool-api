var config = require("../config.json");
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var forEach = require('async-foreach').forEach;
var assert = require('assert');
var url = 'mongodb://' + config.dbhost + ':27017/s_erp_data';

exports = module.exports = function (io) {
  
  var chat = io.of('/chat');
  var groups = io.of('/groups');
  var start_class = io.of('/start_class');
  var join_class = io.of('/join_class');

  // chat.on('connection', (socket) => {
  //   console.log('User Connected');
    
  //   socket.on("send_message", (id, data) => {
  //     console.log(data);
  //     // Save message to DB
  //     data.timestamp = Date.now();
  //     var chat_id = data.chat_id;
  //     var school_id = data.school_id;
  //     var members = [];
  //     members.push(data.sender);
  //     members.push(data.receiver);
  //     var messages = [];
  //     messages.push({ author: data.sender, message: data.message, timestamp: data.timestamp })
  //     var item = {
  //       chat_id: 'getauto',
  //       school_id: school_id,
  //       members: members,
  //       messages: messages,
  //       status: 1
  //     }
  //     mongo.connect(url, function (err, db) {
  //       var collection = db.collection('chat_messsages');

  //       collection.find({
  //         "chat_id": chat_id
  //       }).toArray(function (err, results) {
  //         if (err) {
  //           res.send('false')
  //         }

  //         if (results.length == 0) {
  //           autoIncrement.getNextSequence(db, 'chat_messsages', function (err, autoIndex) {
  //             collection.ensureIndex({
  //               "chat_id": 1,
  //             }, {
  //               unique: true
  //             }, function (err, result) {
  //               if (item.members == null || item.messages == null) {
  //                 res.end('null');
  //               } else {
  //                 collection.insertOne(item, function (err, result) {
  //                   if (err) {
  //                     if (err.code == 11000) {
  //                       res.end('false');
  //                     }
  //                     res.end('false');
  //                   }
  //                   collection.update({
  //                     _id: item._id
  //                   }, {
  //                     $set: {
  //                       chat_id: school_id + '-' + 'CHAT-' + autoIndex
  //                     },
  //                   }, function (err, result) {
  //                     db.close();
  //                   });
  //                 });
  //               }
  //             });
  //           });

  //         } else {

  //           collection.update({
  //             "chat_id": chat_id
  //           }, {
  //             "$addToSet": {
  //               "messages": {
  //                 author: data.sender,
  //                 message: data.message,
  //                 timestamp: data.timestamp,
  //               }
  //             }
  //           });
  //         }
  //       });
  //     });
  //     socket.broadcast.to(id).emit(data["sender"], data);
  //   });

  // })

  groups.on('connection', (socket) => {
    console.log('User Connected in Group Chat');

    socket.on("send_group_message", (data) => {
      console.log(data);
      // Save message to DB
      data.timestamp = Date.now();
      var chatroom_id = data.chatroom_id;
      var school_id = data.school_id;
      var members = [];
      var message = { message: data.message, timestamp: data.timestamp, sender: data.sender, receiver: data.receiver };
      var messages = [];
      messages.push(message);
      var resultArray = [];
      mongo.connect(url, function (err, db) {
        var collection = db.collection('chat_rooms');

        collection.find({
          "chatroom_id": chatroom_id
        }).toArray(function (err, results) {
          if (err) {
            res.send('false')
          }

          if (results.length == 0) {
            if (data.receiver_type === 'class_group') {
              var collection1 = db.collection('students');
              var cursor = collection1.find({
                section_id: data.receiver,
                school_id: school_id,
                status: 1
              })
            } else if (data.receiver_type === 'teachers_group') {
              var collection1 = db.collection('employee')
              var cursor = collection1.find({
                school_id: school_id,
                status: 1
              })
            }

            cursor.forEach(function (doc, err) {
              assert.equal(null, err);
              if (data.receiver_type === 'class_group') {
                members.push({ member: doc.student_id, name: doc.first_name + doc.last_name })
              } else if (data.receiver_type === 'teachers_group') {
                members.push({ member: doc.employee_id, name: doc.first_name + doc.last_name })
              }
            }, function () {
              var item = {
                chatroom_id: 'getauto',
                members: members,
                messages: messages,
                status: 1
              }
              autoIncrement.getNextSequence(db, 'group_messages', function (err, autoIndex) {
                collection.ensureIndex({
                  "chatroom_id": 1,
                }, {
                  unique: true
                }, function (err, result) {
                  if (item.members == null || item.messages == null) {
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
                          chatroom_id: school_id + '-' + 'GROUP-' + autoIndex
                        },
                      }, function (err, result) {
                        db.close();
                      });
                    });
                  }
                });
              });
            });

          } else {

            collection.update({
              "chatroom_id": chatroom_id
            }, {
              "$addToSet": {
                "messages": {
                  message: data.message,
                  timestamp: data.timestamp,
                  sender: data.sender,
                  receiver: data.receiver,
                }
              }
            },
              function (err, numAffected) {
                if (err) {
                  res.send('false')
                }

                // if (numAffected.result.nModified == 1) {
                //   res.send('true')
                // } else {
                //   res.send('false')
                // }
              });
          }
        });
      });

      socket.emit(data["reciever"], data);

    });

  });

  start_class.on('connection', (socket) => {
    console.log('User Connected to Start the Class');

    socket.on('start_class', (data) => {
      console.log('A class has been started for ' + data.subject_id);
      mongo.connect(url, function (err, db) {
        var collection = db.collection('classrooms');

        collection.find({
          "classroom_id": data.classroom_id
        }).toArray(function (err, results) {
          if (err) {
            res.send('false')
          }
          console.log(results)
          if (results.length === 0) {
            var students = [];
            var collection1 = db.collection('students');
            collection1.find({
              section_id: data.section_id,
              status: 1
            }).forEach(function (doc, err) {
              students.push({ student: doc.student_id, name: doc.first_name + ' ' + doc.last_name, status: 'offline' })
            }, function () {
              var current_date = new Date();
              var day = current_date.getDay();
              var item = {
                classroom_id: 'getauto',
                school_id: data.school_id,
                subject_id: data.subject_id,
                section_id: data.section_id,
                lession_id: data.lession_id,
                topic_id: data.topic_id,
                students: students,
                status: 1
              }
              console.log(item)
              autoIncrement.getNextSequence(db, 'classrooms', function (err, autoIndex) {
                collection.ensureIndex({
                  "classroom_id": 1,
                }, {
                  unique: true
                }, function (err, result) {
                  if (item.subject_id == null || item.section_id == null || item.students == null) {
                    res.end('null');
                  } else {
                    console.log('true')
                    collection.insertOne(item, function (err, result) {
                      if (err) {
                        if (err.code == 11000) {
                          
                        }
                        
                      }
                      collection.update({
                        _id: item._id
                      }, {
                        $set: {
                          classroom_id: data.subject_id + '-B-' + autoIndex
                        },
                      }, function (err, result) {
                        db.close();
                      });
                    });
                  }
                });
              });
            })
          }
        })
      });
    })
  });

  join_class.on('connection', (socket) => {
    console.log('User Connected to join the Class');

    socket.on('join_class', (data) => {
      console.log('A Student has been joined in ' + data.subject_id);
      mongo.connect(url, function (err, db) {
        var collection = db.collection('classrooms');
        collection.find({
          "classroom_id": data.classroom_id
        }).toArray(function (err, results) {
          if (err) {
            res.send('false')
          }
          console.log(results)
          if (results.length > 0) {
            collection.update({})
            var students = [];
            var collection1 = db.collection('students');
            collection1.find({
              section_id: data.section_id,
              status: 1
            }).forEach(function (doc, err) {
              students.push({ student: doc.student_id, name: doc.first_name + ' ' + doc.last_name, status: 'offline' })
            }, function () {
              var current_date = new Date();
              var day = current_date.getDay();
              var item = {
                classroom_id: 'getauto',
                school_id: data.school_id,
                subject_id: data.subject_id,
                section_id: data.section_id,
                lession_id: data.lession_id,
                topic_id: data.topic_id,
                students: students,
                status: 1
              }
              console.log(item)
              autoIncrement.getNextSequence(db, 'classrooms', function (err, autoIndex) {
                collection.ensureIndex({
                  "classroom_id": 1,
                }, {
                  unique: true
                }, function (err, result) {
                  if (item.subject_id == null || item.section_id == null || item.students == null) {
                    res.end('null');
                  } else {
                    console.log('true')
                    collection.insertOne(item, function (err, result) {
                      if (err) {
                        if (err.code == 11000) {
                          
                        }
                        
                      }
                      collection.update({
                        _id: item._id
                      }, {
                        $set: {
                          classroom_id: data.subject_id + '-B-' + autoIndex
                        },
                      }, function (err, result) {
                        db.close();
                      });
                    });
                  }
                });
              });
            })
          }
          else {

          }

        })


      });

    })

  })

  io.on('connection', (socket) => {
    console.log('user connected');

    socket.on('drawing', (data) => {
      io.emit('drawing', data);
    });

  });

};


