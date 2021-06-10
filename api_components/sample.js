var express = require('express'); // Web Framework
var app = express();
var sql = require('mssql');// MS Sql Server client
var router = express.Router();

var bodyParser = require("body-parser");

router.use(bodyParser.json({ limit: '100mb' }));
router.use(bodyParser.urlencoded({ limit: '100mb', extended: false, parameterLimit: 10000 }));

var dbconncetion = require("./dbconnection.js");

var cookieParser = require('cookie-parser');

var sqlConfig = {
    user: 'sa',
    password: 'Jaasmith@4',
    server: 'localhost',
    database: 'sample_data',
    port: 1433

}
router.use(function (req, res, next) {
    // do logging
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next(); // make sure we go to the next routes and don't stop here
});

//Get API
router.route('/user')
    .get(function (req, res) {
        sql.connect(sqlConfig, function () {
            var request = new sql.Request();
            request.query('select * from hemababu', function (err, recordset) {
                if (err) console.log(err);
                res.send({ sampleData: recordset }); // Result in JSON format
            });
        });
    })

//POST API
router.route('/user')
    .post(function (req, res) {
        var id = req.body.id;
        var name = req.body.name;
        var near = req.body.near;
        var street = req.body.street;
        var city = req.body.city;


        sql.connect(sqlConfig, function () {
            var request = new sql.Request();

            request.query("INSERT INTO hemababu ([id],[name],[near],[street],[city]) VALUES ('" + id + "','" + name + "','" + near + "','" + street + "','" + city + "')", function (err, result, fields) {
                if (err) console.log(err);

                res.end(JSON.stringify(result));  // Result in JSON format
            });
        });
    });



//PUT API
router.route('/user/:id')
    .put(function (req, res) {

        sql.connect(sqlConfig, function () {
            var request = new sql.Request()
            request.query("UPDATE hemababu SET name= '" + req.body.name + "',near='" + req.body.near + "'  WHERE id= '" + req.params.id + "'", function (err, recordset) {
                if (err) console.log(err);
                res.send(JSON.stringify(recordset)); // Result in JSON format
            });
        });
    });

// DELETE API
router.route('/user/:id')
    .delete(function (req, res) {

        sql.connect(sqlConfig, function () {
            var request = new sql.Request();
            request.query("DELETE FROM hemababu WHERE id='" + req.params.id + "'", function (err, recordset) {
                if (err) console.log(err);
                res.end(JSON.stringify(recordset)); // Result in JSON format
            });
        });
    });

module.exports = router;



  /* app.js */
// var myApp = angular.module("sample", ['ngDialog', 'ui.router','smart-table','xeditable'])

/*route.js */
// myApp.config(function ($stateProvider, $urlRouterProvider, $locationProvider) {

//     $urlRouterProvider.otherwise("/sampleurl");

//     $stateProvider.state('sampleMain', {
//         url: "/sampleMain",
//         templateUrl: "app_components/sampleHtml.html",
//         controller: "sampleController"

//     })


// })


// /* index.html */
// <html ng-app="sample">

// <head>
//     <title>Sample Angular Project</title>
//     <meta charset="utf-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1">
//     <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
//     <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
//     <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
//     <script src="bower_components/angular/angular.min.js"></script>
//     <script src="bower_components/angular-ui-router/release/angular-ui-router.min.js"></script>
//     <link href="bower_components/ng-dialog/css/ngDialog-theme-default.min.css">
//     <link href="bower_components/ng-dialog/css/ngDialog.css">
//     <script src="bower_components/ng-dialog/js/ngDialog.js"></script>
//     <link href="bower_components/angular-xeditable/dist/css/xeditable.css" rel="stylesheet">
//     <script src="bower_components/angular-xeditable/dist/js/xeditable.js"></script>
//     <script src="bower_components/angular-smart-table/dist/smart-table.min.js"></script>
//     <link href="node_modules/font-awesome/css/font-awesome.css" rel="stylesheet">
//     <!-- <script src="node_modules/angular-font-awesome/dist/angular-font-awesome.js"></script>  -->
   
//     <script src="app.js"></script>
//     <script src="route.js"></script>

//     <script src="app_components/sampleController.js"></script>
//     <script src="app_components/sampleService.js"></script>
//     <link href="app_components/sampleHtml.html">




// </head>

// <body>
//     <nav class="navbar navbar-inverse" role="navigation">
//         <div class="navbar-header">
//             <a class="navbar-brand" ui-sref="#">AngularUI Router</a>
//         </div>
//         <ul class="nav navbar-nav">
//             <li>
//                 <a ui-sref="sampleMain">Home</a>
//             </li>
//             <li>
//                 <a ui-sref="about">About</a>
//             </li>
//         </ul>
//     </nav>
    
//     <div class="container">


//         <div ui-view></div>

//     </div>
// </body>

// </html>

/* sample.html */

// <html>
// <body>
//     <div class="col-md-12">
//         <div class="col-md-3" style="border:1px solid grey">
//             <h3>Add Sample Deatils</h3>
//             <div class="addclass">
//                 <div class="form-group" id="addclasses">
//                     <label>Id</label>
//                     <input class="form-control" placeholder="Enter..." ng-model="value.id" id="inputdefault" type="text">
//                 </div>
//                 <div class="form-group" id="addclasses">
//                     <label>Name</label>
//                     <input class="form-control" placeholder="Enter..." ng-model="value.name" id="inputdefault" type="text">
//                 </div>
//                 <div class="form-group" id="addclasses">
//                     <label>Near</label>
//                     <input class="form-control" placeholder="Enter..." ng-model="value.near" id="inputdefault" type="text">
//                 </div>
//                 <div class="form-group" id="addclasses">
//                     <label>Street</label>
//                     <input class="form-control" placeholder="Enter..." ng-model="value.street" id="inputdefault" type="text">
//                 </div>
//                 <div class="form-group" id="addclasses">
//                     <label>City</label>
//                     <input class="form-control" placeholder="Enter..." ng-model="value.city" id="inputdefault" type="text">
//                 </div>
//                 <div class="form-group">
//                     <button class="btn btn-primary active" ng-click="addSample(value)" style="background-color: #30104e;float: right;">Add Sample</button>
//                 </div>
//             </div>
//         </div>
//         <div class="col-md-9" style="border:1px solid grey">
//             <div class="table-responsive">
//                 <table export-table st-table="Sample_details" st-safe-src="sample_details" class="table rwd-table table-striped" style="width:100%">
//                     <tr>
//                         <th>srno</th>
//                         <th>dbid</th>
//                         <th>name</th>
//                         <th>near</th>
//                         <th>street</th>
//                         <th>city</th>
//                         <th>Action</th>
//                     </tr>
//                     <tbody>
//                         <tr st-select-row="row" st-select-mode="multiple" ng-repeat="sample in Sample_details" class="editable-row">
//                             <td>
//                                 {{sample.id+1}}
//                             </td>
//                             <td>
//                                 <span editable-text="sample.id" e-name="editdata.id" onaftersave="EditSample(sample,sample.dbId)" e-form="rowform" e-required>{{sample.dbId || 'empty' }}</span>
//                             </td>
//                             <td>
//                                 <span editable-text="sample.name" e-name="editdata.name" onaftersave="EditSample(sample,sample.dbId)" e-form="rowform" e-required>{{sample.name || 'empty' }}</span>
//                             </td>


//                             <td>
//                                 <span editable-text="sample.near" e-name="editdata.near" onaftersave="EditSample(sample,sample.dbId)" e-form="rowform" e-required>{{sample.near || 'empty' }}</span>
//                             </td>
//                             <td>
//                                 <span editable-text="sample.street" e-name="editdata.street" onaftersave="EditSample(sample,sample.dbId)" e-form="rowform"
//                                     e-required>{{sample.street || 'empty' }}</span>
//                             </td>

//                             <td>
//                                 <span editable-text="sample.city" e-name="editdata.city" onaftersave="EditSample(sample,sample.dbId)" e-form="rowform" e-required>{{sample.city || 'empty' }}</span>
//                             </td>


//                             <td>
//                                 <form editable-form name="rowform" ng-show="rowform.$visible" class="form-buttons form-inline" shown="inserted == sample">
//                                     <button type="submit" ng-click="EditSample(sample,sample.dbId)" ng-disabled="rowform.$waiting" class="btn btn-primary editable-table-button btn-xs">
//                                         <i class="fa fa-check"></i>
//                                     </button>
//                                     <button type="button" ng-disabled="rowform.$waiting" ng-click="rowform.$cancel()" class="btn btn-default editable-table-button btn-xs">
//                                         <i class="fa fa-remove"></i>
//                                     </button>
//                                 </form>

//                                 <div class="buttons" ng-show="!rowform.$visible">
//                                     <button class="btn btn-primary editable-table-button btn-xs" ng-click="rowform.$show()">
//                                         <i class="fa fa-pencil"></i>
//                                     </button>
//                                     <button class="btn btn-default btn-xs" data-toggle="tooltip" confirmed-click="DeleteSection(sections.id)" ng-confirm-click="Are you sure you want to delete this item?">
//                                         <i class="fa fa-trash" aria-hidden="true"></i>
//                                     </button>

//                                 </div>
//                             </td>
//                         </tr>
//                     </tbody>

//                 </table>
//             </div>

//         </div>

//     </div>

// </body>

// </html>