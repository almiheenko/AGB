function setupInterfaceBtns() { 
    var minLeftPanelHeight = 800;
    
    addModeSwitch();
    if (window.innerHeight <= minLeftPanelHeight) {
        document.getElementById("left_panel").style.height = minLeftPanelHeight + "px";
        document.getElementById("left_panel").style.overflowY = "scroll";
    }
    else {
        document.getElementById("left_panel").style.height = (window.innerHeight - 80) + "px";
    }

    document.getElementById('max_cov_threshold').value = maxCoverage;
    document.getElementById('max_cov_threshold').onkeyup = function(event) {
        setMaxCoverage(event, this);
    };
    document.getElementById('min_cov_threshold').value = minCoverage;
    document.getElementById('min_cov_threshold').onkeyup = function(event) {
        setMinCoverage(event, this);
    };

    document.getElementById('len_min_threshold').value = minLen;
    document.getElementById('len_min_threshold').onkeyup = function(event) {
        setEdgeLenThreshold(event, this.value, maxLen) };
    document.getElementById('len_max_threshold').value = maxLen;
    document.getElementById('len_max_threshold').onkeyup = function(event) {
        setEdgeLenThreshold(event, minLen, this.value) };

    if (srcGraphs.length > 1) {
        $("#next_btn").prop('disabled', false);
    }

    document.getElementById('component_n').innerHTML = componentN + 1;
    document.getElementById('component_total').innerHTML = srcGraphs.length;

    document.getElementById('prev_btn').onclick = function(event) {
        componentN = componentN - 1;
        deselectContig();
        $("#contig_table tbody tr").removeClass('selected');
        $("#edge_table tbody tr").removeClass('selected');
        $("#vertex_table tbody tr").removeClass('selected');
        changeComponent(componentN);
    };
    $('#next_btn').click(function(event) {
        componentN = componentN + 1;
        deselectContig();
        $("#contig_table tbody tr").removeClass('selected');
        $("#edge_table tbody tr").removeClass('selected');
        $("#vertex_table tbody tr").removeClass('selected');
        changeComponent(componentN);
    });

    $('#collapse_repeats_checkbox').on('change', function() {
        expandedNodes = new Set();
        updateDot(false, false, true);
        if ($('#collapse_repeats_checkbox')[0].checked) {
            $('#unbalanced_checkbox').prop('checked', false);
            $('#unbalanced_checkbox').prop('disabled', true);
            $('#vert_table_info').show();
        }
        else {
            $('#unbalanced_checkbox').prop('disabled', false);
            $('#vert_table_info').hide();
        }
    });
    $('#unbalanced_checkbox').on('change', function() {
        highlightNodes();  // highlight nodes with non-zero balance with red
    });

    $('#adj_edges_option').hide();

    $('#default_mode').on("click",function(){
        // change viewer to default mode
        changeSplitMethod('default');
        $('#default_mode').attr('disabled','disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#ref_mode').on("click",function(){
        // change viewer to ref-based mode
        changeSplitMethod('ref');
        $('#default_mode').removeAttr('disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').attr('disabled','disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#contig_mode').on("click",function(){
        // change viewer to contig-focused mode
        changeSplitMethod('contig');
        $('#default_mode').removeAttr('disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#contig_mode').attr('disabled','disabled');
    });
    $('#repeat_mode').on("click",function(){
        // change viewer to repeat-focused mode
        changeSplitMethod('repeat');
        $('#default_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#repeat_mode').attr('disabled','disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#adj_edges_checkbox').on('change', function() {
        // show/hide adjacent edges
        updateDot(false, true, false);
    });
    $('#show_labels').on('change', function() {
        if (!this.checked)
            d3.selectAll('.edge').selectAll('text').style('display','none');
        else
            d3.selectAll('.edge').selectAll('text').style('display','');
    });

    addColorSelect();
    document.getElementById('color_select').onchange = function(event) {
        $('#repeat_info').hide();
        $('#errors_info').hide();
        $('#single_chrom_info').hide();
        var selectedOption = document.getElementById('color_select').selectedIndex;

        if (selectedOption == 1) { // edge alignments to reference
            if (chromosomes.length == 1) $('#single_chrom_info').show()
        }
        if (selectedOption == 2) { // erroneous edges
            $('#errors_info').show();
        }
        // if (selectedOption == 3) document.getElementById('repeat_info').style.display = '';
        updateDot(false, false, false);
    };

    function submitOnEnter(event){
        if(event.which === 13){
            document.getElementById('draw_edges_btn').click();
            event.preventDefault();
        }
    }

    $('#saveBtns').hide();
    $('#saveButton').on('click', function(){
        // save svg image of displayed graph
        try {
            var isFileSaverSupported = !!new Blob();
        } catch (e) {
            alert("blob not supported");
        }

        var html = d3.select("#graph > svg")
            .attr("title", "graph")
            .attr("version", 1.1)
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .node().parentNode.innerHTML;

        var blob = new Blob([html], {type: "image/svg+xml"});
        saveAs(blob, "graph.svg");
    });

    $('#saveDotButton').on('click', function(){
        try {
            var isFileSaverSupported = !!new Blob();
        } catch (e) {
            alert("blob not supported");
        }
        var blob = new Blob([dot], {type: "text/plain"});
        saveAs(blob, "graph.dot");
    });
    addRefView();
}

function addModeSwitch(){
    var div = "";
    var divWidth = 120;
    if (Object.keys(refEdgeData).length) divWidth += 70;
    if (Object.keys(contigEdgeData).length) divWidth += 50;
    div += '<div style="padding-top:-30px; width:' + divWidth + 'px; text-align:center">Mode</div>';
    div += '<div class="btn-group btn-group-toggle" data-toggle="buttons">';
    div += '<label class="btn btn-info active option_mode" id="default_mode">';
    div += '<input type="radio" name="mode" autocomplete="off" checked> default';
    div += '</label>';
    div += '<label class="btn btn-info option_mode" id="repeat_mode">';
    div += '<input type="radio" name="mode" autocomplete="off" checked> repeat';
    div += '</label>';
    if (Object.keys(refEdgeData).length) {
        div += '<label class="btn btn-info option_mode" id="ref_mode">';
        div += '<input type="radio" name="mode" autocomplete="off" val="ref"> reference';
        div += '</label>';
    }
    if (Object.keys(contigEdgeData).length) {
        div += '<label class="btn btn-info option_mode" id="contig_mode">';
        div += '<input type="radio" name="mode" autocomplete="off" val="contig"> contig';
        div += '</label>';
    }
    div += '</div>';
    document.getElementById('div_switch').innerHTML = div;
}

function addColorSelect(){
    var selectOptions = '<option value="0" selected>repeat edges</option>';
    if (Object.keys(refEdgeData).length) {
        selectOptions += '<option value="1">edge alignments to reference</option>';
        selectOptions += '<option value="2">erroneous edges</option>';
    }
    // selectOptions += '<option value="3">high covered edges</option>';
    document.getElementById("color_select").innerHTML = selectOptions;
}

function infoPopUpShow(){
    $("#info_popup").show();
}

function infoPopUpHide(){
    $("#info_popup").hide();
}

function changeSplitMethod(method, component) {
    selectedMethod = method;
    $('.option_mode').siblings().removeClass('active');
    componentN = component || 0;
    if(selectedMethod == 'ref') {
        $('#ref_mode').addClass('active');
        $('#unbalanced_checkbox').prop('disabled', false);
        $('#unbalanced_checkbox').prop('checked', false);
        $('#unbalanced_checkbox').prop('disabled', true);
        $('#adj_edges_option').show();
        $('#adjEdgesWarning').show();
        $('#numberEdgesWarning').show();
        $('#refView').show();
        srcGraphs = ref_graphs;
        edgeData = refEdgeData;
        srcPartDict = refPartitionDict;
        leafNodes = defLeafNodes;
        selectedChrom = 0;
    }
    else if(selectedMethod == 'contig') {
        $('#contig_mode').addClass('active');
        $('#unbalanced_checkbox').prop('checked', false);
        $('#unbalanced_checkbox').prop('disabled', true);
        $('#adj_edges_option').show();
        $('#adjEdgesWarning').show();
        $('#numberEdgesWarning').hide();
        $('#refView').hide();
        srcGraphs = contig_graphs;
        edgeData = contigEdgeData;
        srcPartDict = null;
        selectedChrom = "";
    }
    else if (selectedMethod == 'repeat') {
        $('#repeat_mode').addClass('active');
        $('#collapse_repeats_checkbox').prop('checked', false);
        $('#collapse_repeats_checkbox').prop('disabled', true);
        $('#adj_edges_option').hide();
        $('#adjEdgesWarning').hide();
        $('#numberEdgesWarning').show();
        $('#refView').hide();
        srcGraphs = repeat_graphs;
        srcPartDict = repeatPartitionDict;
        edgeData = repeatEdgeData;
        leafNodes = repeatLeafNodes;
    }
    else {
        $('#default_mode').addClass('active');
        $('#unbalanced_checkbox').prop('disabled', false);
        $('#vert_table_info').hide();
        $('#collapse_repeats_checkbox').prop('disabled', false);
        $('#adj_edges_option').hide();
        $('#adjEdgesWarning').hide();
        $('#numberEdgesWarning').show();
        $('#refView').hide();
        srcGraphs = def_graphs;
        edgeData = defEdgeData;
        srcPartDict = defPartitionDict;
        leafNodes = defLeafNodes;
        selectedChrom = "";
    }
    changeComponent(componentN, true);
    deselectContig();
    $("#contig_table tbody tr").removeClass('selected');
    $("#edge_table tbody tr").removeClass('selected');
    $("#vertex_table tbody tr").removeClass('selected');
    if (selectedMethod == "ref") buildRefTable();
    if (selectedMethod == "contig") buildContigsTable();
}

$(document).keyup(function(e) {
     if (e.keyCode == 27) {
         infoPopUpHide();
         deselectAll();
         deselectContig();
    }
});

function setMinCoverage(event, textBox) {
    var key = event.keyCode || this.event.keyCode;
    if (key == 27) {
        document.getElementById('min_cov_threshold').blur();
    }
    else if (key == 13) {
        if (parseInt(textBox.value)) minCoverage = parseInt(textBox.value);
        else minCoverage = 0;
        updateDot(false, true, true);
    }
}

function setMaxCoverage(event, textBox) {
    var key = event.keyCode || this.event.keyCode;
    if (key == 27) {
        document.getElementById('max_cov_threshold').blur();
    }
    else if (key == 13) {
        if (parseInt(textBox.value)) maxCoverage = parseInt(textBox.value);
        else maxCoverage = 0;
        updateDot(false, true, true);
    }
}

function setEdgeLenThreshold(event, minValue, maxValue) {
    var key = event.keyCode || this.event.keyCode;
    if (key == 27) {
        document.getElementById('len_min_threshold').blur();
        document.getElementById('len_max_threshold').blur();
    }
    else if (key == 13) {
        if (parseInt(minValue)) minLen = parseFloat(minValue);
        else minLen = 0;
        if (parseInt(maxValue)) maxLen = parseFloat(maxValue);
        else maxLen = '';
        updateDot(false, true, true);
    }
}

function buildContigsTable() {
    // in contig-based mode take into account all edges satisfied with thresholds for each contig
    // otherwise, take into account only displayed edges
    var numContigs = Object.keys(contigInfo).length;
    if (numContigs === 0) {
        document.getElementById("contig_tab").style.display="none";
        return;
    }
    var showAllContigs = numContigs < 500;
    var showAssemblyErrors = chromosomes.length > 0;
    var table = '';
    table += "<table border='1' id='contig_table' class='sortable scroll_table'>";
    table += "<thead><tr class='header'><th>Name</th><th>Len (kbp)</th><th>Cov</th><th># edges</th>" +
        (showAssemblyErrors ? "<th># errors</th>" : "") + "</tr></thead><tbody>";
    enableContigs = [];
    for (x in contigInfo) {
        var contigLen = contigInfo[x].length;
        var edgesN = 0;
        var errorsN = 0;
        // if (misassembledContigs && misassembledContigs[x]) errorsN = misassembledContigs[x].length;
        for (i = 0; i < contigInfo[x].edges.length; i++) {
            var edge = contigInfo[x].edges[i];
            if (edge != "*" && edge != "??") {
                var edgeId = edge[0] == '-' ? 'rc' + edge.substr(1) : 'e' + edge;
                //edgeId = getEdgeElement(edgeData[edgeElId]);
                 var edgeErrorsN = 0; // sum misassemblies in all edges
                 if (edgeData[edgeId] && ((selectedMethod == "contig" && checkEdgeWithThresholds(edgeId)) || checkEdge(edgeId))) {
                    edgesN++;
                    edgeErrorsN = edgeData[edgeId].errors.length;
                 }
                 else if (loopEdgeDict[edgeId]) {
                    var edgeChecked = false;
                    for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                        if ((selectedMethod == "contig" && checkEdgeWithThresholds(loopEdgeDict[edgeId][k])) || checkEdge(loopEdgeDict[edgeId][k])) {
                            edgeErrorsN += edgeData[loopEdgeDict[edgeId][k]].errors.length;
                            edgeChecked = true;
                        }
                    }
                    if (edgeChecked) edgesN++;
                 }
                 errorsN = errorsN + edgeErrorsN;
            }
        }
        if (edgesN || showAllContigs) {
            enableContigs.push(x);
            contigLen = contigLen < 10000 ? Math.round(contigLen / 100) / 10 : Math.round(contigLen / 1000);
            table += "<tr id='contigrow" + x + "'><td>" + x + "</td><td>" + contigLen + "</td><td>" + contigInfo[x].cov +
                "</td><td>" + (edgesN ? edgesN : "-") + (showAssemblyErrors ? "</td><td>" + (errorsN ? errorsN : "-") : "") + "</td>" + "</tr>";
        }
        //table += "<tr id='contigrow" + x + "'><td>" + x + "</td><td>" + contigLen + "</td><td>" + contigInfo[x].cov + "</td><td>" + contigInfo[x].n_edges + "</td></tr>";
    }
    table += "</tbody></table>";
    document.getElementById("contig_table_div").innerHTML = table;
    $("#contig_table tbody tr").click(function(){
        console.log('click!')
        $(this).addClass('selected').siblings().removeClass('selected');    
        selectedContig = $(this).find('td:first').html();
        selectContig(selectedContig);
    });
    // add alphanumeric sort
    sorttable.sort_alpha = function(a,b) {
        var as = a[0], bs = b[0];
        var a, b, a1, b1, i= 0, n, L,
        rx=/(\.\d+)|(\d+(\.\d+)?)|([^\d.]+)|(\.\D+)|(\.$)/g;
        if(as === bs) return 0;
        a= as.toUpperCase().match(rx);
        b= bs.toUpperCase().match(rx);
        L= a.length;
        while(i<L){
            if(!b[i]) return 1;
            a1= a[i],
            b1= b[i++];
            if(a1!== b1){
                n= a1-b1;
                if(!isNaN(n)) return n;
                return a1>b1? 1:-1;
            }
        }
        return b[i]? -1:0;
    }
    sorttable.makeSortable(document.getElementById("contig_table"));
}

function buildRefTable() {
    // in reference-based mode take into account all edges satisfied with thresholds for each chromosome
    // otherwise, take into account only displayed edges
    if (chromosomes.length == 0) {
        document.getElementById("ref_tab").style.display="none";
        return;
    }
    var table = '';
    table += "<table border='1' id='ref_table' class='sortable scroll_table'>";
    chromosomesData = {};
    chromosomesContigs = {};
    var contigsFound = false;
    var chromLengths = [];
    enableChroms = [];
    for (var edgeId in edgeMappingInfo) {
        for (i = 0; i < edgeMappingInfo[edgeId].length; i++) {
             chrom = edgeMappingInfo[edgeId][i];
             chromosomesData[chrom] = chromosomesData[chrom] || [];
             // calculate total length of edges mapped to the chromosome
             if (edgeData[edgeId] && ((selectedMethod == "ref" && checkEdgeWithThresholds(edgeId)) || checkEdge(edgeId))) {
                chromosomesData[chrom].push(edgeData[edgeId].len * 1000);
             }
             else if (loopEdgeDict[edgeId]) {
                 var edgeLen = 0;
                 for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                    if ((selectedMethod == "ref" && checkEdgeWithThresholds(loopEdgeDict[edgeId][k])) || checkEdge(loopEdgeDict[edgeId][k])) {
                        edgeLen += edgeData[loopEdgeDict[edgeId][k]].len * 1000;
                    }
                 }
                 if (edgeLen > 0) chromosomesData[chrom].push(edgeLen);
             }
            /*if (checkEdge(x, chromosomes.indexOf(chrom))) {
                if (x[0] == "e") chromosomesData[chrom].push(x);
                if (edgeInfo[x]) {
                    chromosomesContigs[chrom] = chromosomesContigs[chrom] || new Set();
                    for (var j = 0; j < edgeInfo[x].length; j++) {
                        chromosomesContigs[chrom].add(edgeInfo[x][j])
                    }
                    contigsFound = true;
                }
            }*/
        }
    }
    for (chrom in chromosomesData) {
        var chromLen = 0;
        for (i = 0; i < chromosomesData[chrom].length; i++) {
            chromLen += chromosomesData[chrom][i];
        }
        chromLengths.push(chromLen)
    }
    var factor = Math.max.apply(Math, chromLengths) > 100000000 ? 1000000 : 1000;
    var factorText = factor == 1000 ? "kbp" : "Mbp";
    table += "<thead><tr class='header'><th>Chromosome</th><th>Len (" + factorText + ")</th><th># edges</th>" +
        (contigsFound ? "<th># contigs</th>" : "") + "</tr></thead><tbody>";
    for (chrom in chromosomesData) {
        var chromLen = 0;
        for (i = 0; i < chromosomesData[chrom].length; i++) {
            chromLen += chromosomesData[chrom][i];
        }
        chromLen = Math.round(chromLen * 10 / factor) ? Math.round(chromLen * 10 / factor) / 10 : Math.round(chromLen * 100 / factor) / 100;
        chromLen = chromLen / 2;
        table += "<tr id='chromrow" + chrom + "'><td>" + chrom + "</td><td>" + (chromLen > 0 ? chromLen : '-') + "</td><td>" +
            (chromosomesData[chrom].length ?  Math.round(chromosomesData[chrom].length / 2) : '-') + "</td></tr>";
        enableChroms.push(chrom);
    }
    table += "</tbody></table>";
    document.getElementById("ref_table_div").innerHTML = table;
    $("#ref_table tbody tr").click(function(){
        $(this).addClass('selected').siblings().removeClass('selected');    
        selectedChromName = $(this).find('td:first').html();
        selectChrom(selectedChromName);
    });
    // add alphanumeric sort
    sorttable.sort_alpha = function(a,b) {
        var as = a[0], bs = b[0];
        var a, b, a1, b1, i= 0, n, L,
        rx=/(\.\d+)|(\d+(\.\d+)?)|([^\d.]+)|(\.\D+)|(\.$)/g;
        if(as === bs) return 0;
        a= as.toUpperCase().match(rx);
        b= bs.toUpperCase().match(rx);
        L= a.length;
        while(i<L){
            if(!b[i]) return 1;
            a1= a[i],
            b1= b[i++];
            if(a1!== b1){
                n= a1-b1;
                if(!isNaN(n)) return n;
                return a1>b1? 1:-1;
            }
        }
        return b[i]? -1:0;
    }
    sorttable.makeSortable(document.getElementById("ref_table"));
    if (srcGraphs[componentN].chrom) {
        $('#chromrow' + srcGraphs[componentN].chrom).addClass('selected').siblings().removeClass('selected');
    } 
}

function buildEdgesTable() {
    // show only displayed edges
    table = '';
    table += "<table border='1' id='edge_table' class='sortable scroll_table'>";
    table += "<thead><tr class='header'><th>Edge</th><th>Len (kbp)</th><th>Cov</th><th>Mult.</th></tr></thead><tbody>";
    enableEdges = [];
    for (x in edgeData) {
        // add only forward edges satisfied with length/depth thresholds
        if (edgeData[x].name.toString()[0] != '-' && x.indexOf('_') == -1 && checkEdge(x) && 
            (selectedMethod != "ref" || !isNaN(parseInt(refEdgeData[x].ref_comp)))) {
            enableEdges.push(defEdgeData[x] || edgeData[x]);
        }
    }
    enableEdges.sort(function(a, b) {
        return b.len - a.len;
    });
    for (i = 0; i < enableEdges.length; i++) {
        if (enableEdges[i]['id'].indexOf('part') == -1 && enableEdges[i]['id'].indexOf('uedge') == -1)
            table += "<tr id='edgerow" + enableEdges[i].name.replace('-', '') + "'><td>" + enableEdges[i].name + "</td><td>" + enableEdges[i].len + "</td><td>" + enableEdges[i].cov + "</td><td>" + enableEdges[i].mult + "</td></tr>";
    }
    table += "</tbody></table>";
    document.getElementById("edge_table_div").innerHTML = table;
    $("#edge_table tbody tr").click(function(){
        $(this).addClass('selected').siblings().removeClass('selected');    
        selectedEdgeLabel = $(this).find('td:first').html();
        selectEdgeByLabel(selectedEdgeLabel);
    });
    sorttable.sort_alpha = function(a,b) {
        var as = a[0], bs = b[0];
        var a, b, a1, b1, i= 0, n, L,
        rx=/(\.\d+)|(\d+(\.\d+)?)|([^\d.]+)|(\.\D+)|(\.$)/g;
        if(as === bs) return 0;
        a= as.toUpperCase().match(rx);
        b= bs.toUpperCase().match(rx);
        L= a.length;
        while(i<L){
            if(!b[i]) return 1;
            a1= a[i],
            b1= b[i++];
            if(a1!== b1){
                n= a1-b1;
                if(!isNaN(n)) return n;
                return a1>b1? 1:-1;
            }
        }
        return b[i]? -1:0;
    }
    sorttable.makeSortable(document.getElementById("edge_table"));
}

function buildVertexTable() {
    // show only displayed nodes
    table = '';
    table += "<table border='1' id='vertex_table' class='sortable scroll_table' style='width:" + (leftPanelWidth) + "px'>";
    table += "<thead><tr class='header'><th>Node ID</th><th>Incoming edges(mult.)</th><th>Outgoing edges(mult.)</th><th>Loops</th><th>Balance</th>" + ($('#collapse_repeats_checkbox')[0].checked ? "<th>Size</th>" : "") + "</tr></thead><tbody>";
    var nodes = [];
    var adjEdges = {};
    unbalancedNodes = new Set();
    for (node in graph) {
        var nodeInfo = {};
        nodeInfo['id'] = node;
        nodeInfo['in'] = 0;
        nodeInfo['out'] = 0;
        nodeInfo['in_mult'] = 0;
        nodeInfo['out_mult'] = 0;
        var inCoverage = 0;
        var outCoverage = 0;
        nodeInfo['loop'] = 0;
        for (i = 0; i < Object.keys(graph[node]).length; i++) {
            node2 = Object.keys(graph[node])[i];
            var edgeIds = Array.from(graph[node][node2]);
            for (var j=0; j<edgeIds.length; j++) {
                edgeId = edgeIds[j];

                if (diGraph[node] && diGraph[node][node2] && diGraph[node][node2].has(edgeId)) {
                    if (diGraph[node2] && diGraph[node2][node] && diGraph[node2][node].has(edgeId)) {
                        // calculate loop edges in the node
                        if (edgeData[edgeId] && checkEdge(edgeId))
                            nodeInfo['loop']++;
                        else if (loopEdgeDict[edgeId]) {
                            for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                                if (checkEdge(loopEdgeDict[edgeId][k])) nodeInfo['loop']++;
                            }
                        }
                    }
                    else {
                        edgeRealId = edgeInfo[edgeId] ? edgeId : (edgeData[edgeId] ? edgeData[edgeId].el_id : edgeId);
                        // calculate node outdegree
                        if (edgeData[edgeRealId] && checkEdge(edgeRealId)) {
                            nodeInfo['out']++;
                            nodeInfo['out_mult'] = nodeInfo['out_mult'] + edgeData[edgeRealId].mult;
                            outCoverage += edgeData[edgeRealId].cov;
                        }
                    }
                }
                if (diGraph[node2] && diGraph[node2][node] && diGraph[node2][node].has(edgeId)) {
                    if (diGraph[node] && diGraph[node][node2] && diGraph[node][node2].has(edgeId)) {
                    }
                    else {
                        edgeRealId = edgeInfo[edgeId] ? edgeId : (edgeData[edgeId] ? edgeData[edgeId].el_id : edgeId);
                        // calculate node indegree
                        if (edgeData[edgeRealId] && checkEdge(edgeRealId)) {
                            nodeInfo['in']++;
                            nodeInfo['in_mult'] = nodeInfo['in_mult'] + edgeData[edgeRealId].mult;
                            inCoverage += edgeData[edgeRealId].cov;
                        }
                    }
                }
            }
        }
        nodeInfo['balance'] = Math.abs(nodeInfo['out_mult'] - nodeInfo['in_mult']);
        if (inCoverage && outCoverage && Math.abs(1 - (inCoverage / outCoverage)) > 0.1)
            unbalancedNodes.add(node); // consider node as unbalanced if differencies between coverage of incoming and outgoing edges more than 10%
        nodeInfo['size'] = clusterNodeSizeDict[node] || 0;
        if (!adjEdges[node]) adjEdges[node] = edgeId;
        if (node.indexOf('part') === -1)
            nodes.push(nodeInfo);
    }
    for (i = 0; i < nodes.length; i++) {
        // add only nodes with visible edges
        if (nodes[i]['in'] || nodes[i]['out'] || nodes[i]['loop'])
            table += "<tr id='noderow" + nodes[i]['id'] + "'><td>" + nodes[i]['id'] + "</td><td>" + 
                (nodes[i]['in'] ? nodes[i]['in'] + " (" + nodes[i]['in_mult'] + ")" : "-") + 
                "</td><td>" + (nodes[i]['out'] ? nodes[i]['out'] + " (" + nodes[i]['out_mult'] + ")" : "-") + 
                "</td><td>" + (nodes[i]['loop'] ? nodes[i]['loop'] : "-") + 
                "</td><td>" + nodes[i]['balance'] + "</td>" + 
                ($('#collapse_repeats_checkbox')[0].checked ? ("<td>" + nodes[i]['size'] + "</td>") : "") +"</tr>";
    }
    table += "</tbody></table>";
    document.getElementById("vertex_table_div").innerHTML = table;
    $("#vertex_table tbody tr").click(function(){  
        deselectAll();
        deselectEdge();
        selectedNode = $(this).find('td:first').html();
        console.log(selectedNode)
        
        selectNode(selectedNode);
        zoomToElement('node' + selectedNode);
    });
    sorttable.makeSortable(document.getElementById("vertex_table"));
}

function buildComponentsTable() {
    // take into account only displayed edges
    table = '';
    table += "<table border='1' id='components_table' class='sortable scroll_table'>";
    var components = [];
    var lengths = [];
    var maxEnters = 0;
    var maxExits = 0;
    for (i = 0; i < srcGraphs.length; i++) {
        var componentInfo = {};
        componentInfo['id'] = i;
        dotSrc = srcGraphs[i].dot;
        componentInfo['unique'] = 0;
        componentInfo['repeat'] = 0;
        componentInfo['len'] = 0;
        var dotSrcLines = dotSrc.split('\n');
        var filteredDotLines = [];
        var loopEdges = new Set();
        var loopRepeatEdges = new Set();
        for (j = 0; j < dotSrcLines.length; j++) {
            var matches = dotSrcLines[j].match(idPattern);
            if(matches && matches.length > 1) {
                edgeId = matches[1];
                edgeRealId = edgeInfo[edgeId] ? edgeId : (edgeData[edgeId] ? edgeData[edgeId].el_id : edgeId);
                if (checkEdge(edgeRealId, i)) {
                    if (edgeData[edgeRealId].s === edgeData[edgeRealId].e) {
                        if (edgeData[edgeRealId].unique) loopEdges.add(edgeRealId.replace('e', '').replace('rc', ''));
                        else loopRepeatEdges.add(edgeRealId.replace('e', '').replace('rc', ''));
                    }
                    else {
                        if (edgeData[edgeRealId].unique) componentInfo['unique']++;
                        else componentInfo['repeat']++;
                    }

                    var matches = dotSrcLines[j].match(lenCovPattern);
                    if (matches && matches.length > 2) {
                        edge_len = parseFloat(matches[1]);
                        componentInfo['len'] = componentInfo['len'] + edge_len;
                    }
                    filteredDotLines.push(dotSrcLines[j]);
                }
                else if (baseLoopEdgeDict[edgeId]) {
                    var loopEdgesCount = 0;
                    for (var k = 0; k < baseLoopEdgeDict[edgeId].length; k++) {
                        if (checkEdge(baseLoopEdgeDict[edgeId][k], i)) {
                            loopEdgesCount++;
                            edge = edgeData[baseLoopEdgeDict[edgeId][k]];
                            if (edge.unique) loopEdges.add(edgeId);
                            else loopRepeatEdges.add(edgeId);
                            componentInfo['len'] = componentInfo['len'] + edge.len;
                        }
                    }
                    if (loopEdgesCount) filteredDotLines.push(dotSrcLines[j]);
                }
            }
            else filteredDotLines.push(dotSrcLines[j]);
        }
        componentInfo['unique'] = componentInfo['unique'] + loopEdges.size;
        componentInfo['repeat'] = componentInfo['repeat'] + loopRepeatEdges.size;
        if (selectedMethod == "ref")
            componentInfo['n'] = calculateComponents(parseGraph(filteredDotLines), true);  // show number of connected components
        componentInfo['enter'] = srcGraphs[i].enters;
        componentInfo['exit'] = srcGraphs[i].exits;
        maxEnters = Math.max(maxEnters, srcGraphs[i].enters);
        maxExits = Math.max(maxEnters, srcGraphs[i].exits);
        components.push(componentInfo);
        lengths.push(componentInfo['len'])
    }
    var factor = Math.max.apply(Math, lengths) > 10000 ? 1000 : 1;
    var factorText = factor == 1 ? "kbp" : "Mbp";
    var showExits = maxEnters || maxExits;
    table += "<thead><tr class='header'><th>#</th>" + "<th># unique edges</th>" +
        ($('#collapse_repeats_checkbox')[0].checked ? "" : "<th># repeat edges</th>") +
        (selectedMethod == "ref" || selectedMethod == "contig" ? "<th># components</th>" : "") +
        "<th>Total len (" + factorText + ")</th>" + (showExits ? "<th># entrances</th><th># exits</th>" : "") + "</tr></thead><tbody>";
    var numHiddenRows = 0;
    var numRows = 0;
    for (i = 0; i < components.length; i++) {
        if (components[i]['len']) {
            numRows++;
            // do not show row if the total number of components is > 1000 or the component does not have any edges
            if (components.length < 1000 || components[i]['unique'] > 1 || components[i]['repeat'] > 1) {
                len = components[i]['len'] / 2;
                len = Math.round(components[i]['len'] * 10 / factor) ? Math.round(components[i]['len'] * 10 / factor) / 10 : Math.round(components[i]['len'] * 100 / factor) / 100;
                table += "<tr id='componentrow" + components[i]['id'] + "'><td>" + (components[i]['id'] + 1) +
                    "</td><td>" + (components[i]['unique'] ? Math.round(components[i]['unique'] / 2) : "-") +
                    ($('#collapse_repeats_checkbox')[0].checked ? "" : "</td><td>" +
                        (components[i]['repeat'] ? Math.round(components[i]['repeat'] / 2) : "-")) +
                    (selectedMethod == "ref" || selectedMethod == "contig" ? "</td><td>" + (components[i]['n'] ? components[i]['n'] : "-") : "") +
                    "</td><td>" + len +
                    (showExits ? "</td><td>" + (components[i]['enter'] ? components[i]['enter'] : "-") : "") +
                    (showExits ? "</td><td>" + (components[i]['exit'] ? components[i]['exit'] : "-") : "") +
                    "</td></tr>";
            }
            else numHiddenRows++;
        }
    }
    table += "</tbody></table>";
    if (numHiddenRows > 0) $('#numberRowsWarning').show();
    else $('#numberRowsWarning').hide();
    document.getElementById("components_table_div").innerHTML = table;
    $("#components_table tbody tr").click(function(){
        selectedComponent = parseInt($(this).find('td:first').html()) - 1;
        componentN = selectedComponent;
        changeComponent(selectedComponent);
    });
    if (numRows < 1000) {
        sorttable.makeSortable(document.getElementById("components_table"));
    }
}

function changeToChromosome(chromN) {
    selectedChrom = chromN;
    if (chromN != componentN || selectedMethod != "ref") {
        changeSplitMethod('ref', selectedChrom);
    }
    else highlightChromEdges();
}

function changeToContig(contig){
    selectedContig = contig;
    contigN = contigs.indexOf(contig);
    console.log(contigN)
    if (contigN != componentN || selectedMethod != "contig") {
        changeSplitMethod('contig', contigN);
    }
    else highlightContigEdges();
}

function zoomToElement(elementId) {
    var graphBox = $("#graph0")[0].getBBox();
    if ((graphBox.width > 500 || graphBox.height > 500) && ("#" + elementId)[0]) {
        graphviz.resetZoom();
        var bbox = $("#" + elementId)[0].getBBox();
        var svgBox = d3.select('#graph > svg').attr("viewBox").split(/\s+|,/);
        var svgx = parseInt(svgBox[0]), svgy = parseInt(svgBox[1]), svgw = parseInt(svgBox[2]), svgh = parseInt(svgBox[3]);

        // top-left coordinates of element
        var bx = bbox.x;
        var by = bbox.y;
        var realHeight = parseInt($('#graph > svg').attr('height'));
        var scaleFactor = Math.min(Math.round(svgh / 500), Math.round(svgw / 500));  // zoom to 500px
        var tx = -bx*scaleFactor + svgw/4;
        var ty = -by*scaleFactor + svgh/4;

        var t = d3.zoomTransform(graphviz.zoomSelection().node());
        tx = tx - t.x;
        ty = ty - t.y;
        t = t.translate(tx, ty);
        t = t.scale(scaleFactor);
        graphviz.zoomBehavior().transform(graphviz.zoomSelection(), t); // Translate the zoom transform for the top level svg
        var g = d3.select(d3.select("svg").node().querySelector("g"));
        g.attr('transform', "translate("+tx+","+ty+")"+"scale(" + scaleFactor + ")");
    }
}

function selectNode(selectedNode) {
    $('#noderow' + selectedNode).addClass('selected').siblings().removeClass('selected');
    d3.select('#node' + selectedNode).classed('selected',true);
    var s = "";
    var inEdges = [];
    var outEdges = [];
    var loopEdges = [];
    if (selectedNode.lastIndexOf('part', 0) === 0) {
        // a node represents a hidden part of a large graph
        part = srcPartDict[selectedNode];
        s = 'Graph part, ' + part.n + ' nodes.';
        s = s + ' <span class="link" onclick="javascript:changeComponent(' + part.idx + ');">Show</span>';
        for (var i = 0; i < part.in.length; i++) {
             edgeId = part.in[i];
             if (parallelEdgeDict[edgeId]) {
                bigEdge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_in', true);
                if ((selectedMethod != "repeat" && bigEdge.comp == componentN) || (selectedMethod == "repeat" && bigEdge.rep_comp == componentN)) {
                    for (var k = 0; k < parallelEdgeDict[edgeId].length; k++) {
                        if (defEdgeData[parallelEdgeDict[edgeId][k]]) {
                            edge = edgeData[parallelEdgeDict[edgeId][k]];
                            if ((selectedMethod != "repeat" && edge.comp == componentN) || (selectedMethod == "repeat" && edge.rep_comp == componentN))
                                inEdges.push(edge);
                        }
                    }
                 }
            }
            else if (edgeData[edgeId]) {
                edge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_in', true);
                if ((selectedMethod != "repeat" && edge.comp == componentN) || (selectedMethod == "repeat" && edge.rep_comp == componentN))
                    inEdges.push(edge);
            }
        }
        for (var i = 0; i < part.out.length; i++) {
            edgeId = part.out[i];
             if (parallelEdgeDict[edgeId]) {
                bigEdge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_out', true);
                if ((selectedMethod != "repeat" && bigEdge.comp == componentN) || (selectedMethod == "repeat" && bigEdge.rep_comp == componentN)) {
                    for (var k = 0; k < parallelEdgeDict[edgeId].length; k++) {
                        if (edgeData[parallelEdgeDict[edgeId][k]]) {
                            edge = edgeData[parallelEdgeDict[edgeId][k]];
                                outEdges.push(edge);
                        }
                    }
                }
            }
            else if (edgeData[edgeId]) {
                edge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_out', true);
                if ((selectedMethod != "repeat" && edge.comp == componentN) || (selectedMethod == "repeat" && edge.rep_comp == componentN))
                    outEdges.push(edge);
            }
        }
    }
    else {
        // color incoming and outgoing edges
        var adjEdges = graph[selectedNode];
        if (adjEdges) {
            var adjNodes = Object.keys(adjEdges);
            for (var i = 0; i < adjNodes.length; i++) {
                var edges = Array.from(adjEdges[adjNodes[i]]);
                for (var j = 0; j < edges.length; j++) {
                    edgeId = edges[j];
                    edge = defEdgeData[edgeId];
                    //console.log(edge)
                    if (selectedNode == adjNodes[i]) {
                        if (edgeId.lastIndexOf('loop', 0) === 0) {
                            for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                                edge = edgeData[loopEdgeDict[edgeId][k]];
                                if (checkEdge(loopEdgeDict[edgeId][k]))
                                    loopEdges.push(edge);
                            }
                        }
                        else if (checkEdge(edgeId)) loopEdges.push(edge);
                    }
                    else if (checkEdge(edgeId)) {
                        source = newData[edgeId] ? newData[edgeId][0] : edge.s;
                        end = newData[edgeId] ? newData[edgeId][1] : edge.e;
                        if (end == selectedNode) {
                            d3.select('#' + edgeId).classed('node_selected_in', true);
                            inEdges.push(edge);
                        }
                        else if (source == selectedNode) {
                            d3.select('#' + edgeId).classed('node_selected_out', true);
                            outEdges.push(edge);
                        }
                    }
                }
            }
        }
    }
    if (inEdges.length > 0) {
        s = s + '<ul><b>Incoming edges:</b>';
        inEdges.sort(function(a, b) {
          return b.len - a.len;
        });
        for (var i = 0; i < inEdges.length; i++) {
            s = s + 
                    '<li>Edge ID: ' + inEdges[i].name +
                    ', length: '  + inEdges[i].len +
                    'kb, multiplicity: '  + inEdges[i].mult + '.</li>';
        }
        s = s + '</ul>';
    }
    if (outEdges.length > 0) {
        s = s + '<ul><b>Outgoing edges:</b>';
        outEdges.sort(function(a, b) {
          return b.len - a.len;
        });
        for (var i = 0; i < outEdges.length; i++) {
            s = s + 
                    '<li>Edge ID: ' + outEdges[i].name +
                    ', length: '  + outEdges[i].len +
                    'kb, multiplicity: '  + outEdges[i].mult + '.</li>';
        }
        s = s + '</ul>';
    }
    if (loopEdges.length > 0) {
        s = s + '<ul><b>Loop edges:</b>';
        loopEdges.sort(function(a, b) {
          return b.len - a.len;
        });
        for (var i = 0; i < loopEdges.length; i++) {
            s = s + 
                    '<li>Edge ID: ' + loopEdges[i].name +
                    ', length: '  + loopEdges[i].len +
                    'kb, multiplicity: '  + loopEdges[i].mult + '.</li>';
        }
        s = s + '</ul>';
    }
    document.getElementById('node_info').innerHTML = s;
}

function changeComponent(component, doRefreshTables) {
    // display the specified graph component
    componentN = component;
    if (!srcPartDict || !srcPartDict['part' + componentN] || !srcPartDict['part' + componentN].big) $('#partition_warning').hide();
    else $('#partition_warning').show();
    document.getElementById('component_n').innerHTML = componentN + 1;
    document.getElementById('component_total').innerHTML = srcGraphs.length;
    var chromName = srcGraphs[componentN].chrom ? '(' + srcGraphs[componentN].chrom + ')' : "";
    if (chromName.length > 30)
        chromName = chromName.substr(0, 15) + '...' + chromName.substr(chromName.length-10, chromName.length);
    document.getElementById('component_chromosome').innerHTML = chromName;
    $("#ref_table tbody tr").removeClass('selected');
    deselectAll();
    deselectEdge();
    if (componentN == srcGraphs.length - 1 || srcGraphs[componentN + 1].n < minComponents) {
        $("#next_btn").prop('disabled', true);
    }
    else {
        $("#next_btn").prop('disabled', false);
    }
    if (componentN == 0) {
        $("#prev_btn").prop('disabled', true);
    }
    else {
        $("#prev_btn").prop('disabled', false);
    }
    updateDot(true, false, doRefreshTables);
    if (selectedMethod == "ref")
        updateRefView();
}
 
function attributer(datum, index, nodes) {
    var selection = d3.select(this);
    if (datum.tag == "svg") {
        graphHeight = datum.children[1].translation.y;
        var graphWidth = parseInt(datum.attributes.width);
        var margin = 100;
        var width = window.innerWidth - (leftPanelWidth + margin);
        aspectRatio = (window.innerHeight - margin) / width;
        var height = width * aspectRatio;
        //var height = Math.min(graphHeight, newHeight - 50);

        var x = 0;
        var y = 0;
        var scale = Math.min(1, width / graphWidth);
        document.getElementById("pathDiv").style.width = width + "px";
        console.log(window.innerWidth, width, graphWidth, height, graphHeight, scale, width/scale);
        selection
            .attr("width", width + "px")
            .attr("height", height + "px");
            //.attr("viewBox", x + " " + y + " " + (width / scale) + " " + (height / scale));
        datum.attributes.width = width + "px";
        datum.attributes.height = height + "px";
        datum.attributes.overflow = "hidden";
        datum.attributes.preserveAspectRatio="none";
        datum.attributes.viewBox = x + " " + y + " " + (width / scale) + " " + (height / scale);
        graphHeight = height / scale;
        chromViewWidth = width - 100;
        addRefView();
    }
}

function setupAutocompleteSearch(){
    var maxResults = 30;
    var autocompleteItems = createAutocompleteListItems();

    $( "#searchElementBox" ).autocomplete({
            minLength: 1,
            maxHeight: 200,
            deferRequestBy: 50,
            source: function(request, response) {
                var results = $.ui.autocomplete.filter(autocompleteItems, request.term);
                var additionalLabel = '';
                if (results.length == 0) additionalLabel = 'No results found';
                if (additionalLabel) {
                    results.push({
                        desc: additionalLabel
                    });
                }
                response(results);
            },
            focus: function( event, ui ) {
                $( "#searchElementBox" ).val( ui.item.label );
                return false;
            },
            select: function( event, ui ) {
                if (!ui.item.value)
                    return;
                $( "#searchElementBox" ).val(ui.item.label);
                var itemType = ui.item.value.split(',')[0];
                var itemValue = ui.item.value.split(',')[1];

                if (itemType == 'contig') {
                    selectedContig = itemValue;
                    selectContig(itemValue);
                }
                else if (itemType == 'edge') {
                    selectedEdge = itemValue;
                    selectEdgeByLabel(itemValue);
                }
                else if (itemType == 'chrom') {
                    selectedChrom = itemValue;
                    selectChrom(itemValue);
                }
                return false;
            }
        })
    .focus(function(){
        $(this).autocomplete('search');
    })
    .autocomplete( "instance" )._renderItem = function( ul, item ) {
        return $( "<li>" )
            .append(item.desc)
            .appendTo(ul);
    };
}

function createAutocompleteListItems() {
    var autocompleteItems = [];
    for (x in edgeData) {
        if (edgeData[x].name.toString()[0] !== '-' && x.indexOf('_') === -1) {
            edge = defEdgeData[x] || edgeData[x];
            autocompleteItems.push({
                label: edge.name,
                value: 'edge,' + edge.name,
                desc: 'edge: ' + edge.name
            });
        }
    }
    for (var i = 0; i < enableContigs.length; i++) {
        autocompleteItems.push({
            label: enableContigs[i],
            value: 'contig,' + enableContigs[i],
            desc: 'contig: ' + enableContigs[i]
        })
    }
    for (var i = 0; i < enableChroms.length; i++) {
        autocompleteItems.push({
            label: enableChroms[i],
            value: 'chrom,' + enableChroms[i],
            desc: 'chr: ' + enableChroms[i]
        })
    }
    return autocompleteItems;
}

