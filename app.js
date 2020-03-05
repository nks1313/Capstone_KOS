var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var robot = require('robotjs');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var create_account_eos = require('./router/create_account_eos');
var router = express.Router();
var fs = require("fs")
var mysql = require('mysql');
/*
var dbconfig = {
      host:'kiseonbus.cgxsy1aopkq7.us-east-2.rds.amazonaws.com',
      user:'kiseon',
      password:'rltjsqjtm',
      database:'KOS'
};
var db = mysql.createConnection(dbconfig);
db.connect();*/
app.set('views', __dirname +'/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use('/public', express.static(__dirname + '/public'));

var server = app.listen(3000, function(){
 console.log("Express server has started on port1 3000")
});

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use('/create_account_eos', create_account_eos);

app.use(cookieParser());
app.use(session({
 secret: '@#@$MYSIGN#@$#$',
 resave: false,
 saveUninitialized: true,
 cookie: {
    maxAge: 24000 * 60 * 60 // 쿠키 유효기간 24시간
  }
}));
app.use(function(req, res, next) {
  res.locals.user = req.session.user;
  next();
});
var payment = require('./router/payment');
var result_page = require('./router/result_page');
var result_page_login = require('./router/result_page_login');
var logout = require('./router/logout');
var playgame = require('./router/playgame');
app.use('/result_page', result_page);
app.use('/result_page_login', result_page_login);
app.use('/payment', payment);
app.use('/logout', logout);
app.use('/playgame', playgame);

app.post('/mouse_move', function(req, res){
  if(req.body.eventType == 'mousedown') {
    if(req.body.LorR == 'left') {
      robot.mouseToggle("down");
    }
    else {
      robot.mouseToggle("down","right");
    }
    console.log("mousedown");
  }
  else if(req.body.eventType == 'mousemove') {
    robot.moveMouse(req.body.mouseX * 1920 / 600, req.body.mouseY * 1080 / 600);
  }
  else if(req.body.eventType == 'mouseup')  {
    if(req.body.LorR == 'left') {
      robot.mouseToggle("up");
    }
    else {
      robot.mouseToggle("up","right");
    }
  }
  else if(req.body.eventType == 'keydown')  {
    robot.keyToggle(req.body.key,"down");
    console.log("keydown");
  }
  else {
    robot.keyToggle(req.body.key,"up");
    console.log("keyup");
  }
  //console.log('x = ' + req.query.mouseX + '/ y = ' + req.query.mouseY);
  res.json({'status' : 'OK'});
})

/*
app.get('/mouse_move', function(req, res){
  if(req.query.eventType == 'mousemove') {
    robot.moveMouse(req.query.mouseX * 1920 / 600, req.query.mouseY * 1080 / 600);
  }
  //console.log('x = ' + req.query.mouseX + '/ y = ' + req.query.mouseY);
  res.json({'status' : 'OK'});
})
*/

app.get('/',function(req,res){
  if(req.cookies){
        console.log(req.cookies);
  }
  res.render('index');
});

app.get('/game',function(req,res){
  res.render('game');
});
app.get('/indexClient',function(req,res){
  res.render('indexClient');
});
app.get('/indexClient2',function(req,res){
  res.render('indexClient2');
});
app.get('/indexServer',function(req,res){
  res.render('indexServer');
});
app.get('/game',function(req,res){
  res.render('game');
});

app.get('/login',function(req,res){
  if(req.session.user)
    res.redirect('/');
  else res.render('login');
});

app.get('/signup',function(req,res){
  if(req.session.user)
    res.redirect('/');
  res.render('signup');
});

app.get('/createaccount',function(req,res){
  res.render('createaccount');
});

app.get('/payment',function(req,res){
  res.render('payment');
});
app.get('/pricetable',function(req,res){
  res.render('pricetable');
});
//var router = require('./router/main')(app, fs);
