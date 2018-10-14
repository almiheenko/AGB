var chromosomeView, xAxis, zoom, aligns, selectedAlign, selectedAlignId, tooltipDiv;
var chromHeight = 30;

function addRefView() {
    if (chromViewWidth === 0) return;
    if (typeof(chromosomeView) === 'undefined') {
        var chart = d3.select('#refView')
            .append('svg:svg')
            .attr('width', chromViewWidth + 20)
            .attr('height', chromHeight + 20)
            .attr('pointer-events', 'all');
        chromosomeView = chart.append('g')
            .attr('width', chromViewWidth)
            .attr('height', chromHeight)
            .attr('id', 'chromosomeMain');
        chromosomeView.append('rect')
            .attr('class', 'chromBg')
            .attr('width', chromViewWidth)
            .attr('height', chromHeight);
        xAxis = chromosomeView.append("g")
          .attr("transform", "translate(0," + chromHeight + ")");

        zoom = d3.zoom()
            .scaleExtent([1, 32])
            .translateExtent([[0, 0], [chromViewWidth, chromHeight]])
            .extent([[0, 0], [chromViewWidth, chromHeight]])
            .on("zoom", zoomFunction);
        chromosomeView.call(zoom);

        tooltipDiv = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    }
    else {
        chromosomeView.select('.chromBg')
            .attr('width', chromViewWidth);
    }
}

function updateRefView() {
    var curChrom = chromosomes[componentN];
    var chromLen = chrom_lengths[curChrom];
    xScale = d3.scaleLinear()
            .domain([0, chromLen])
            .range([0, chromViewWidth]);
    var maxZoom = Math.max(1, chromLen / 1000);
    zoom.scaleExtent([1, maxZoom]);
    var tickValue = getTickValue(chromLen);
    xAxis.call(d3.axisBottom(xScale).tickFormat(function (d) {
                d = Math.round(d);
                if (tickValue == 'Gbp')
                    d = d / 1000000000;
                else if (tickValue == 'Mbp')
                    d = d / 1000000;
                else if (tickValue == 'kbp')
                    d = d / 1000;
                return d >= 1 || d == 0 ? d.toFixed(0) : d.toFixed(2);
            }));
    var lastTick = chromosomeView.selectAll(".tick").nodes()[chromosomeView.selectAll(".tick").size() - 1];
    var lastTickText = d3.select(lastTick).select('text');
    lastTickText.text(lastTickText.text() + ' ' + tickValue);

    chromosomeView.selectAll('.align').remove();
    if (chromAligns && chromAligns[curChrom]) {
        aligns = chromosomeView.append('g').selectAll('.align')
                    .data(chromAligns[curChrom])
                    .enter().append('rect')
                    .attr('id', function (align) {
                        return 'align_' + align.edge;
                    })
                    .attr('class', function (align) {
                        return align.ms.length === 0 ? align.edge + ' align correct' : align.edge + ' align wrong';
                    })
                    .attr('transform', function (align) {
                        return 'translate(' + xScale(align.s) + ',0)';
                    })
                    .attr('width', function (align) {
                        return xScale(align.e) - xScale(align.s);
                    })
                    .attr('height', chromHeight);
        aligns.on('click', function (align) {
            selectAlign(align, this);
        })
              .on("mouseover", function(align) {
                   tooltipDiv.transition()
                       .delay(500)
                     .duration(200)
                     .style("opacity", .9);
                   numMisassemblies = align.ms.length == 0 ? 0 : (align.ms.indexOf(';') !== -1 ? 2 : 1);
                   misassembliesText = "";
                   if (align.ms.length > 0) {
                       misassemblies = align.ms.split(';');
                       misTypes = [];
                       for (var i=0; i< misassemblies.length; i++) {
                           misTypes.push(misassemblies[i].split(',')[0]);
                       }
                       misassembliesText = misTypes.join(', ')
                   }
                   else misassembliesText = "No misassemblies";
                   tooltipDiv.html("<b>Edge:</b> " + edgeData[align.edge].name +
                       "<br> <b>Aligned to:</b> " + align.s + "-" + align.e +
                       "<br> " + misassembliesText)
                     .style("left", (d3.event.pageX) + "px")
                     .style("top", (d3.event.pageY - 28) + "px");

                   var selectedItem = d3.select(this);
                   chromosomeView.append('rect')
                        .attr('class', 'glow')
                        .attr('pointer-events', 'none')
                        .attr('width', selectedItem.attr('width'))
                        .attr('height', selectedItem.attr('height'))
                        .attr('fill', 'white')
                        .attr('opacity', .3)
                        .attr('transform', selectedItem.attr('transform'));
               })
              .on("mouseout", function() {
                   tooltipDiv.transition()
                     .duration(300)
                     .style("opacity", 0);
                   chromosomeView.select('.glow').remove();
               });
        if (selectedAlign) selectAlign(selectedAlign);
    }
}

function selectAlign(align, selectedAlign) {
    deselectEdge();
    if (edgeData[align.edge]) {
        edge = edgeData[align.edge];
        edgeLink = '<a onclick="selectEdgeByLabel(\'' + edge.name + '\')">' + edge.name + '</a>';
    }
    else edgeLink = align.edge;
    d3.selectAll('.align').classed("selected", false);
    document.getElementById('node_info').innerHTML = "Alignment: edge " + edgeLink + ", " + align.s + "-" + align.e +
        (align.ms.length > 0 ? "<br>Misassemblies: " + align.ms : "");
    d3.select(selectedAlign).classed("selected", true);
}

function zoomFunction(){
  var new_xScale = d3.event.transform.rescaleX(xScale);
  xAxis.call(d3.axisBottom(new_xScale));

  var minValue = new_xScale.domain()[0], maxValue = new_xScale.domain()[1];
  aligns.attr('transform', function (align) {
            return 'translate(' + new_xScale(Math.max(minValue, align.s)) + ',0)';
        })
        .attr("width", function (align) {
            newStart = Math.max(minValue, align.s);
            newEnd = Math.min(align.e, maxValue);
            newW = new_xScale(newEnd) - new_xScale(newStart);
            return newW > 0 ? newW : 0;
        });
}

function getTickValue(value) {
    if (value > 1000000000)
        return 'Gbp';
    else if (value > 1000000)
        return 'Mbp';
    else if (value > 1000)
        return 'kbp';
    else
        return 'bp';
}