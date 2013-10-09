var date = moment('2013-01-01');

function loadData(element) {
    $.get('/api/clients/whirlpool/WTW4950XW-NAR?date=' + date.format('YYYY-MM-DD'), function (response) {
        var data = [];

        data.push({
            key: response.client.id + " " + response.id,
            values: [{
                x: response.reviews.count,
                y: response.reviews.rating
            }]
        });

        element.datum(data)
               .call(chart);

        nv.utils.windowResize(chart.update);

        chart.dispatch.on('stateChange', function(e) { ('New State:', JSON.stringify(e)); });

        //setTimeout(function () {
            //date.add('days', 15);
            //loadData(element);
        //}, 1000);
    });
}


var chart;
nv.addGraph(function() {
  chart = nv.models.scatterChart()
                .forceY([0, 5])
                .forceX([0, 50000])
                .showDistX(true)
                .showDistY(true)
                .useVoronoi(true)
                .color(d3.scale.category10().range())
                .transitionDuration(300)
                ;

  //chart.xAxis.tickFormat(d3.format('.02f'));
  chart.yAxis.tickFormat(d3.format('.02f'));
  chart.tooltipContent(function(key) {
      return '<h2>' + key + '</h2>';
  });

  loadData(d3.select('#test1 svg'));

  return chart;
});


function randomData(groups, points) { //# groups,# points per group
  var data = [],
      shapes = ['circle', 'cross', 'triangle-up', 'triangle-down', 'diamond', 'square'],
      random = d3.random.normal();

  for (i = 0; i < groups; i++) {
    data.push({
      key: 'Group ' + i,
      values: []
    });

    for (j = 0; j < points; j++) {
      data[i].values.push({
        x: random(), 
        y: random(), 
        size: Math.random(), 
        shape: shapes[j % 6]
      });
    }
  }

  return data;
}
