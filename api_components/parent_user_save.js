const User = require('../models/user');
var express = require("express");
var config = require("../config.json");
var emailregex = require('regex-email');
var router = express.Router();
var mongo = require('mongodb').MongoClient;
var url = config.dburl;
var forEach = require('async-foreach').forEach;

var parentUserModule = function() {};

parentUserModule.prototype.parentUserModuleSave = function (request, res) {
	var counter = 0;
	request.forEach( function (req) {
		const email = req.email;
		const phone = req.phone;
		const login = req.login;
		const password = req.password.toLowerCase();
		const uniqueId = req.uniqueId;
		const role = req.role;
		const school_id = req.school_id;
		const schools = [];
		schools.push(school_id);
		console.log(req)
	
		if (!email || !password) {
			// return res.status(422).send({
			// 	error: 'You must provide email and password'
			// });
		}
	
		if (emailregex.test(email) != true) {
			// return res.status(422).send({
			// 	error: 'Not a valid email'
			// });
		}
	
		// See if a user with the given email exists
		User.findOne({
			phone: phone, 
			role: "parent",
		}, function (err, existingUser) {
			if (err) {
				// return next(err);
			}
	
			// If a user with email does exist, return an error
			if (existingUser) {
	
				var count = 0;
				existingUser.schools.forEach( function(schooldata) {
					var schoolId = schooldata;
					if(schoolId === school_id) {
						count++;
					}
				})
	
				if(count > 0) {
					User.update({
						"phone": phone
					}, {
						"$addToSet": {
							"schools": school_id
						}
					})
				}
			}	
			// If a user with email does Not exists, create and save user record
			const user = new User({
				email: email,
				phone: phone, 
				login: login,
				password: password,
				uniqueId: uniqueId,
				role: role,
				school_id: school_id,
				schools: schools,
				otp : 0,
				otp_expiry : "",
				status: 1
			});
	
			user.save(function (err) {
				counter++
				if (err) {
					res.send('false5');
					console.log(err);
				} else {
					if(counter === request.length) {
						res.send({ status: 'true', id: uniqueId });
					}
				}
				// Respond to request indicating the user was created
				// res.json({
				// 	token: tokenForUser(user)
				// });
			});
		});
	})
}
module.exports = new parentUserModule();