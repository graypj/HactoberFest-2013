#!/usr/bin/env nodemon

var express = require('express');
var _ = require('underscore');
var socket = require('socket.io');
var http = require('http');
var packageInfo = require('./package.json');

var app = express();
var server = http.createServer(app);

var serverPort = process.env.VMC_APP_PORT || 3000;

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(express.bodyParser());
app.use(app.router);

app.use('/assets', express.static(__dirname + '/assets'));

app.get('/', function (request, response) {
    response.render('index');
});

server.listen(serverPort);

io = socket.listen(server);
io.sockets.on('connection', function (socket) {
    socket.on('join', function (room_id, user_name, fn) {
    });
});

console.log('Server is running at http://localhost:' + serverPort + ' (nodejs ' + process.version + ', ' + app.get('env') + ')');

