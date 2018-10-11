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