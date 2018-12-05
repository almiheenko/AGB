function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function deselectAll() {
    d3.selectAll('.edge').classed('node_selected_in', false);
    d3.selectAll('.edge').classed('node_selected_out', false);
    d3.selectAll('.edge').classed('selected', false);
    d3.selectAll('.node').classed('selected', false);
    d3.selectAll('.align').classed("selected", false);
    if (!selectedContig) $("#contig_table tbody tr").removeClass('selected');
    $("#edge_table tbody tr").removeClass('selected');
    $("#vertex_table tbody tr").removeClass('selected');
    document.getElementById('node_info').innerHTML = 'Click on a graph node or an edge';
    selectedNode = "";
}

function deselectEdge() {
    selectedEdge = "";
    selectedMatchEdge = "";
}

function deselectContig() {
    selectedContig = "";
    selectedChrom = "";
}

function parseGraph(srcLines, skipIds) {
    // parse DOT file
    var g = {};
    for (var i = 0; i < srcLines.length; i++) {
        var matches = srcLines[i].match(edgePattern);
        if (matches && matches.length >= 3) {
            var node1 = matches[1], node2 = matches[2];
            g[node1] = g[node1] || {};
            g[node2] = g[node2] || {};
            g[node1][node2] = g[node1][node2] || new Set();
            g[node2][node1] = g[node2][node1] || new Set();
            if (!skipIds) {  // do not store excessive information for calculation of connected components
                var edgeId = srcLines[i].match(idPattern)[1];
                g[node1][node2].add(edgeId);
                g[node2][node1].add(edgeId);
            }
        }
    }
    return g;
}

function parseDirectedGraph(srcLines) {
    // parse DOT file taking into account edge directions
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

function calculateComponents(g) {
    // get a number of connected components in a graph

    var components = 0;
    var visited = {};
    for (var i in g) {
        var subGraph = dfs(g, i, visited);
        if (subGraph != null) {
            components++;
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