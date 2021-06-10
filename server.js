// flow
var schools = require("./api_components/schools.js");
var exam_schedule = require("./api_components/exam_schedule.js");
var exams = require("./api_components/exams.js");
var library = require("./api_components/library.js");
var timetable = require("./api_components/timetable.js");
var transport = require("./api_components/transport.js");
var busroute = require("./api_components/busroute.js");
var station_and_routes = require("./api_components/station_and_routes.js");
var school_classes = require("./api_components/school_classes.js");
var class_sections = require("./api_components/class_sections.js");
var students = require("./api_components/students.js");
var subjects = require("./api_components/subject.js");
var course_works = require("./api_components/course_work.js");
var attendance = require("./api_components/attendance.js");
var attendanceDate = require("./api_components/AttendanceByDate_classes.js");
var Emp_attendance = require("./api_components/Emp_attendance.js");
var Employee_attendance_chart = require("./api_components/Employee_attendance_chart.js");
var employee = require("./api_components/employee.js");
var teachers = require("./api_components/teacher.js");
var assesment = require("./api_components/assesment.js");
var assignment = require("./api_components/assigments.js");
var fee_types = require("./api_components/fee_types.js");
var vehicles = require("./api_components/vehicles.js");
var attendance_charts = require("./api_components/AttendanceChart.js");
var parent = require("./api_components/parent.js");
var parent_student = require("./api_components/parent_student.js");
var examgraph = require("./api_components/examgraph.js");
var messages = require("./api_components/messages.js");
var quizz = require("./api_components/quizz.js");
var store = require("./api_components/store.js");
var payments = require("./api_components/payments.js");
var assignTask = require("./api_components/AssignTask.js");
var noticeboard = require("./api_components/noticeboard.js");
var school_event = require("./api_components/schoolevent.js");
var uploads = require("./api_components/uploads.js");
var session_timings = require("./api_components/session_timings.js");
var grades = require("./api_components/grades.js");
var Assessment_pattern = require("./api_components/Assessment_pattern.js");
var classTests = require("./api_components/classTests.js");
var projectworks = require("./api_components/projectworks.js");
var bulkUploads = require("./api_components/bulkuploads.js");
var payment_gateway = require("./api_components/payment_gateway.js");
const chats = require('./api_components/chat.js');
const Authentication = require('./controllers/authentication');
const passportService = require('./services/passport');
const passport = require('passport');
const sendSms = require('./api_components/send_sms');
var communications = require('./api_components/communications.js');
var extracircular = require("./api_components/extracircular.js");
var notifications = require("./api_components/notifications.js");
var email = require("./api_components/email.js");

const requireAuth = passport.authenticate('jwt', { session: false });
const requireSignin = passport.authenticate('local', { session: false });

var config = require("./config.json");
var express = require("express");
var bodyParser = require("body-parser");

var app = express();
var server = require('http').createServer(app);
var api_key = "api-key-KJFSI4924R23RFSDFSD7F94";
var mongo = require('mongodb').MongoClient;
const mongoose = require('mongoose');
var objectId = require('mongodb').ObjectID;
var assert = require('assert');
var port = process.env.PORT || 4005;
var router = express.Router();
var fs = require("fs");
var url = config.dburl;
// DB Setup for Auth
mongoose.connect('mongodb://13.126.140.230:27017/auth');
var cookieParser = require('cookie-parser');
app.use(cookieParser());

// app.use(bodyParser.urlencoded({
//     extended: false
// }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false, parameterLimit: 10000 }));


app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

router.use(function (req, res, next) {
    // do logging
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Authorization, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST , GET , OPTIONS , DELETE , EDIT, PUT");
    next(); // make sure we go to the next routes and don't stop here
});

app.use(function (req, res, next) {
    // do logging
    res.header("Access-Control-Allow-Origin", "*");
    // res.header("Access-Control-Allow-Origin", "https://proschool.co.in/#/login");
    res.header('Access-Control-Allow-Credentials', true);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Authorization, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST , GET , OPTIONS , DELETE , EDIT, PUT");
    next(); // make sure we go to the next routes and don't stop here
});

app.get('/', function (req, res) {
    res.send('School ERP API');
});


app.get('/secure', requireAuth, function (req, res) {
    res.send('School ERP API -  Authorised Page');
});

app.post('/signin', requireSignin, Authentication.signin);
app.post('/logout', Authentication.logout);

app.post('/signup', Authentication.signup);
app.post('/checkemail', Authentication.checkEmail);
app.post('/forgotpassword', Authentication.forgotPassword);
app.post('/checkEmailOTP', Authentication.checkEmailOTPToken);
// app.get('/reset/:token', Authentication.checkResetToken);
app.post('/resetpassword', Authentication.updatePasswordWithToken);

app.get('/api/getChats/:unique_id', chats.getChats);
app.get('/getChatDetails/:chat_id', chats.getChatDetails);
app.post('/createRoom', chats.createRoom);

const path = require('path');
var key = fs.readFileSync(path.resolve(__dirname, './cert/8e6023025cea66cc.pem'));
var cert = fs.readFileSync(path.resolve(__dirname, './cert/8e6023025cea66cc.pem'));
var ca = fs.readFileSync(path.resolve(__dirname, './cert/gd_bundle-g2-g1.pem'));

const https = require("https");
https.createServer({ key: key, cert: cert, ca: ca }, app).listen(port);

const http = require("http").createServer(app);

// const privateKey = fs.readFileSync('/etc/letsencrypt/live/proschool.co.in/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('/etc/letsencrypt/live/proschool.co.in/cert.pem', 'utf8');
// const ca = fs.readFileSync('/etc/letsencrypt/live/proschool.co.in/chain.pem', 'utf8');

// const credentials = {
// 	key: privateKey,
// 	cert: certificate,
// 	ca: ca
// };

const io = require("socket.io").listen(http);
const notification = io.of('/notifications');
const message = io.of('/messages');
const chat_msg = io.of('/chat');

app.set('socketio', io);
app.set('not_socketio', notification);
app.set('msg_socketio', message);
app.set('chat_socketio', chat_msg);

// const board = require("./api_components/board")(io);
const chat = require("./api_components/chat")(io);
// http.listen(8080);

http.listen(port, () => console.log('listening on port ' + port));

// https.listen(4000, () => console.log('listening on port ' + 4000));

app.use('/api', schools);
app.use('/api', exams);
app.use('/api', library);
app.use('/api', timetable);
app.use('/api', transport);
app.use('/api', busroute);
app.use('/api', station_and_routes);
app.use('/api', exam_schedule);
app.use('/api', school_classes);
app.use('/api', class_sections);
app.use('/api', teachers);
app.use('/api', students);
app.use('/api', subjects);
app.use('/api', course_works);
app.use('/api', attendance);
app.use('/api', attendanceDate)
app.use('/api', Emp_attendance);
app.use('/api', Employee_attendance_chart);
app.use('/api', employee);
app.use('/api', assesment);
app.use('/api', quizz);
app.use('/api', store);
app.use('/api', payments);
app.use('/api', assignTask);
app.use('/api', fee_types);
app.use('/api', assignment);
app.use('/api', vehicles);
app.use('/api', parent);
app.use('/api', parent_student);
app.use('/api', attendance_charts);
app.use('/api', examgraph);
app.use('/api', noticeboard);
app.use('/api', school_event);
app.use('/api', uploads);
app.use('/api', messages);
app.use('/api', session_timings);
app.use('/api', grades);
app.use('/api', Assessment_pattern);
app.use('/api', classTests);
app.use('/api', projectworks);
app.use('/api', bulkUploads);
app.use('/api', payment_gateway);
app.use('/api', router);
app.use('/api', sendSms);
app.use('/api', communications);
app.use('/api', extracircular);
app.use('/api', notifications);
app.use('/api', email);