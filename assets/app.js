var date = moment('2012-01-01');
var today = moment();
var trackingKey = null;
var runningAuto = false;
var chartsUpdatedCount = 0;
var productsCount = 0;

var interval = {
    type: 'weeks',
    count: 2
};
var scatterChartElement;
var scatterDataList = [];
var scatterChart;
var syndicationCharts = [];
var rivallist = [{client:"maytag", product:"MHWE201YW-NAR"}, {client:"LG", product:"MD00002347"}, {client:"geappliances", product:"GTWN4250DWS"}];

function showDetail(data) {
    var content = '<h1 class="ui dividing header">' + data.client.id + ' <span style="font-size: 0.7em; font-style:italic; font-weight:normal">' + data.id + '</span></h1>';

    content += '<table class="ui sortable table segment">';
    content += '<tbody>';
    content += '<tr>';
    content += '<td>Reviews</td>';
    content += '<td>' + data.reviews.count + '</td>';
    content += '</tr>';
    content += '<tr>';
    content += '<td style="padding-left: 50px;">Syndicated</td>';
    content += '<td>' + data.reviews.syndicatedCount + '</td>';
    content += '</tr>';
    content += '<tr>';
    content += '<td style="padding-left: 50px;">Native</td>';
    content += '<td>' + (data.reviews.count - data.reviews.syndicatedCount) + '</td>';
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
        content += '<td><div id="rating_' + info.id + '" style = "display: inline-block"></div> ' + info.rating.toFixed(1) + '</td>';
        content += '</tr>';
    });
    content += '</tbody></table>';

    document.getElementById('detail').innerHTML = content;

    data.reviews.secondaryRatings.forEach(function (info) {
        $('#rating_' + info.id).raty({score: info.rating, readOnly: true, width: 150, path: 'assets/img' });
    });
}

var groupings = {
    client0: {
        shape: 'circle',
        color: 'red'
    },

    client1: {
        shape: 'triangle-up',
        color: 'green'
    },

    client2: {
        shape: 'cross',
        color: 'green'
    },

    client3: {
        shape: 'square',
        color: 'green'
    },

    client4: {
        shape: 'diamond',
        color: 'green'
    }
};

var nextColorIndex = 0;

function nextColor() {
    return nv.utils.defaultColor()({}, nextColorIndex++);
}

function getColorFor(group) {
    if (!groupings[group]) {
        groupings[group] = {};
    }

    if (!groupings[group].color) {
        groupings[group].color = nextColor();
    }

    return groupings[group].color;
}

var products = {};

var product = function () {
    this.client = null;
    this.product = null;
    this.syndicationElement = null;
    this.syndication = [
        {key: 'Syndicated', values: []},
        {key: 'Native', values: []}
    ];
    this.keyed = {};
};

function getProductData(client, product, callback) {
    $.get('/api/clients/' + client + '/' + product + '?date=' + date.format('YYYY-MM-DD'),function (response) {
        callback(null, response);
    }).fail(callback);
}

function addDataObj(grouping, prodData, product) {
    var key = prodData.client.id + " [" + prodData.id + ']';
    var value = {
        x: prodData.reviews.count,
        y: prodData.reviews.rating,
        data: prodData,
        shape: groupings[grouping].shape,
        color: getColorFor(prodData.client.id)
    };

    var syndicationElement = {
        x: prodData.client.id,
        y: prodData.reviews.syndicatedCount,
        color: '#aec7e8'
    };
    var nativeElement = {
        x: prodData.client.id,
        y: prodData.reviews.count - prodData.reviews.syndicatedCount,
        color: '#798ba2'
    };

    if (key in product.keyed) {
        product.keyed[key].values[0] = value;
        product.syndication[0].values.forEach(function (d, i) {
            if (d.x == prodData.client.id) {
                product.syndication[0].values[i] = syndicationElement;
            }
        });
        product.syndication[1].values.forEach(function (d, i) {
            if (d.x == prodData.client.id) {
                product.syndication[1].values[i] = nativeElement;
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

    product.syndication[0].values.push(syndicationElement);
    product.syndication[1].values.push(nativeElement);
    scatterDataList.push(element);
    product.keyed[key] = element;
}

function loadProductData(curProduct) {
    $('#current_date').text(date.format('YYYY-MM-DD'));
    function updateCharts(grouping, client, product, callback) {
        getProductData(client, product, function (err, response) {
            if (err) {
                console.log(err);
                return;
            }
            addDataObj(grouping, response, curProduct);

            function loadVis() {
                scatterChartElement.call(scatterChart);
                nv.utils.windowResize(scatterChart.update);
                curProduct.syndicationElement.call(syndicationCharts[curProduct.chartid]);
                nv.utils.windowResize(syndicationCharts[curProduct.chartid].update);

                if (callback) {
                    callback();
                }
            }

            if (response.related && response.related.products && response.related.products.length > 0) {
                var count = response.related.products.length;

                response.related.products.forEach(function (relatedProd) {
                    getProductData(relatedProd.client, relatedProd.externalId, function (err, response) {
                        count -= 1;

                        if (!err) {
                            addDataObj(grouping, response, curProduct);
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


    function chartsUpdated() {
        chartsUpdatedCount += 1;

        if (chartsUpdatedCount == productsCount) {
            chartsUpdatedCount = 0;
            if (runningAuto) {
                setTimeout(function () {
                    $('#date_slider').labeledslider('value', $('#date_slider').labeledslider('value') + 1);
                }, 100);
            }
        }
    }

    updateCharts('client' + curProduct.chartid, curProduct.client, curProduct.product, chartsUpdated);
}


function loadAllProducts() {
    for (var p in products) {
        loadProductData(products[p]);
    }

}

function startAuto() {
    if (runningAuto) {
        return;
    }

    runningAuto = true;
    $('#date_slider').labeledslider('value', $('#date_slider').labeledslider('value') + 1);
}

function stopAuto() {
    runningAuto = false;
}

function addProduct() {
    var newProduct = new product();
    newProduct.chartid = productsCount;
    newProduct.client = $('#client-name-text').val();
    newProduct.product = $('#product-name-text').val();
    newProduct.key = newProduct.client + ' [' + newProduct.product + ']';
    products[newProduct.key] = newProduct;
    productsCount++;

    if (rivallist.length > 0){
        var nextProduct = rivallist.pop();
        $('#client-name-text').val(nextProduct.client);
        $('#product-name-text').val(nextProduct.product);
    }

    if (trackingKey == null) {
        trackingKey = newProduct.key;
    }
    $('#current-products').append('<dd>' + newProduct.client + ' : ' + newProduct.product + ' </dd>');
}
function loadProduct() {
    scatterChartElement = d3.select('#test1 svg').datum(scatterDataList);
    for (var pKey in products) {
        var p = products[pKey];
        $('#syndication').append('<div id = "svg_' + p.chartid + '" style="width:50%;display:inline-block" class = "colume"><p style="padding-left:50px">' + pKey + '</p></div>\n');
        d3.select("#svg_" + p.chartid).append("svg:svg").attr("height", "500px");
        nv.addGraph(function () {
            var syndicationChart = nv.models.multiBarChart()
                    .barColor(d3.scale.category20().range())
                    .forceY([0, 1000])
                    .margin({bottom: 100})
                    .transitionDuration(300)
                    .delay(0)
                ;

            syndicationChart.multibar
                .hideable(true);

            syndicationChart.yAxis
                .tickFormat(d3.format('d'));
            syndicationCharts.push(syndicationChart);
            return syndicationChart;
        });
    }
    for (var pKey in products) {
        var p = products[pKey];
        p.syndicationElement = d3.select('#svg_' + p.chartid + ' svg').datum(p.syndication);

    }
    loadAllProducts();
}

nv.addGraph(function () {
    scatterChart = nv.models.scatterChart()
        .forceY([0, 5])
        .forceX([0, 1000])
        .sizeRange([2000, 3000])
        .showDistX(true)
        .showDistY(true)
        //.color(['red', 'orange', 'yellow'])
        //.color(d3.scale.category10().range())
    ;

    scatterChart.scatter.onlyCircles(false);

    scatterChart.yAxis.tickFormat(d3.format('.02f'));
    scatterChart.scatter.dispatch.on('elementClick', function (e) {
        trackingKey = e.series.key;
        showDetail(e.point.data);
    });

    return scatterChart;
});


$(function () {
    var labels = [];
    var dates = [];
    var labelDate = moment(date);
    var count = 0;

    while (labelDate.isBefore(today)) {
        count += 1;
        labels.push(labelDate.format('YYYY-MM-DD'));
        dates.push(moment(labelDate));
        labelDate.add(interval.type, interval.count);
    }

    if (!labelDate.isSame(today)) {
        count += 1;
        dates.push(moment(today));
        labels.push(today.format('YYYY-MM-DD'));
    }

    $('#date_slider').labeledslider({
        min: 1,
        max: count,
        range: 'min',
        step: 1,
        tickInterval: 5,
        tickLabels: labels,
        slide: function (event, ui) {
            if (!dates[ui.value - 1].isSame(date)) {
                date = moment(dates[ui.value - 1]);
                loadAllProducts();
            } else {
                runningAuto = false;
            }
        },
        change: function (event, ui) {
            if (!dates[ui.value - 1].isSame(date)) {
                date = moment(dates[ui.value - 1]);
                loadAllProducts();
            } else {
                runningAuto = false;
            }
        }
    }).slider();
});
