var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var session = require('express-session');
var fs = require("fs")

app.set('views', __dirname +'/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use('/public', express.static(__dirname + '/public'));


var server = app.listen(3001, function(){
 console.log("Express server has started on port 3001")
});

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.use(session({
 secret: '@#@$MYSIGN#@$#$',
 resave: false,
 saveUninitialized: true
}));

app.get('/',function(req,res){
  res.render('test');
});
app.get('/game',function(req,res){
  res.render('game');
});
//var router = require('./router/main')(app, fs);
