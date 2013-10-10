var date = moment('2013-01-01');
var today = moment();
var trackingKey;

var chartData = {
    list: [],
    syndication: [
        {key: 'Syndicated', values: []},
        {key: 'Native', values: []}
    ],
    keyed: {}
};

function showDetail(data) {
    var content = '<h1 class="ui dividing header">' + data.client.id + ' <span style="font-size: 0.7em; font-style:italic; font-weight:normal">' + data.id + '</span></h1>';

    content += '<table class="ui sortable table segment">';
    content += '<tbody>';
    content += '<tr>';
    content += '<td>Reviews</td>';
    content += '<td>' + data.reviews.count + '</td>';
    content += '</tr>';
    content += '<tr>';
    content += '<td>Rating</td>';
    content += '<td>' + data.reviews.rating + '</td>';
    content += '</tr>';
    content += '</tbody></table>';

    content += '<h3>Secondary Ratings</h3>';
    content += '<table class="ui sortable table segment">';
    content += '<thead><tr><th>Name</th><th>Rating</th></tr></thead>';
    content += '<tbody>';
    data.reviews.secondaryRatings.forEach(function (info) {
        content += '<tr>';
        content += '<td>' + info.id + '</td>';
        content += '<td>' + info.rating + '</td>';
        content += '</tr>';
    });
    content += '</tbody></table>';

    document.getElementById('detail').innerHTML = content;
}

function getProductData(client, product, callback) {
    $.get('/api/clients/' + client + '/' + product + '?date=' + date.format('YYYY-MM-DD'),function (response) {
        callback(null, response);
    }).fail(callback);
}

function addDataObj(prodData) {
    var key = prodData.client.id + " [" + prodData.id + ']';
    var value = {
        x: prodData.reviews.count,
        y: prodData.reviews.rating,
        data: prodData
    };

    var syndicationElement = {
        x: prodData.client.id + " [" + prodData.id + ']',
        y: prodData.reviews.syndicatedCount
    };
    var nativeElement = {
        x: prodData.client.id + " [" + prodData.id + ']',
        y: prodData.reviews.count - prodData.reviews.syndicatedCount
    };

    if (key in chartData.keyed) {
        chartData.keyed[key].values[0] = value;
        chartData.syndication[0].values.forEach(function (d, i) {
            if (d.x == key) {
                chartData.syndication[0].values[i] = syndicationElement;
            }
        });
        chartData.syndication[1].values.forEach(function (d, i) {
            if (d.x == key) {
                chartData.syndication[1].values[i] = nativeElement;
            }
        });

        if (key === trackingKey) {
            showDetail(value.data);
        }

        return;
    }

    var element = {
        key: key,
        values: [value]
    };

    if (key === trackingKey) {
        showDetail(value.data);
    }

    chartData.syndication[0].values.push(syndicationElement);
    chartData.syndication[1].values.push(nativeElement);
    chartData.list.push(element);
    chartData.keyed[key] = element;
}

function loadData(element, syndicationElement, client, product) {
    getProductData(client, product, function (err, response) {
        if (err) {
            console.log(err);
            return;
        }
        addDataObj(response);

        function loadVis() {
            element.call(chart);
            syndicationElement.call(syndicationInfoChart);
            nv.utils.windowResize(chart.update);
            nv.utils.windowResize(syndicationInfoChart.update);

            if (!date.isSame(today, 'day')) {
                date.add('weeks', 2);

                if (date.isAfter(today)) {
                    date = today;
                }

                setTimeout(function () {
                    loadData(element, syndicationElement, client, product);
                }, 500);
            }
        }

        if (response.related && response.related.products && response.related.products.length > 0) {
            var count = response.related.products.length;

            response.related.products.forEach(function (relatedProd) {
                getProductData(relatedProd.client, relatedProd.externalId, function (err, response) {
                    count -= 1;

                    if (!err) {
                        addDataObj(response);
                    }

                    if (count === 0) {
                        loadVis();
                    }
                });
            });
        } else {
            loadVis();
        }
    });
}

function loadProduct() {
    var clientName = $('#client-name-text').val();
    var productName = $('#product-name-text').val();

    trackingKey = clientName + ' [' + productName + ']';
    loadData(d3.selectAll('#test1 svg').datum(chartData.list), d3.selectAll('#test2 svg').datum(chartData.syndication), clientName, productName);
}

var chart;
nv.addGraph(function () {
    chart = nv.models.scatterChart()
        .forceY([0, 5])
        .forceX([0, 1000])
        .showDistX(true)
        .showDistY(true)
        .useVoronoi(true)
        .color(d3.scale.category10().range())
        .transitionDuration(300)
    ;

    //chart.xAxis.tickFormat(d3.format('.02f'));
    chart.yAxis.tickFormat(d3.format('.02f'));
    chart.scatter.dispatch.on('elementClick', function (e) {
        trackingKey = e.series.key;
        showDetail(e.point.data);
    });

    return chart;
});
var syndicationInfoChart;
nv.addGraph(function () {
    syndicationInfoChart = nv.models.multiBarChart()
        .barColor(d3.scale.category20().range())
        .forceY([0, 1000])
        .margin({bottom: 100})
        .transitionDuration(300)
        .delay(0)
    ;

    syndicationInfoChart.multibar
        .hideable(true);

    syndicationInfoChart.yAxis
        .tickFormat(d3.format('d'));
    return syndicationInfoChart;
});

