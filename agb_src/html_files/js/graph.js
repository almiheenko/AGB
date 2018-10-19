
function parseGraph(srcLines) {
    var g = {};
    for (var i = 0; i < srcLines.length; i++) {
        var matches = srcLines[i].match(edgePattern);
        if (matches && matches.length >= 3) {
            var node1 = matches[1], node2 = matches[2];
            var edgeId = srcLines[i].match(idPattern)[1];
            g[node1] = g[node1] || {};
            g[node2] = g[node2] || {};
            g[node1][node2] = g[node1][node2] || new Set();
            g[node2][node1] = g[node2][node1] || new Set();
            g[node1][node2].add(edgeId);
            g[node2][node1].add(edgeId);
        }
    }
    return g;
}

function parseDirectedGraph(srcLines) {
    var g = {};
    for (var i = 0; i < srcLines.length; i++) {
        var matches = srcLines[i].match(edgePattern);
        if (matches && matches.length >= 3) {
            var node1 = matches[1], node2 = matches[2];
            var edgeId = srcLines[i].match(idPattern)[1];
            g[node1] = g[node1] || {};
            g[node1][node2] = g[node1][node2] || new Set();
            g[node1][node2].add(edgeId);
        }
    }
    return g;
}

function toGraph(srcLines) {
    var g = {};
    for (var i = 0; i < srcLines.length; i++) {
        var matches = srcLines[i].match(edgePattern);
        if (matches && matches.length >= 3) {
            var node1 = matches[1], node2 = matches[2];
            g[node1] = g[node1] || {};
            g[node2] = g[node2] || {};
            g[node1][node2] = g[node1][node2] || new Set();
            g[node2][node1] = g[node2][node1] || new Set();
            //edgeId = srcLines[i].match(idPattern)[1];
            //g[node1][node2].add(edgeId);
            //g[node2][node1].add(edgeId);
        }
    }
    return g;
}

function calculateComponents(g) {
    var components = 0;
    var visited = {};
    for (var i in g) {
        var subGraph = dfs(g, i, visited);
        if (subGraph != null) {
            components++;
            //for (var edge in subGraph) {
                //console.log(subGraph[edge], subGraph)
                //components[subGraph[edge]] = subGraph.length;
                
            //}
        }
    }
    return components;
}

function dfs(g, node, visited) {
    if (visited[node]) return null;
    var subGraph = [];
    visited[node] = true;
    for (var i in g[node]) {
        if (i == node) {
            subGraph = subGraph.concat(Array.from(g[node][i]));
            continue
        }
        var result = dfs(g, i, visited);
        if (result == null) continue;
        subGraph = subGraph.concat(Array.from(g[node][i]));
        subGraph = subGraph.concat(result);
    }
    return subGraph;
}

function render(doRefresh, doAnimate, doRefreshTables) {
    transition1 = d3.transition()
        .ease(d3.easeLinear)
        .delay(0)
        .duration(timeTransition);

    d3.select("#graph > svg").attr("display", "none");
    if (doRefresh) {
        //    .remove()
        graphviz.resetZoom();
        graphviz.attributer(attributer);
        //.width(1000).fit(true).zoom(true);
    }
    graphviz.on('end', function() {
        d3.select('#graph0').select("title").text("");
        if (!$('#show_labels')[0].checked)
            d3.selectAll('.edge').selectAll('text').style('display','none');
        else
            d3.selectAll('.edge').selectAll('text').style('display','');
        d3.select("#graph > svg").attr("display", "");
        d3.selectAll(".node")
            .attr("id", function(d) { return "node" + d.key; });
        buildVertexTable();
        buildEdgesTable();
        if (selectedMethod !== "ref")
            buildRefTable();
        if (selectedMethod !== "contig")
            buildContigsTable();
        if (doRefreshTables)
            buildComponentsTable();
        setupAutocompleteSearch();
        $('#saveBtns').show();
        highlightChromEdges();
        contigEdges = highlightContigEdges();
        highlightNodes();
        if (selectedEdge) {
            d3.selectAll('#' + selectedEdge).classed('selected', true);
            d3.selectAll('#edgerow' + selectedEdge.replace('e', '').replace('rc', '')).classed('selected', true);
            document.getElementById('node_info').innerHTML = edgeDescription;
            zoomToElement(selectedEdge);
            selectedEdge = "";
        }
        else if (contigEdges.length > 0) zoomToElement(contigEdges[0]);
        if (selectedMatchEdge) d3.selectAll('#' + selectedMatchEdge).classed('selected', false);
        if (nodeToSelect) {
            selectedNode = nodeToSelect;
            selectNode(selectedNode);
            nodeToSelect = "";
            zoomToElement('node' + selectedNode);
        }
        nodes = d3.selectAll('.node');
        nodes.attr('pointer-events', 'all')
        
        nodes
            .on("click", function (e) {
                deselectAll();
                deselectEdge();
                selectedNode = d3.select(this).select('title').text();
                selectNode(selectedNode);
        });
        nodes
            .on("dblclick", function (e) {
                selectedNode = d3.select(this).select('title').text();
                clusterNode = clusterCenters[selectedNode] || selectedNode;
                if (expandedNodes.has(clusterNode)) {
                    expandedNodes.delete(clusterNode);
                    for (var j = 0; j < adjacentExpNodes[clusterNode].length; j++) {
                        expandedNodes.delete(adjacentExpNodes[clusterNode][j]);
                    }
                    adjacentExpNodes[clusterNode] = [];
                }
                else {
                    expandedNodes.add(clusterNode);
                    adjacentExpNodes[clusterNode] = [];
                    for (node in replacementDict) {
                        if (replacementDict[node] == clusterNode) {
                            adjacentExpNodes[clusterNode].push(node);
                            expandedNodes.add(node);
                            clusterCenters[node] = clusterNode;
                        }
                    }
                }
                d3.event.stopPropagation();
                updateDot(false, true, false);
        });
        edges = d3.selectAll('.edge');
        edges
            .on("mouseenter", function (e) {
                d3.select(this).classed("focused", true);
                var edgeId = d3.select(this).attr('id');
                var curEdge = edgeDataFull[edgeId] || edgeDataFull[edgeId];
                if (curEdge) {
                    tooltipDiv.transition()
                        .delay(500)
                        .duration(200)
                        .style("opacity", .9);
                    edgeDescription = "<b>Edge:</b> " + curEdge.name + ", <b>length:</b> " + curEdge.len +
                        "kb, <b>coverage:</b> " + curEdge.cov + "x";

                    curEdge = edgeInfo[edgeId] ? edgeId : edgeData[edgeId].el_id;
                    if (edgeMappingInfo && edgeMappingInfo[curEdge] && edgeMappingInfo[curEdge].length > 0) {
                        edgeDescription = edgeDescription + '<br/><b>Reference chromosomes: </b>' + edgeMappingInfo[curEdge].join(", ");
                    }
                    if (edgeInfo && edgeInfo[curEdge] && edgeInfo[curEdge].length > 0) {
                        edgeDescription = edgeDescription + '<br/><b>Contigs: </b>' + edgeInfo[curEdge].join(", ");
                    }
                    tooltipDiv.html(edgeDescription)
                        .style("left", (d3.event.pageX + 10) + "px")
                        .style("top", (d3.event.pageY - 30) + "px");
                }
            })
            .on("mouseleave", function (e) {
                d3.select(this).classed("focused", false);
                tooltipDiv.transition()
                 .duration(300)
                 .style("opacity", 0);
            });
        edges
            .on("click", function (e) {
            if (!d3.select(this).select('text').empty()) {
                var edgeId = d3.select(this).attr('id');
                if (edgeData[edgeId]) {
                    curEdge = edgeDataFull[d3.select(this).attr('id')];
                    selectEdge(d3.select(this).attr('id'), curEdge.id, curEdge.len, curEdge.cov, curEdge.mult);
                }
                else selectEdge(d3.select(this).attr('id')); 
            }
            else {
                selectEdge(d3.select(this).attr('id'));
            }
        });
    });
    graphTransition = doAnimate ? transition1 : d3.transition().duration(0);
    graphviz
        .tweenShapes(false)
        .transition(transition1)
        .dot(dot)
        .render();

}

function highlightNodes() {
    d3.selectAll('.node').classed('unbalanced_node', false);
    d3.selectAll('.node').classed('hanging_node', false);
    d3.selectAll('.node').classed('collapsed_node', false).attr('style','');
    if ($('#unbalanced_checkbox')[0].checked) {
        //nodes = new Set(unbalancedNodes[componentN]);
        d3.selectAll('.node').filter(function (e) {
            nodeId = d3.select(this).select('title').text();
            return unbalancedNodes.has(nodeId);
        })
        .classed('unbalanced_node', true);
    }
    nodes = hangNodes[componentN] ? new Set(hangNodes[componentN]) : new Set();
    d3.selectAll('.node').filter(function (e) {
        nodeId = d3.select(this).select('title').text();
        return nodes.has(nodeId);
    })
    .classed('hanging_node', true);
    if (selectedMethod == "repeat") {
        nodes = new Set(repeatConnectNodes[componentN]);
        d3.selectAll('.node').filter(function (e) {
            nodeId = d3.select(this).select('title').text();
            return nodes.has(nodeId);
        })
        .classed('connect_node', true);
    }
    d3.selectAll('.node').filter(function (e) {
        nodeId = d3.select(this).select('title').text();
        return nodeId.lastIndexOf('part', 0) === 0;
    })
    .classed('part_node', true)
    .select('ellipse')
    .attr('rx', 13)
    .attr('ry', 13);
    d3.selectAll('.node').filter(function (e) {
        nodeId = d3.select(this).select('title').text();
        return newNodes.has(nodeId);
    })
    .classed('collapsed_node', true)
    .select('ellipse')
    .attr('style', function() {
        nodeId = d3.select(this.parentNode).select('title').text();
        if (nodeColors[nodeId]) return 'fill: ' + nodeColors[nodeId].replace(/\d+$/, "");
    });
}

function highlightContigEdges() {
    deselectAll();
    d3.selectAll('path').classed('contig_selected',false);
    d3.selectAll('polygon').classed('contig_selected',false);
    var graphPath = '';
    var isHiddenEdges = false;
    $('#wrongOptionsWarning').hide();
    $('#uniqueEdgesWarning').hide();
    var realEdges = [];
    if (selectedContig) {
        graphPath = "";
        selectedEdges = new Set();
        var graphEdges = [];
        $('#contigrow' + selectedContig).addClass('selected');
        for (i = 0; i < contigInfo[selectedContig].edges.length; i++) {
            edge = contigInfo[selectedContig].edges[i];
            if (edge != "*" && edge != "??") {
                var edgeElId = edge[0] == '-' ? 'rc' + edge.substr(1) : 'e' + edge;
                var edgeId = getEdgeElement(edgeData[edgeElId]);
                //console.log(edgeId, edgeElId)
                visEdgeId = d3.select('#' + edgeId).empty() ? edgeElId : edgeId; 
                if (!d3.select('#' + visEdgeId).empty()) {
                     realEdges.push(edgeId);
                     if (edgeDataFull[edgeElId].unique)
                        graphEdges.push('<b>' + edge + '</b>');
                     else
                        graphEdges.push(edge + ' (' + edgeDataFull[edgeElId].mult + ')');
                     d3.select('#' + visEdgeId).selectAll('path')
                       .filter(function(d) {return d3.select(this).attr('stroke') !== '#ffffff'; }).classed('contig_selected',true);
                     d3.select('#' + visEdgeId).selectAll('polygon').classed('contig_selected',true);
                }
                else {
                     if (edgeDataFull[edgeElId].unique)
                        graphEdges.push('<span class="gray_text"><b>' + edge + '</b></span>');
                     else
                        graphEdges.push('<span class="gray_text">' + edge + '</span> (' + edgeDataFull[edgeElId].mult + ')');
                    isHiddenEdges = true;
                }
                selectedEdges.add(edge);
            }
            else graphEdges.push(edge)
        }
        if (graphEdges.length > 0) {
            prevEdge = null;
            edgeCount = 1;
            for (i = graphEdges.length - 1; i > -1; i--) {
                edge = graphEdges[i];
                if (prevEdge == edge) edgeCount++;
                if (prevEdge && (prevEdge != edge || i == 0)) {
                    if (edgeCount <= 2 && prevEdge) {
                        graphPath = prevEdge + graphPath;
                    } 
                    else graphPath = prevEdge + ' (' + edgeCount + ' times)' + graphPath;
                    if (i > 0 && graphEdges.length > 1) graphPath = ' &#8209;> ' + graphPath;
                    edgeCount = 1;
                }
                if (prevEdge != edge && i == 0) graphPath = edge + ' &#8209;> ' + graphPath;
                prevEdge = edge;
            }
            contigN = selectedContig;
            graphPath = '<b>Graph path:</b> ' + graphPath + ' </br>' +
                (selectedMethod != "contig" ? '<a onclick="changeToContig(' + "'" + selectedContig + "'" + ')">Show contig component</a>' : "");
            if (isHiddenEdges && $('#uniqueEdgesWarning').attr('display') != 'none') $('#wrongOptionsWarning').show();
        }
    }
    document.getElementById("contigPath").innerHTML = graphPath;
    return realEdges;
}

function highlightChromEdges() {
    deselectAll();
    d3.selectAll('path').classed('contig_selected',false);
    d3.selectAll('polygon').classed('contig_selected',false);
    var graphPath = '';
    var isHiddenEdges = false;
    $('#wrongOptionsChromWarning').hide();
    $('#uniqueChromEdgesWarning').hide();
    var firstEdge;
    if (!isNaN(parseInt(selectedChrom))) {
        selectedEdges = new Set();
        for (i = 0; i < chromEdges.length; i++) {
            var edgeId = chromEdges[i];
            var edgeElId = getEdgeElement(edgeData[edgeId]);
            visEdgeId = d3.select('#' + edgeId).empty() ? edgeElId : edgeId; 
            if (!d3.select('#' + visEdgeId).empty()) selectedEdges.add(edge);
        }
    }
    document.getElementById("chromPath").innerHTML = graphPath;
    selectedChrom = "";
    return firstEdge;
}

function updateDot(doRefresh, doAnimate, doRefreshTables) {
    $(".tooltip").tooltip("hide");
    deselectAll();
    dotSrc = srcGraphs[componentN].dot;
    var flankingEdges = [];
    var uniqueEdges = [];
    var dotSrcLines = dotSrc.split('\n');
    repeatEdges = new Set();
    hiddenEdges = new Set();
    var edgesColor = {};
    if(selectedMethod == "ref") curChrom = chromosomes[componentN];
    for (i = 0; i < dotSrcLines.length;) {
        var matches = dotSrcLines[i].match(idPattern);
        if (matches && matches.length > 1 && (selectedMethod == "ref" || selectedMethod == "contig") && !$('#adj_edges_checkbox')[0].checked) {
            edgeId = matches[1];
            edgeRealId = edgeInfo[edgeId] ? edgeId : (edgeData[edgeId] ? edgeData[edgeId].el_id : edgeId);
            if (selectedMethod == "ref") {
                if (baseLoopEdgeDict[edgeId]) {
                    var hiddenEdgesCount = 0;
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        edge = edgeData[baseLoopEdgeDict[edgeId][k]];
                        if (!checkChromEdge(edge.id)) {
                            hiddenEdges.add(edge.id);
                            hiddenEdges.add(edge.id);
                        }
                    }
                    if (hiddenEdgesCount == baseLoopEdgeDict[edgeId].length) hiddenEdges.add(edgeId);
                }
                else if (!checkChromEdge(edgeId)) {
                    hiddenEdges.add(edgeId);
                }
            }
            else if (selectedMethod == "contig") {
                if (baseLoopEdgeDict[edgeId]) {
                    var hiddenEdgesCount = 0;
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        edge = edgeData[baseLoopEdgeDict[edgeId][k]];
                        if (!checkContigEdge(edge)) {
                            hiddenEdges.add(edge.id);
                            hiddenEdgesCount++;
                        }
                    }
                    if (hiddenEdgesCount == baseLoopEdgeDict[edgeId].length) hiddenEdges.add(edgeId);
                }
                else if (!checkContigEdge(edgeData[edgeId])) {
                    hiddenEdges.add(edgeId);
                }
            }
        }
        var matches = dotSrcLines[i].match(idPattern);
        if (!matches) {
            i++;
            continue;
        }
        edgeId = matches[1];
        if (!checkEdgeCoverage(edgeId)) {
            dotSrcLines.splice(i, 1);
        }
        else {
            if ($('#collapse_repeats_checkbox')[0].checked) {
                if (baseLoopEdgeDict[edgeId]) {
                    var repeatEdgesCount = 0;
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        edge = edgeData[baseLoopEdgeDict[edgeId][k]];
                        if (edge && (!edge.unique)) {
                            repeatEdges.add(edge.id);
                            repeatEdgesCount++;
                            edgesColor[edge.id] = dotSrcLines[i].match(colorPattern)[1];
                        }
                    }
                    if (repeatEdgesCount == baseLoopEdgeDict[edgeId].length) repeatEdges.add(edgeId);
                }
                else {
                    edge = edgeData[edgeId];
                    if (edge && (!edge.unique)) {
                        repeatEdges.add(edge.id);
                        edgesColor[edge.id] = dotSrcLines[i].match(colorPattern)[1];
                    }
                }
            }
            if (selectedMethod == "repeat" && dotSrcLines[i].indexOf('loop') == -1 && dotSrcLines[i].indexOf('black') !== -1) {
                uniqueEdges.push(dotSrcLines[i]);
                dotSrcLines.splice(i, 1);
            }
            else i++;
        }
    }

    diGraph = parseDirectedGraph(dotSrcLines);
    graph = parseGraph(dotSrcLines);
    var nodes = Object.keys(graph);
    for(var i=0, len=nodes.length; i<len; i++){
        nodes[i] = parseInt(nodes[i], 10);
    }
    var collapsedNodes = {};
    newNodes = new Set();
    var strongEdges = {};
    for (node in graph) {
        for (i = 0; i < Object.keys(graph[node]).length; i++) {
            edgesToCollapse = 0;
            node2 = Object.keys(graph[node])[i];
            var filteredEdges = new Set();
            for (let edgeId of graph[node][node2]) {
                if (!hiddenEdges.has(edgeId)) {
                    filteredEdges.add(edgeId)
                }
                if (repeatEdges.has(edgeId)) {
                    edgesToCollapse = edgesToCollapse + 1;
                }
                else if (edgeData[edgeId]) {
                    if (!checkEdgeWithThresholds(edgeId)) {
                        edgesToCollapse = edgesToCollapse + 1;
                    }
                }
                else if (baseLoopEdgeDict[edgeId]) {
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        if (!checkEdgeWithThresholds(baseLoopEdgeDict[edgeId][k])) {
                            edgesToCollapse = edgesToCollapse + 1;
                        }
                    }
                }
            }
            graph[node][node2] = filteredEdges;
            //console.log(filteredEdges)
            if (edgesToCollapse && node != node2 && !expandedNodes.has(node) && !expandedNodes.has(node2)) {
                    collapsedNodes[node] = collapsedNodes[node] || new Set();
                    collapsedNodes[node].add(node2);
            }
            else if (edgesToCollapse == 0) {
                //strongEdges[node] = strongEdges[node] || {};
                //strongEdges[node][node2] = curEdges;
            }
        }
    }
    //console.log(collapsedNodes,strongEdges)
    newData = {};
    replacementDict = {};
    nodeColors = {};
    collapsedEdges = {};
    for (node in collapsedNodes) {
        edgeS = replacementDict[node] ? replacementDict[node] : node;
        collapsedEdges[edgeS] = collapsedEdges[edgeS] || new Set();
        for (let node2 of collapsedNodes[node]) {  
            edgeE = replacementDict[node2] ? replacementDict[node2] : node2;
            if (edgeS == edgeE || !graph[edgeE]) continue;
            if ((strongEdges[edgeS] && strongEdges[edgeS][edgeE]) || (strongEdges[edgeE] && strongEdges[edgeE][edgeS]))
                continue;
            newNodes.add(edgeS);
            for (i = 0; i < Object.keys(graph[edgeE]).length;) {
                pairNode = Object.keys(graph[edgeE])[i];
                graph[pairNode] = graph[pairNode] || {};
                graph[edgeS][pairNode] = graph[edgeS][pairNode] || new Set();
                graph[pairNode][edgeS] = graph[pairNode][edgeS] || new Set();
                diGraph[pairNode] = diGraph[pairNode] || {};
                diGraph[edgeS] = diGraph[edgeS] || {};
                diGraph[edgeS][pairNode] = diGraph[edgeS][pairNode] || new Set();
                diGraph[pairNode][edgeS] = diGraph[pairNode][edgeS] || new Set();
                for (let edgeId of graph[edgeE][pairNode]) {
                    graph[edgeS][pairNode].add(edgeId);
                    graph[pairNode][edgeS].add(edgeId);
                    newData[edgeId] = edgeData[edgeId];
                    if (diGraph[edgeE] && diGraph[edgeE][pairNode] && diGraph[edgeE][pairNode].has(edgeId)) {
                        newData[edgeId] = [edgeS, pairNode];
                        diGraph[edgeS][pairNode].add(edgeId);
                    }
                    else {
                        newData[edgeId] = [pairNode, edgeS];
                        diGraph[pairNode][edgeS].add(edgeId);
                    }
                    if (edgesColor[edgeId]) {
                        if (nodeColors[edgeS] && nodeColors[edgeS] != edgesColor[edgeId]) nodeColors[edgeS] = '#be21f8';
                        else nodeColors[edgeS] = edgesColor[edgeId];
                    }
                    if (repeatEdges.has(edgeId)) collapsedEdges[edgeS].add(edgeId);
                }
                delete graph[edgeE][pairNode];
                delete graph[pairNode][edgeE];
            }

            replacementDict[node2] = edgeS;
            replacementDict[edgeE] = edgeS;
            for (e1 in replacementDict) {
                if (replacementDict[e1] == node2)
                    replacementDict[e1] = edgeS
                if (replacementDict[e1] == edgeE)
                    replacementDict[e1] = edgeS
            }
            for (e1 in strongEdges) {
                if (strongEdges[e1][node2])
                    strongEdges[e1][edgeS] = strongEdges[e1][node2];
                if (strongEdges[e1][edgeE])
                    strongEdges[e1][edgeS] = strongEdges[e1][edgeE];
            }
        }
    }
    clusterNodeSizeDict = {};
    for (node in collapsedEdges)
        clusterNodeSizeDict[node] = collapsedEdges[node].size;

    dotSrcLines = ['digraph {','graph [pad="0.5", ranksep=1,nodesep=0.5];', 'node [shape = circle, label = "", height = 0.15];'];
    newEdges = new Set();
    loopEdges = {};
    for (node in graph) {
        for (i = 0; i < Object.keys(graph[node]).length; i++) {
            pairNode = Object.keys(graph[node])[i];
            for (let edgeId of graph[node][pairNode]) {   
                if (node == pairNode) {
                    loopEdges[node] = loopEdges[node] || [];
                    loopEdges[node].push(edgeId)
                }
                else newEdges.add(edgeId);
            }
        }
    }
    //console.log(newEdges,graph)
    
    // find loop edges
    loopEdgeDict = {};
    for (node in loopEdges) {
        if (loopEdges[node]) {
            loopId = 'loopnew' + node;
            loopEdgeDict[loopId] = new Set();
            for (var i = 0; i < loopEdges[node].length; i++) {
                edgeId = loopEdges[node][i];
                if (edgeData[edgeId]) {
                    edge = edgeData[edgeId];
                    newEdgesDict[edgeId] = loopId;
                    source = newData[edgeId] ? newData[edgeId][0] : edge.s;
                    end = newData[edgeId] ? newData[edgeId][1] : edge.e;
                    if (expandedNodes.has(source) && expandedNodes.has(end))
                        isWrong = false;
                    else if (repeatEdges.has(edge.id) || hiddenEdges.has(edge.id) || !checkEdgeWithThresholds(edge.id))
                        isWrong = true;
                    else isWrong = false;
                    if (!isWrong) {
                        loopEdgeDict[loopId].add(edgeId);
                        diGraph[node] = diGraph[node] || {};
                        diGraph[node][node] = diGraph[node][node] || {};
                        diGraph[node][node].add(loopId);
                    }
                }
                else if (baseLoopEdgeDict[edgeId]) {
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        newEdgesDict[baseLoopEdgeDict[edgeId][k]] = loopId;
                        edge = edgeData[baseLoopEdgeDict[edgeId][k]];
                        source = newData[edgeId] ? newData[edgeId][0] : edge.s;
                        if (expandedNodes.has(source))
                            isWrong = false;
                        else if (repeatEdges.has(edge.id) || hiddenEdges.has(edge.id) || !checkEdgeWithThresholds(edge.id))
                            isWrong = true;
                        else isWrong = false;
                        if (!isWrong) {
                            loopEdgeDict[loopId].add(baseLoopEdgeDict[edgeId][k]);
                            diGraph[node] = diGraph[node] || {};
                            diGraph[node][node] = diGraph[node][node] || {};
                            diGraph[node][node].add(loopId);
                        }
                    }
                }
            }
            loopEdgeDict[loopId] = Array.from(loopEdgeDict[loopId]);
            newEdges.add(loopId);
        }
    }

    for (let edgeId of newEdges) {   
        edge = edgeData[edgeId];
        if (edge) {
            source = newData[edgeId] ? newData[edgeId][0] : edge.s;
            end = newData[edgeId] ? newData[edgeId][1] : edge.e;
            if (repeatEdges.has(edge.id) || !checkEdgeWithThresholds(edge.id) || hiddenEdges.has(edge.id)) {
                if (!expandedNodes.has(source) && !expandedNodes.has(end)) {
                    clusterNodeSizeDict[source] = clusterNodeSizeDict[source] || 0;
                    clusterNodeSizeDict[source]++;
                    if (source != end) {
                        clusterNodeSizeDict[end] = clusterNodeSizeDict[end] || 0;
                        clusterNodeSizeDict[end]++;
                    }
                    continue;
                }
            }
            label = edge.len ? ('id ' + edge.name + '\\l' + edge.len + 'k ' + edge.cov + 'x') : "";
            var s = '"' + source + '" -> "' + end + '" [label="' + label + '",id = "' + edgeId + '", color="' + edge.color + '"];';
            dotSrcLines.push(s);
        }
        else if (loopEdgeDict[edgeId].length > 0) {
            curEdges = 0;
            var loopNode;
            var filterEdges = [];
            var loopColors = new Set();
            for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                edge = edgeData[loopEdgeDict[edgeId][k]];
                filterEdges.push(edge);
                loopColors.add(edge.color);
                loopNode = newData[edge.el_id] ? newData[edge.el_id][0] : edge.s;
            }
            if (edge.id.indexOf('part') === -1 && filterEdges.length > 0) {
                var s = "";
                if (filterEdges.length == 1) {
                    edge = filterEdges[0];
                    if (edge.id.indexOf('part') === -1) {
                        label = edge.len ? 'id ' + edge.name + '\\l' + edge.len + 'k ' + edge.cov + 'x' : "";
                        s = '"' + loopNode + '" -> "' + loopNode + '" [label="' + label + '",id = "' + edgeId + '", color="' + edge.color + '"];';
                    }
                }
                else if (filterEdges.length == 2 && filterEdges[0].name.replace('-', '') === filterEdges[1].name.replace('-', '')) {
                    edge = filterEdges[0];
                    label = edge.len ? 'id ' + edge.name.replace('-', '') + '\\l' + edge.len + 'k ' + edge.cov + 'x' : "";
                    s = '"' + loopNode + '" -> "' + loopNode + '" [label="' + label + '",id = "' + edgeId + '", color="' +
                        edge.color + '",penwidth=5];';
                }
                else {
                    s = '"' + loopNode + '" -> "' + loopNode + '" [label="",id = "' + edgeId + '", color="' +
                        (loopColors.size === 1 ? loopColors.values().next().value : "black") + '",penwidth=5];';
                }
                dotSrcLines.push(s);
            }
        }
    }
    dotSrcLines.push('}');
    var colorChromEdges = document.getElementById('color_select').selectedIndex == 1;
    var colorErrorEdges = document.getElementById('color_select').selectedIndex == 2;
    var colorCovEdges = document.getElementById('color_select').selectedIndex == 3;

    //components = calculateComponents(toGraph(dotSrcLines));
    var filteredNodes = new Set();
    for (i = 0; i < dotSrcLines.length;) {
        var matches = dotSrcLines[i].match(idPattern);
        if (matches) {
            edgeId = matches[1];
            //if (components[edgeId] < minComponents) {
            //    dotSrcLines.splice(i, 1);
            //}
            //else {
            var matches = dotSrcLines[i].match(edgePattern);
            var node1 = matches[1], node2 = matches[2];
            filteredNodes.add(node1);
            filteredNodes.add(node2);
            i++;
            //}
        }
        else {
            i++;
        }
    }

    nodes = new Set(repeatConnectNodes[componentN]);
    if (uniqueEdges.length > 300) {
        $('#unique_warning').show();
    }
    else {
        $('#unique_warning').hide();
        for (i = 0; i < uniqueEdges.length; i++) {
            var edgeMatches = uniqueEdges[i].match(edgePattern);
            var node1 = edgeMatches[1], node2 = edgeMatches[2];
            node1 = replacementDict[node1] ? replacementDict[node1] : node1;
            node2 = replacementDict[node2] ? replacementDict[node2] : node2;
            if (filteredNodes.has(node1) || filteredNodes.has(node2)) {
                var matches = uniqueEdges[i].match(idPattern);
                if (matches && matches.length > 1) {
                    edgeId = matches[1];
                    edge = edgeData[edgeId];
                    if (edge && checkEdgeWithThresholds(edgeId)) {
                        if (newEdges[edgeId]) {
                            node1 = newEdges[edgeId][0];
                            node2 = newEdges[edgeId][1];
                        }
                        newData[edgeId] = [node1, node2]
                        label = (edge.len && edge.name.indexOf('part') == -1) ? 'id ' + edge.name + '\\l' + edge.len + 'k ' + edge.cov +'x' : "";
                        var s = '"' + node1 + '" -> "' + node2 + '" [label="' + label + '",id = "' + edgeId + '", color="' + edge.color + '"];';
                        //console.log(s)
                        //dotSrcLines.push(s);
                        flankingEdges.push(s);
                        graph[node1] = graph[node1] || {};
                        graph[node1][node2] = graph[node1][node2] || new Set();
                        graph[node2] = graph[node2] || {};
                        graph[node2][node1] = graph[node2][node1] || new Set();
                        graph[node1][node2].add(edgeId)
                        graph[node2][node1].add(edgeId)
                    }
                }
            }
        }
    }
    if (flankingEdges) {
        dotSrcLines.splice(-1,1);
        dotSrcLines = dotSrcLines.concat(flankingEdges);
        dotSrcLines.push("}");
    }
    graph = parseGraph(dotSrcLines);
    for (i = 0; i < dotSrcLines.length; i++) {
        var matches = dotSrcLines[i].match(lenCovPattern);
        if (matches && matches.length > 2) {
            edge_len = parseFloat(matches[1]);
            coverage = parseInt(matches[2]);
            var edge_width = 2;
            var multiplicity = coverage / median_cov;
            multiplicity = multiplicity < 1.75 ? 1 : Math.round(multiplicity);
            if (multiplicity > 10) edge_width = 9;
            else if (multiplicity > 5) edge_width = 7;
            else if (multiplicity > 1) edge_width = 5;
            //else edge_width = multiplicity;
            dotSrcLines[i] = dotSrcLines[i].replace("]", ", penwidth=" + edge_width + " ]");
            if (colorChromEdges) {
                var matches = dotSrcLines[i].match(idPattern);
                edgeId = matches[1];
                edgeRealId = (edgeInfo[edgeId] || !edgeData[edgeId]) ? edgeId : edgeData[edgeId].el_id;
                var color = 'black';
                if (edgeDataRef[edgeRealId] && edgeDataRef[edgeRealId].chrom)
                    color = edgeDataRef[edgeRealId].chrom;
                var oldColor = dotSrcLines[i].match(colorPattern);

                dotSrcLines[i] = dotSrcLines[i].replace(oldColor[0], 'color="' + color + '"');
            }
            else if (colorCovEdges) {
                var color = 'red';
                if (coverage >= q3_cov)
                    color = 'green';
                else if (coverage >= median_cov)
                    color = '#d39200';

                var oldColor = dotSrcLines[i].match(colorPattern);
                if (dotSrcLines[i].indexOf(' = "black"') == -1) {  // use parallel edges for repeat
                    dotSrcLines[i] = dotSrcLines[i].replace(oldColor[1], color + ':white:' + color);
                }
                else dotSrcLines[i] = dotSrcLines[i].replace(oldColor[1], color);
            }
            else if (colorErrorEdges) {
                var color = "green";
                var matches = dotSrcLines[i].match(idPattern);
                edgeId = matches[1];
                edgeRealId = (edgeInfo[edgeId] || !edgeData[edgeId]) ? edgeId : edgeData[edgeId].el_id;
                if (edgeData[edgeRealId] && edgeData[edgeRealId].errors.length > 0)
                    color = "#b90000:white:#b90000";
                else if (edgeInfo[edgeRealId]) {
                    for (var j=0;j<edgeInfo[edgeRealId].length;j++)
                        if (misassembledContigs && misassembledContigs[edgeInfo[edgeRealId][j]]) {
                            color = "red";
                            break;
                        }
                }
                if (color === "green") {
                    edgeRealId = edgeRealId[0] == "e" ? edgeRealId.replace("e", "rc") : edgeRealId.replace("rc", "e");
                    if (edgeData[edgeRealId] && edgeData[edgeRealId].errors.length > 0)
                        color = "#b90000:white:#b90000";
                    else if (edgeInfo[edgeRealId]) {
                        for (var j=0;j<edgeInfo[edgeRealId].length;j++)
                            if (misassembledContigs && misassembledContigs[edgeInfo[edgeRealId][j]]) {
                                color = "red";
                                break;
                            }
                    }
                }

                var oldColor = dotSrcLines[i].match(colorPattern);
                dotSrcLines[i] = dotSrcLines[i].replace(oldColor[0], 'color="' + color + '"');
            }
        }
    }
    dot = dotSrcLines.join('\n');
    render(doRefresh, doAnimate, doRefreshTables);
}

function searchEdge(event) {
  var input, filter, table, tr, td, i;
  input = document.getElementById("searchEdgeBox");
  filterVal = input.value.toUpperCase();
  table = document.getElementById("edge_table");
  tr = table.getElementsByTagName("tr");

  for (i = 0; i < tr.length; i++) {
    td = tr[i].getElementsByTagName("td")[0];
    if (td) {
      if (td.innerHTML.toUpperCase().indexOf(filterVal) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
      }
    } 
  }
}

function getEdgeComponent(edgeId) {
    if (edgeData[edgeId])
        edge = edgeData[edgeId];
    else if (loopEdgeDict[edgeId]) 
        edge = edgeData[loopEdgeDict[edgeId][0]];
    if (selectedMethod == "repeat")
        edgeComponent = edge.rep_comp;
    else if (selectedMethod == "ref") {
        edgeComponent =  edgeDataRef[edgeId].ref_comp;
    }
    else if (selectedMethod == "contig")
        edgeComponent =  edgeDataRef[edgeId].contig_comp;
    else edgeComponent = edge.comp;
    return edgeComponent;
}

function getEdgeElement(edge) {
    edgeElementId = edge.name[0] == '-' ? 'rc' + edge.name.substr(1) : 'e' + edge.name;
    realElementId = newEdgesDict[edgeElementId] ? newEdgesDict[edgeElementId] : edge.el_id;
    return realElementId;
}

function selectEdgeByLabel(edgeLabel) {
    var edgeId = edgeLabel[0] == '-' ? 'rc' + edgeLabel.substr(1) : 'e' + edgeLabel;
    if (edgeData[edgeId]) {
        curEdge = edgeData[edgeId];
        edgeComponent = getEdgeComponent(edgeId);
        selectedEdge = getEdgeElement(curEdge);
        console.log(edgeComponent, edgeId)
        if (edgeComponent != componentN) changeComponent(edgeComponent);
        edgeElId = getEdgeElement(curEdge);
        selectEdge(edgeElId, curEdge.id, curEdge.len, curEdge.cov, curEdge.mult);
        zoomToElement(edgeElId);
    }
}

function checkContigEdge(edge) {
    if (!edge) return false;
    var matchEdge = edge.name[0] === '-' ? edge.name.replace('-', '') : '-' + edge.name;
    var contigName = srcGraphs[componentN].contig;
    return contigInfo[contigName].edges.indexOf(edge.name) !== -1 || contigInfo[contigName].edges.indexOf(matchEdge) !== -1;
}

function checkChromEdge(edgeId) {
    return !edgeData[edgeId] || (!edgeMappingInfo || (edgeMappingInfo[edgeId] && edgeMappingInfo[edgeId].indexOf(curChrom) !== -1));
}

function checkEdgeCoverage(edgeId) {
    if (edgeData[edgeId] && edgeData[edgeId].cov < minCoverage) return false;
    if (baseLoopEdgeDict[edgeId]) {
        lowCovEdgesCount = 0;
        for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
            edge = edgeData[baseLoopEdgeDict[edgeId][k]];
            if (edge && (edge.cov < minCoverage)) {
                lowCovEdgesCount++;
            }
        }
        if (lowCovEdgesCount == baseLoopEdgeDict[edgeId].length)
            return false;
    }
    return true;
}

function checkEdgeWithThresholds(edgeId) {
    edge = edgeData[edgeId];
    if ((minCoverage && edge.cov < minCoverage) || (maxCoverage && edge.cov > maxCoverage) || edge.len < minLen || (maxLen && edge.len > maxLen))
        return false;
    return true;
}

function checkRepeatEdgeId(edgeId) {
    edge = edgeData[edgeId];
    if (edge) {
        source = newData[edgeId] ? newData[edgeId][0] : edge.s;
        end = newData[edgeId] ? newData[edgeId][1] : edge.e;
    }
    if ($('#collapse_repeats_checkbox')[0].checked && !edgeData[edgeId].unique && !expandedNodes.has(source) && !expandedNodes.has(end))
        return false;
    return true;
}

function checkEdge(edgeId, targetN) {
    var edge = edgeData[edgeId];
    var targetComponent = NaN;
    if (selectedMethod == "default") targetComponent = !isNaN(parseInt(targetN)) ? targetN : componentN;
    else if (selectedMethod == "ref" && !isNaN(parseInt(targetN))) targetComponent = chromosomes[targetN];
    else if (selectedMethod == "contig" && !isNaN(parseInt(targetN))) targetComponent = contigs[targetN];
    //if(edge) console.log(edgeMappingInfo[edge.id], targetComponent, chromosomes, edge)
    if (!edge)
        return false;
    if (!checkEdgeWithThresholds(edgeId))
        return false;
    if (selectedMethod == "default" && getEdgeComponent(edgeId) !== targetComponent)
        return false;
    if (!checkRepeatEdgeId(edgeId))
        return false;
    // if($('#break_checkbox')[0].checked && edgeData[edgeId].unique)
    //    return false;
    if (selectedMethod == "ref" && (!edgeDataFull[edgeId] || !edgeMappingInfo[edge.id] || (targetComponent && edgeMappingInfo[edge.id].indexOf(targetComponent) === -1)))
        return false;
    if (selectedMethod == "contig") {
        var contigEdges = targetComponent ? contigInfo[targetComponent].edges : contigInfo[contigs[componentN]].edges;
        var edgeName = edgeData[edgeId].name;
        var edgeMatchName = edgeName[0] == '-' ? edgeName.replace('-', '') : '-' + edgeName;
        if (contigEdges.indexOf(edgeName) == -1 && contigEdges.indexOf(edgeMatchName) == -1)
            return false;
    }
    return true;
}

function selectEdge(edge, edgeId, edgeLen, edgeCov, edgeMulti) {
    deselectAll();
    selectedEdge = edge;
    console.log(edge);
    selectedMatchEdge = selectedEdge.indexOf("rc") == -1 ? selectedEdge.replace('e', 'rc') : selectedEdge.replace('rc', 'e');
    if (d3.select('#' + selectedMatchEdge).empty()) selectedMatchEdge = null;
    d3.select('#' + selectedEdge).classed('selected', true); 
    if (selectedMatchEdge)
        d3.select('#' + selectedMatchEdge).classed('selected', true);
    if (selectedEdge.lastIndexOf('loop', 0) === 0) {
        edgeDescription = '<ul><b>Loop edges:</b>';
        for (var k = 0; k < loopEdgeDict[selectedEdge].length; k++) {
            var curLoopEdge = loopEdgeDict[selectedEdge][k];
            if (checkEdge(curLoopEdge)) {
                edge = edgeDataFull[curLoopEdge];

                edgeDescription = edgeDescription + 
                        '<li>Edge ID: ' + edge.name +
                        ', length: '  + edge.len +
                        'kb, coverage: '  + edge.cov + 'x, inferred multiplicity: '  + edge.mult;
                if (edgeInfo[curLoopEdge]) {
                    edgeDescription = edgeDescription + '<ul><b>Contigs:</b>';
                    for (var i = 0; i < edgeInfo[curLoopEdge].length; i++) {
                        edgeDescription = edgeDescription + '<li>' + edgeInfo[curLoopEdge][i] + '</li>';
                    }
                    edgeDescription = edgeDescription + '</ul>';
                }
                if (edgeMappingInfo && edgeMappingInfo[curLoopEdge] && edgeMappingInfo[curLoopEdge].length) {
                    edgeDescription = edgeDescription + '<ul><b>Reference chromosomes:</b>';
                    for (var i = 0; i < edgeMappingInfo[curLoopEdge].length; i++) {
                        chrom = edgeMappingInfo[curLoopEdge][i];
                        chromN = chromosomes.indexOf(chrom);
                        chromPos = edge.aligns && edge.aligns[chrom] ? edge.aligns[chrom] : chrom;
                        edgeDescription = edgeDescription + '<li onclick="changeToChromosome(' + chromN + ')"> ' + chromPos + '</li>';
                    }
                    edgeDescription = edgeDescription + '</ul>';
                }
                edgeDescription = edgeDescription + '</li></br>';
                $('#edgerow' + edge.name.replace('-', '')).addClass('selected');
            }
        }
    }
    else if (uniqueEdgesDict[selectedEdge]) {
        edgeDescription = '<ul><b>Edges:</b>';
        for (var k = 0; k < uniqueEdgesDict[selectedEdge].length; k++) {
            if (edgeDataFull[uniqueEdgesDict[selectedEdge][k]]) {
                edge = edgeDataFull[uniqueEdgesDict[selectedEdge][k]];

                edgeDescription = edgeDescription + 
                        '<li>Edge ID: ' + edge.name +
                        ', length: '  + edge.len +
                        'kb, coverage: '  + edge.cov + 'x, inferred multiplicity: '  + edge.mult + '.</li>';
                $('#edgerow' + edge.id).addClass('selected');
            }
        }
    }
    else {
        var edgeName = edgeData[selectedEdge].name;
        edgeDescription = 'Edge ID: ' + edgeName + ', length: ' + edgeLen + 'kb, coverage: ' + edgeCov + 'x, inferred multiplicity: ' + edgeMulti + '.';
        var row = $('#edgerow' + edgeName.replace('-', ''));
        if (row.length){
            $('#collapse_edge_table').collapse('show');
            row.addClass('selected');
            var firstOffset = $('#collapse_edge_table').find('tbody tr:first').offset();
            $('#edge_table_div').scrollTop( row.offset().top - firstOffset.top);
        }
        selectedEdge = edgeInfo[selectedEdge] ? selectedEdge : edgeData[selectedEdge].el_id;
        if (edgeInfo[selectedEdge]) {
            edgeDescription = edgeDescription + '<br/><b>Contigs:</b>';
            for (var i = 0; i < edgeInfo[selectedEdge].length; i++) {
                edgeDescription = edgeDescription + '<li>' + edgeInfo[selectedEdge][i] + '</li>';
            }
        }
        if (edgeMappingInfo && edgeMappingInfo[selectedEdge] && edgeMappingInfo[selectedEdge].length) {
            edgeDescription = edgeDescription + '<br/><b>Reference chromosomes:</b>';
            for (var i = 0; i < edgeMappingInfo[selectedEdge].length; i++) {
                chrom = edgeMappingInfo[selectedEdge][i];
                chromN = chromosomes.indexOf(chrom);
                chromPos = edgeData[selectedEdge].aligns && edgeData[selectedEdge].aligns[chrom] ? edgeData[selectedEdge].aligns[chrom] : chrom;
                edgeDescription = edgeDescription + '<li onclick="changeToChromosome(' + chromN + ')"> ' + chromPos + '</li>';
            }
            if (edgeData[selectedEdge].aligns) edgeDescription = edgeDescription + "Note: maximum top 3 alignments per chromosome are shown.<br/>";
        }
        if (edgeData[selectedEdge] && edgeData[selectedEdge].errors && edgeData[selectedEdge].errors.length > 0) {
            edgeDescription = edgeDescription + '<br/><b>Misassembly breakpoints:</b>';
            for (var i = 0; i < edgeData[selectedEdge].errors.length; i++) {
                error = edgeData[selectedEdge].errors[i];
                edgeDescription = edgeDescription + '<li> between ' + error[0] + ' ' + error[1] + ' and ' + error[2] + ' ' + error[3] + '</li>';
            }
        }
        if (edgeData[selectedEdge] && edgeData[selectedEdge].overlaps && edgeData[selectedEdge].overlaps.length > 0) {
            var overlapsText = '<br/><b>Overlaps:</b>';
            var overlapsN = 0;
            for (var i = 0; i < edgeData[selectedEdge].overlaps.length; i++) {
                overlap = edgeData[selectedEdge].overlaps[i];
                overlapEdgeName = overlap[0]; overlapEdgeId = overlap[1]; overlapLen = overlap[2];
                if (checkEdge(overlapEdgeId)) {
                    overlapsText = overlapsText + '<li> ' + overlapEdgeName + ' (' + overlapLen + ')</li>';
                    overlapsN++;
                }
            }
            if (overlapsN) edgeDescription = edgeDescription + overlapsText;
        }
    }
    if (selectedMethod == "ref" && aligns) {
        selectedAlignId = 'align_' + selectedEdge;
        d3.selectAll('.align').classed("selected", false);
        d3.selectAll('.' + selectedEdge).classed("selected", true);
        if (selectedMatchEdge) d3.selectAll('.' + selectedMatchEdge).classed("selected", true);
    }
    document.getElementById('node_info').innerHTML = edgeDescription;
    $('#collapse_edge_table').collapse('show');
}

function selectContig(selectedContig){
    $('#wrongOptionsWarning').hide();
    $('#uniqueEdgesWarning').hide();
    contigComponent = null;
    console.log(selectedContig, contigInfo[selectedContig], componentN)
    if (contigInfo[selectedContig]) {
        if(selectedMethod == "repeat") contigComponent = contigInfo[selectedContig].rep_g;
        else if(selectedMethod == "ref") contigComponent = contigInfo[selectedContig].ref_g;
        else if(selectedMethod == "contig") contigComponent = contigs.indexOf(selectedContig);
        else contigComponent = contigInfo[selectedContig].g;
        console.log(contigComponent, componentN)
        if (contigComponent !== null && contigComponent != componentN) {
            componentN = contigComponent;
            changeComponent(componentN);
        }
        else {
            contigEdges = highlightContigEdges();
            if (contigEdges.length > 0) zoomToElement(contigEdges[0])
        }
    }
    if (selectedMethod == "repeat" && contigComponent == null ) {
        $('#uniqueEdgesWarning').show();
        $('#wrongOptionsWarning').hide();
    }
    $('#collapse_contig_table').collapse('show');
    var row = $('#contigrow' + selectedContig);
    var firstOffset = $('#collapse_contig_table').find('tbody tr:first').offset()
    if (row.length){
        $('#contig_table_div').scrollTop(row.offset().top - firstOffset.top);
    }
}
       
function selectChrom(chromName){
    chromN = chromosomes.indexOf(chromName);
    chromEdges = chromosomesData[chromName];
    changeToChromosome(chromN);
    $('#collapse_ref_table').collapse('show');
    var row = $('#chromrow' + chromName);
    var firstOffset = $('#collapse_ref_table').find('tbody tr:first').offset()
    if (row.length){
        $('#ref_table_div').scrollTop(row.offset().top - firstOffset.top);
    }
}