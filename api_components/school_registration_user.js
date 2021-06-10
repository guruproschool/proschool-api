const jwt = require('jwt-simple');
const User = require('../models/user');
var express = require("express");
var config = require("../config.json");
var emailregex = require('regex-email');
var router = express.Router();
var mongo = require('mongodb').MongoClient;
var url = config.dburl;
var schoolUserModule = function () { };

function tokenForUser(user) {
	const timestamp = new Date().getTime();
	return jwt.encode({
		sub: user._id,
		unid: user.uniqueId,
		role: user.role,
		school_id: user.school_id,
		iat: timestamp
	}, "ex23hf9284y9er2ehfbdbvcv83yehrdf8273");
}

schoolUserModule.prototype.addAdminToSchool = function (req, res) {
	const email = req.email;
	const password = req.password.toLowerCase();
	const phone = req.phone;
	const uniqueId = req.uniqueId;
	const role = req.role;
	const school_id = req.school_id;
	var schools = [];
	schools.push(school_id)

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
		email: email
	}, function (err, existingUser) {
		console.log({'user':existingUser})
		if (err) {
			res.send('false1');
			console.log(err)
		} else {
			// If a user with email does exist, return an error
			if (existingUser) {
				res.send('User Details Already Exists');
				// console.log(existingUser)
			} else {
				// If a user with email does Not exists, create and save user record
				const user = new User({
					email: email,
					phone: phone,
					login: email,
					password: password,
					uniqueId: uniqueId,
					role: role,
					school_id: school_id,
					schools: schools,
					otp: 0,
					otp_expiry: "",
					status: 1
				});

				user.save(function (err) {
					if (err) {
						res.send('false2');
						console.log(err)
					} else {
						// Respond to request indicating the user was created
						res.json({
							token: tokenForUser(user)
						});
					}
				});
			}
		}
	});
}
module.exports = new schoolUserModule();