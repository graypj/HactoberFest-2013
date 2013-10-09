#!/usr/bin/env nodemon

var express = require('express');
var _ = require('underscore');
var moment = require('moment');
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

var clients = {
    whirlpool: {
        passkey: 'pgzm9csuh2t0v1w6xthgxwe22'
    }
};

function getReviewData(client, product, date, result) {
    var clientInfo = clients[client];

    if (!clientInfo) {
        result({code: 400, message: "Unknown client: " + client});
        return;
    }

    var url = "http://" + client + ".ugc.bazaarvoice.com/data/reviews.json?" +
                    "PassKey=" + clientInfo.passkey +
                    "&ApiVersion=5.4" +
                    "&filter=productid:" + product +
                    "&filteredstats=reviews" +
                    "&include=products" +
                    "&filter=submissiontime:lt:" + moment(date).add('days', 1).unix();

    console.log(url);

    http.get(url, function (res) {
        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            result(null, JSON.parse(body));
        });
    }).on('error', function (err) {
        result(err);
    });
}

app.get('/api/clients/:client/:product', function (req, res) {
    var date = moment(req.query.date);

    if (!req.query.date || !date.isValid()) {
        res.send(400);
        return;
    }

    date = date.startOf('day');

    getReviewData(req.params.client, req.params.product, date, function (err, data) {
        if (err) {
            if ('statusCode' in err) {
                res.send(err.statusCode, 'Request error');
            } else {
                res.send(500, 'Request error');
            }

            return;
        }

        //console.log(data);

        var prodInfo = data.Includes.Products[req.params.product];
        var reviewStats = prodInfo.FilteredReviewStatistics;

        var result = {
            date: date.format('YYYY-MM-DD'),
            id: req.params.product,
            client: { id: req.params.client },
            reviews: {
                count: reviewStats.TotalReviewCount,
                rating: reviewStats.AverageOverallRating
            },
            secondaryRatings: []
        };

        reviewStats.SecondaryRatingsAveragesOrder.forEach(function (name) {
            var rating = reviewStats.SecondaryRatingsAverages[name];

            result.secondaryRatings.push({
                id: rating.Id,
                rating: rating.AverageRating
            });
        });

        res.send(result);
    });
});

server.listen(serverPort);

io = socket.listen(server);
io.sockets.on('connection', function (socket) {
    socket.on('join', function (room_id, user_name, fn) {
    });
});

console.log('Server is running at http://localhost:' + serverPort + ' (nodejs ' + process.version + ', ' + app.get('env') + ')');

