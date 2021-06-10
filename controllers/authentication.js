const jwt = require('jwt-simple');
const User = require('../models/user');
const config = require('../config');
var express = require("express");
var config1 = require("../config.json");
var emailregex = require('regex-email');
var port = process.env.PORT || 4005;
var router = express.Router();
var mongo = require('mongodb').MongoClient;
var autoIncrement = require("mongodb-autoincrement");
var url = config1.dburl;
var forEach = require('async-foreach').forEach;
var ObjectID = require('mongodb').ObjectID;
var async = require('async');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
const AWS = require('aws-sdk');

function tokenForUser(user) {
	console.log(user.employee_id)
	const timestamp = new Date().getTime();
	return jwt.encode({
		sub: user._id,
		unid: user.uniqueId,
		role: user.role,
		school_id: user.school_id,
		employee_id: user.employee_id,
		iat: timestamp
	}, config1.secretKey);
}

exports.signin = function (req, res, next) {
	const datestamp = new Date();
	mongo.connect(url, function (err, db) {
		var item = {
			log_id: "getauto",
			role: req.user.role,
			uniqueId: req.user.uniqueId,
			login_time: datestamp,
			logout_time: '',
			status: 'login',
		}
		autoIncrement.getNextSequence(db, 'log', function (err, autoIndex) {
			var collection = db.collection('log');
			collection.createIndex({
				"log_id": 1,
			}, {
				unique: true
			}, function (err, result) {
				if (item.role == null || item.uniqueId == null) {
					res.end('null');
				} else {
					collection.insertOne(item, function (err, result) {
						if (err) {
							if (err.code == 11000) {
								console.log(err)
								res.end('false1');
							}
							res.end('false2');
						}
						collection.update({
							_id: item._id
						}, {
							$set: {
								log_id: 'LOG-' + autoIndex
							}
						}, function (err, result) {
							if (req.user.role == 'parent') {
								mongo.connect(url, function (err, db) {
									db.collection('parents').findOne({ parent_id: req.user.uniqueId, status: 1 }, function (err, resultsData) {
										if (resultsData) {
											if (resultsData.students.length > 0) {
												var resultArray = [];
												var count = 0;
												forEach(resultsData.students, function (key, value) {
													db.collection('students').findOne({
														"student_id": key.student_id
													}, function (err, results) {
														if (results) {
															resultArray.push(results);
														}
														count++;
														if (count == resultsData.students.length) {
															db.close();
															res.send({
																token: tokenForUser(req.user),
																role: req.user.role,
																uniqueId: req.user.uniqueId,
																school_id: req.user.school_id,
																_id: req.user._id,
																log_id: req.user.school_id + '-LOG-' + autoIndex,
																users: resultArray
															});
														}
													})
												})
											} else {
												res.send({
													token: tokenForUser(req.user),
													role: req.user.role,
													uniqueId: req.user.uniqueId,
													school_id: req.user.school_id,
													_id: req.user._id,
													log_id: req.user.school_id + '-LOG-' + autoIndex,
													users: resultsData.students
												});
											}
										} else {
											res.send({
												token: tokenForUser(req.user),
												role: req.user.role,
												uniqueId: req.user.uniqueId,
												school_id: req.user.school_id,
												_id: req.user._id,
												log_id: req.user.school_id + '-LOG-' + autoIndex,
												users: []
											});
										}
									});
								});
							} else if (req.user.role == 'teacher') {
								res.send({
									token: tokenForUser(req.user),
									role: req.user.role,
									uniqueId: req.user.uniqueId,
									school_id: req.user.school_id,
									employee_id: req.user.uniqueId,
									log_id: req.user.school_id + '-LOG-' + autoIndex,
									_id: req.user._id
								});
							} else if (req.user.role == 'admin') {
								res.send({
									token: tokenForUser(req.user),
									role: req.user.role,
									uniqueId: req.user.uniqueId,
									school_id: req.user.school_id,
									employee_id: req.user.role,
									log_id: req.user.school_id + '-LOG-' + autoIndex,
									_id: req.user._id
								});
							}
						});
					});
				}
			});
		});
	});
}

exports.signup = function (req, res, next) {
	const email = req.body.email;
	const password = req.body.password;
	const uniqueId = req.body.uniqueId;
	const role = req.body.role;
	const school_id = req.body.school_id;

	if (!email || !password) {
		return res.status(422).send({
			error: 'You must provide email and password'
		});
	}

	if (emailregex.test(email) != true) {
		return res.status(422).send({
			error: 'Not a valid email'
		});
	}

	// See if a user with the given email exists
	User.findOne({
		email: email
	}, function (err, existingUser) {
		if (err) {
			return next(err);
		}

		// If a user with email does exist, return an error
		if (existingUser) {
			return res.status(422).send({
				error: 'Email is in use'
			});
		}

		// If a user with email does Not exists, create and save user record
		const user = new User({
			email: email,
			password: password,
			uniqueId: uniqueId,
			role: role,
			school_id: school_id
		});

		user.save(function (err) {
			if (err) {
				return next(err);
			}

			// Respond to request indicating the user was created
			res.json({
				token: tokenForUser(user)
			});
		});
	});

}

exports.checkEmail = function (req, res, next) {
	const email = req.body.email;

	// See if a user with the given email exists
	User.findOne({
		email: email
	}, function (err, existingUser) {
		if (err) {
			return next(err);
		}

		// If a user with email does exist, return an error
		if (existingUser) {

			return res.status(200).send({
				error: 'false'
			});
		} else {
			return res.status(200).send({
				error: 'true'
			});
		}


	});

}

exports.checkResetToken = function (req, res, next) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
		if (!user) {
			return res.status(200).send({
				message: 'Password reset token is invalid or has expired.', status: false
			});
		}
		return res.status(200).send({
			message: 'Token Valid', status: true
		});
	});
}

// exports.forgotPassword = function (req, res, next) {
// 	async.waterfall([
// 		function (done) {
// 			crypto.randomBytes(20, function (err, buf) {
// 				var token = buf.toString('hex');
// 				done(err, token);
// 			});
// 		},
// 		function (token, done) {
// 			User.findOne({ email: req.body.email }, function (err, user) {
// 				if (!user) {
// 					return res.status(200).send({
// 						error: 'No account with that email address exists.'
// 					});

// 				}

// 				user.resetPasswordToken = token;
// 				user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

// 				user.save(function (err) {
// 					done(err, token, user);
// 				});
// 			});
// 		},
// 		function (token, user, done) {
// 			var smtpTransport = nodemailer.createTransport({
// 				service: config1.nodemailerservice,
// 				auth: {
// 					user: config1.nodemaileruser,
// 					pass: config1.nodemailerpass
// 				}
// 			});
// 			var mailOptions = {
// 				to: user.email,
// 				from: config1.nodemaileruser,
// 				subject: 'Pro School Password Reset',
// 				text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
// 					'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
// 					config1.emailHost + 'reset_password/' + token + '\n\n' +
// 					'If you did not request this, please ignore this email and your password will remain unchanged.\n'
// 			};
// 			smtpTransport.sendMail(mailOptions, function (err) {
// 				return res.status(200).send({
// 					error: 'An e-mail has been sent to ' + user.email + ' with further instructions.'
// 				});

// 				done(err, 'done');
// 			});
// 		}
// 	], function (err) {
// 		if (err) return next(err);
// 		return res.status(500).send({
// 			error: 'An error occured in processing request'
// 		});

// 	});

// }

exports.forgotPassword = function (req, res, next) {
	async.waterfall([
		function (done) {
			var digits = '0123456789';
			let OTP = '';
			for (let i = 0; i < 6; i++) {
				OTP += digits[Math.floor(Math.random() * 10)];
			}
			done(null, OTP);
		},
		function (OTP, done) {
			User.findOne({ email: req.body.email }, function (err, user) {
				if (!user) {
					return res.status(200).send({
						error: 'No account with that email address exists.'
					});
				}
				user.otp = OTP;
				user.otp_expiry = Date.now() + 300000; // 5 minutes

				user.save(function (err) {
					done(err, OTP, user);
				});
			});
		},
		function (OTP, user, done) {
			var transport = nodemailer.createTransport({
				host: "email-smtp.ap-south-1.amazonaws.com", // Amazon email SMTP hostname
				secureConnection: true, // use SSL
				port: 465, // port for secure SMTP
				auth: {
					user: "AKIAWW4SCDGKYXNRS6FB",
					pass: "BPtkoB9egmBTeFdOa7TnHlVA42at7ZNfZQzXOZm+/Icm"
				}
			});
			var mailOptions = {
				to: 'Vinod Kumar Alluri <vinodkumaralluri90@gmail.com>',
				from: 'Vinod Kumar Alluri <vinodkumaralluri90@gmail.com>',
				subject: 'Pro School Password Reset',
				text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
					'Please enter the OTP received with this email ' + OTP + '\n\n' +
					'If you did not request this, please ignore this email and your password will remain unchanged.\n'
			};
			transport.sendMail(mailOptions, function (err) {
				// return res.status(200).send(
				// 	'An e-mail has been sent to ' + user.email + ' with further instructions.'
				// );

				return res.status(200).send(true);

				done(err, 'done');
			});
		}
	], function (err) {
		if (err) return next(err);
		return res.status(500).send({
			error: 'An error occured in processing request'
		});

	});
}

exports.checkEmailOTPToken = function (req, res, next) {
	User.findOne({ otp: req.body.otp, otp_expiry: { $gt: Date.now() } }, function (err, user) {
		if (!user) {
			return res.status(200).send({
				message: 'Password OTP is invalid or has expired.', status: false
			});
		}
		return res.status(200).send({
			message: 'OTP Valid', status: true
		});
	});
}

exports.updatePasswordWithToken = function (req, res, next) {
	async.waterfall([
		function (done) {

			User.findOne({ email: req.body.email }, function (err, user) {
				if (!user) {
					return res.status(200).end({
						error: 'Password reset is invalid.', status: false
					});
					done(err, {});
				} else {
					user.password = req.body.password;
					user.email_otp = undefined;
					user.email_otpExpires = undefined;

					user.save(function (err) {
						//   req.logIn(user, function(err) {
						//     done(err, user);
						//   });
						done(err, user);
					});
				}
			});
		},
		function (user, done) {
			var result = user;
			var transport = nodemailer.createTransport({
				host: "email-smtp.ap-south-1.amazonaws.com", // Amazon email SMTP hostname
				secureConnection: true, // use SSL
				port: 465, // port for secure SMTP
				auth: {
					user: "AKIAWW4SCDGKYXNRS6FB",
					pass: "BPtkoB9egmBTeFdOa7TnHlVA42at7ZNfZQzXOZm+/Icm"
				}
			});
			var mailOptions = {
				to: 'Vinod Kumar Alluri <vinodkumaralluri90@gmail.com>',
				from: 'Vinod Kumar Alluri <vinodkumaralluri90@gmail.com>',
				subject: 'Your Pro School Account password has been changed',
				text: 'Hello,\n\n' +
					'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
			};
			transport.sendMail(mailOptions, function (err) {
				return res.status(200).send({
					error: 'Success! Your password has been changed.', status: true
				});

				done(err);

			});
		}
	], function (err) {
		return res.status(500).send({
			error: 'error.', status: "error"
		});
	});

}

// exports.updatePasswordWithToken = function (req, res, next) {
// 	async.waterfall([
// 		function (done) {
// 			User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
// 				if (!user) {
// 					return res.status(200).send({
// 						error: 'Password reset token is invalid or has expired.', status: "fail"
// 					});
// 				}

// 				user.password = req.body.password;
// 				user.resetPasswordToken = undefined;
// 				user.resetPasswordExpires = undefined;

// 				user.save(function (err) {
// 					//   req.logIn(user, function(err) {
// 					//     done(err, user);
// 					//   });
// 					done(err, user);
// 				});
// 			});
// 		},
// 		function (user, done) {
// 			var smtpTransport = nodemailer.createTransport({
// 				service: config1.nodemailerservice,
// 				auth: {
// 					user: config1.nodemaileruser,
// 					pass: config1.nodemailerpass
// 				}
// 			});
// 			var mailOptions = {
// 				to: user.email,
// 				from: config1.nodemaileruser,
// 				subject: 'Your Pro School Account password has been changed',
// 				text: 'Hello,\n\n' +
// 					'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
// 			};
// 			smtpTransport.sendMail(mailOptions, function (err) {
// 				return res.status(200).send({
// 					error: 'Success! Your password has been changed.', status: "success"
// 				});

// 				done(err);

// 			});
// 		}
// 	], function (err) {
// 		return res.status(500).send({
// 			error: 'error.', status: "error"
// 		});
// 	});

// }

exports.logout = function (req, res, next) {
	const datestamp = new Date();
	var log_id = req.body.log_id;
	console.log(log_id)
	mongo.connect(url, function (err, db) {
		db.collection('log').update({ log_id: log_id }, {
			$set: {
				logout_time: datestamp,
				status: 'logout',
			}
		}, function (err, result) {
			if (err) {
				res.send('false');
			}
			db.close();
			res.send(true);
		});
	});
}