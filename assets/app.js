var date = moment('2013-01-01');
var today = moment();
var trackingKey = "";


function showDetail(secondaryRatings){
  var tooltip = "<h3>"+ trackingKey +"</h3>";
  secondaryRatings.forEach(function(info){
  tooltip += info.id + ": " + info.rating + "<br>"
    });
    document.getElementById('detail').innerHTML = tooltip;
}

function loadData(element) {
    $.get('/api/clients/whirlpool/WTW4950XW-NAR?date=' + date.format('YYYY-MM-DD'), function (response) {
        var data = [];
        var trackingElement;
		var tmpElement = {
            key: response.client.id + " " + response.id,
            values: [{
                x: response.reviews.count,
                y: response.reviews.rating,
                secondaryRatings: response.secondaryRatings
            }]
        };
        if (tmpElement.key == trackingKey) {
        	trackingElement = tmpElement;
        }
        data.push(tmpElement);

        element.datum(data)
               .call(chart);

        nv.utils.windowResize(chart.update);

        chart.dispatch.on('stateChange', function(e) { ('New State:', JSON.stringify(e)); });

        date.add('weeks', 2);
		if (trackingElement != undefined) {
			showDetail(trackingElement.values[0].secondaryRatings);
		}
        if (date.isBefore(today)) {
            setTimeout(function () {                
                loadData(element);                
            }, 1000);
        }
    });
}


var chart;
nv.addGraph(function() {
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
  chart.tooltipContent(function(key, x, y, e) {
      return '<h2>' + key + '</h2>';
  });
  chart.scatter.dispatch.on('elementClick', function(e){
    trackingKey = e.series.key;
    showDetail(e.point.secondaryRatings);
  });
  loadData(d3.selectAll('#test1 svg'));

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
