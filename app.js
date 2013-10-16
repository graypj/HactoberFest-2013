#!/usr/bin/env nodemon

var express = require('express');
var _ = require('underscore');
var moment = require('moment');
var socket = require('socket.io');
var http = require('http');
var packageInfo = require('./package.json');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var app = express();
var server = http.createServer(app);

var serverPort = process.env.VMC_APP_PORT || 3000;

var cacheDir = __dirname + '/cache';

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
    },

    lowes: {
        passkey: 'hbukjmqhwuqztspp2kbwy7vfe'
    },

    homedepot: {
        passkey: 'm7lebkidnsp30y9y8n9l1ay4y'
    },

    bestbuy: {
        passkey: 'bazm2nnzvt3t6q4i6pvq98xv3'
    },

    directbuy: {
        passkey: 'b9nlbqyykw8ykatyy4pzp5zgv'
    },

    maytag: {
        passkey: '2ce2dpzbzpexo9wyo29zc6eia'
    },

    LG: {
        passkey: '9tk3h2yh2dfi0ffc6m43kmv03'
    },

    geappliances: {
        passkey: 'puj4ut2luo7quh90y76itk63x'
    }
};

function cacheResult(key, callback, loader) {
    var cacheFile = path.join(cacheDir, key);

    var successCb = function (data) {
        var jsonData = _.isString(data) ? JSON.parse(data) : data;
        callback(null, jsonData);
    };

    var loadDataCb = function () {
        loader(function (err, data) {
            if (err) {
                callback(err);
                return;
            }

            mkdirp(path.dirname(cacheFile), function (err) {
                if (err) {
                    console.log(err);
                    successCb(data);
                    return;
                }

                console.log("Storing cache file: " + cacheFile);
                fs.writeFile(cacheFile, _.isString(data) ? data : JSON.stringify(data), { encoding: 'utf-8' }, function (err) {
                    if (err) {
                        console.log(err);
                    }

                    successCb(data);
                });
            });
        });
    };

    fs.exists(cacheFile, function (exists) {
        if (exists) {
            console.log("Loading cache file: " + cacheFile);
            fs.readFile(cacheFile, { encoding: 'utf-8' }, function (err, data) {
                if (err) {
                    console.log(err);
                    loadDataCb();
                    return;
                }

                try {
                    successCb(data);
                } catch (e) {
                    console.log(e);
                    loadDataCb();
                }
            });
        } else {
            console.log("Cache file not found: " + cacheFile);
            loadDataCb();
        }
    });
}

function getJson(url, callback) {
    console.log(url);

    http.get(url,function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            callback(null, JSON.parse(body));
        });
    }).on('error', function (err) {
            callback(err);
        });
}

function getRelatedProducts(client, product, callback) {
    var cacheKey = path.join(client, product, 'related.json');
    var relatedProds = [];
    var expectedCount = 0;
    var cacheCallback = null;

    var addRelatedProds = function (err, result) {
        if (result.products && result.products.length > 0) {
            result.products.forEach(function (relatedProd) {
                if (relatedProd.client !== client && relatedProd.externalId !== product && !_.find(relatedProds, function (a) { return a.client === relatedProd.client && a.externalId === relatedProd.externalId; })) {
                    console.log(client + ":" + product, relatedProd);
                    relatedProds.push(relatedProd);
                    loadRelatedProducts(relatedProd.client, relatedProd.externalId);
                }
            });
        }

        expectedCount -= 1;
        if (expectedCount === 0) {
            cacheCallback(null, {products: relatedProds});
        }
    };

    var loadRelatedProducts = function (clientName, productName) {
        var baseUrl = 'http://oracle.bazaar.prod.us-east-1.nexus.bazaarvoice.com:7170/api/1/product/' + clientName + '/' + productName;

        expectedCount += 3;
        getJson(baseUrl + '/destinations', addRelatedProds);
        getJson(baseUrl + '/sources', addRelatedProds);
        getJson(baseUrl + '/related', addRelatedProds);
    };

    cacheResult(cacheKey, callback, function (callback) {
        cacheCallback = callback;
        loadRelatedProducts(client, product);
    });
}

function getReviewData(client, product, date, callback) {
    var clientInfo = clients[client];

    if (!clientInfo) {
        callback({statusCode: 404, message: "Unknown client: " + client});
        return;
    }

    var cacheKey = path.join(client, product, date.format('YYYY-MM'), date.format('YYYY-MM-DD') + '-reviews.json');
    cacheResult(cacheKey, callback, function (callback) {
        var url = "http://" + client + ".ugc.bazaarvoice.com/data/reviews.json?" +
            "PassKey=" + clientInfo.passkey +
            "&ApiVersion=5.4" +
            "&filter=productid:" + product +
            "&filteredstats=reviews" +
            "&include=products" +
            "&filter=submissiontime:lt:" + moment(date).add('days', 1).unix();

        console.log(url);

        http.get(url,function (res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                callback(null, body);
            });
        }).on('error', function (err) {
                callback(err);
            });
    });
}

function getSyndicatedReviewData(client, product, date, callback) {
    var clientInfo = clients[client];

    if (!clientInfo) {
        callback({statusCode: 404, message: "Unknown client: " + client});
        return;
    }

    var cacheKey = path.join(client, product, date.format('YYYY-MM'), date.format('YYYY-MM-DD') + '-syndicated-reviews.json');
    cacheResult(cacheKey, callback, function (callback) {
        var url = "http://" + client + ".ugc.bazaarvoice.com/data/reviews.json?" +
            "PassKey=" + clientInfo.passkey +
            "&ApiVersion=5.4" +
            "&filter=productid:" + product +
            "&filter=submissiontime:lt:" + moment(date).add('days', 1).unix() +
            "&filter=isSyndicated:true";

        console.log(url);

        http.get(url,function (res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                callback(null, body);
            });
        }).on('error', function (err) {
                callback(err);
            });
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

        getSyndicatedReviewData(req.params.client, req.params.product, date, function (err, syndicatedData) {
            if (err) {
                if ('statusCode' in err) {
                    res.send(err.statusCode, 'Request error');
                } else {
                    res.send(500, 'Request error');
                }

                return;
            }

            getRelatedProducts(req.params.client, req.params.product, function (err, related) {
                if (err) {
                    console.log(err);
                    res.send(500, 'Internal error');
                    return;
                }

                var prodInfo = data.Includes.Products ? data.Includes.Products[req.params.product] : null;
                var reviewStats = { AverageOverallRating: 0, TotalReviewCount: 0, SecondaryRatingsAveragesOrder: [] };

                if (prodInfo) {
                    reviewStats = prodInfo.FilteredReviewStatistics;
                }

                var result = {
                    date: date.format('YYYY-MM-DD'),
                    id: req.params.product,
                    client: { id: req.params.client },
                    reviews: {
                        count: reviewStats.TotalReviewCount,
                        syndicatedCount: syndicatedData.TotalResults,
                        rating: reviewStats.AverageOverallRating,
                        secondaryRatings: []
                    },
                    related: related
                };

                reviewStats.SecondaryRatingsAveragesOrder.forEach(function (name) {
                    var rating = reviewStats.SecondaryRatingsAverages[name];

                    result.reviews.secondaryRatings.push({
                        id: rating.Id,
                        rating: rating.AverageRating
                    });
                });

                res.send(result);
            });
        });

    });
});

server.listen(serverPort);

io = socket.listen(server);
io.sockets.on('connection', function (socket) {
    socket.on('join', function (room_id, user_name, fn) {
    });
});

console.log('Server is running at http://localhost:' + serverPort + ' (nodejs ' + process.version + ', ' + app.get('env') + ')');

