function setupInterfaceBtns() { 
    var minLeftPanelHeight = 800;
    console.log(window.innerHeight)
    
    addModeSwitch();
    if (window.innerHeight <= minLeftPanelHeight) {
        document.getElementById("left_panel").style.height = minLeftPanelHeight + "px";
        document.getElementById("left_panel").style.overflowY = "scroll";
    }
    else {
        document.getElementById("left_panel").style.height = (window.innerHeight - 80) + "px";
    }
    // document.getElementById('title').innerHTML = capitalizeFirstLetter(title);
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
        hideEdgesByThresholds(false, false, true);
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
        highlightNodes();
    });

    $('#adj_edges_option').hide();

    $('#default_mode').on("click",function(){
        changeSplitMethod('default');
        $('#default_mode').attr('disabled','disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#ref_mode').on("click",function(){
        changeSplitMethod('ref');
        $('#default_mode').removeAttr('disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').attr('disabled','disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#contig_mode').on("click",function(){
        changeSplitMethod('contig');
        $('#default_mode').removeAttr('disabled');
        $('#repeat_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#contig_mode').attr('disabled','disabled');
    });
    $('#repeat_mode').on("click",function(){
        changeSplitMethod('repeat');
        $('#default_mode').removeAttr('disabled');
        $('#ref_mode').removeAttr('disabled');
        $('#repeat_mode').attr('disabled','disabled');
        $('#contig_mode').removeAttr('disabled');
    });
    $('#adj_edges_checkbox').on('change', function() {
        hideEdgesByThresholds(false, true, false);
    });
    $('#show_labels').on('change', function() {
        if (!this.checked)
            d3.selectAll('.edge').selectAll('text').style('display','none');
        else
            d3.selectAll('.edge').selectAll('text').style('display','');
    });

    addColorSelect();
    document.getElementById('color_select').onchange = function(event) {
        document.getElementById('repeat_info').style.display = 'none';
        document.getElementById('errors_info').style.display = 'none';
        if (document.getElementById('color_select').selectedIndex == 2) document.getElementById('errors_info').style.display = '';
        if (document.getElementById('color_select').selectedIndex == 3) document.getElementById('repeat_info').style.display = '';
        hideEdgesByThresholds(false, false, false);
    };

    function submitOnEnter(event){
        if(event.which === 13){
            document.getElementById('draw_edges_btn').click();
            event.preventDefault();
        }
    }

    $('#saveBtns').hide();
    $('#saveButton').on('click', function(){
        try {
            var isFileSaverSupported = !!new Blob();
        } catch (e) {
            alert("blob not supported");
        }

        var html = d3.select("svg")
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
    /*document.getElementById("edges_textarea").addEventListener("keypress", submitOnEnter);
    document.getElementById('draw_edges_btn').onclick = function(event) {
        var err_msg = '';
        if (document.getElementById('edges_textarea').value.length < 1)
            err_msg = 'Please specify at least one edge';
        else {
            selectedEdges = document.getElementById('edges_textarea').value.split(',');
            for (i = 0; i < selectedEdges.length; i++) {
                edge = selectedEdges[i];
                edgeId = edge[0] == '-' ? 'redge' + edge.substr(1) : 'edge' + edge;
                if (!edgeInfo[edgeId])
                    err_msg = 'Edge ' + edge + ' does not exist! Please check edge ID and resubmit';
            }
        }
        if (err_msg) alert(err_msg);
        else window.open("fa2.html?" + selectedEdges.join(','));
    };*/
}

function addModeSwitch(){
    var div = "";
    var divWidth = 120;
    if (Object.keys(edgeDataRef).length) divWidth += 70;
    if (Object.keys(edgeDataContig).length) divWidth += 50;
    div += '<div style="padding-top:-30px; width:' + divWidth + 'px; text-align:center">Mode</div>';
    div += '<div class="btn-group btn-group-toggle" data-toggle="buttons">';
    div += '<label class="btn btn-info active option_mode" id="default_mode">';
    div += '<input type="radio" name="mode" autocomplete="off" checked> default';
    div += '</label>';
    div += '<label class="btn btn-info option_mode" id="repeat_mode">';
    div += '<input type="radio" name="mode" autocomplete="off" checked> repeat';
    div += '</label>';
    if (Object.keys(edgeDataRef).length) {
        div += '<label class="btn btn-info option_mode" id="ref_mode">';
        div += '<input type="radio" name="mode" autocomplete="off" val="ref"> reference';
        div += '</label>';
    }
    if (Object.keys(edgeDataContig).length) {
        div += '<label class="btn btn-info option_mode" id="contig_mode">';
        div += '<input type="radio" name="mode" autocomplete="off" val="contig"> contig';
        div += '</label>';
    }
    div += '</div>';
     document.getElementById('div_switch').innerHTML = div;
}

function addColorSelect(){
    var selectOptions = '<option value="0" selected>repeated edges</option>';
    if (Object.keys(edgeDataRef).length) {
        selectOptions += '<option value="1">edges mapping to reference</option>';
        selectOptions += '<option value="2">erroneous edges</option>';
    }
    selectOptions += '<option value="3">high covered edges</option>';
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
        edgeData = edgeDataRef;
        srcPartDict = refPartitionDict;
        hangNodes = defaultHangNodes;
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
        edgeData = edgeDataContig;
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
        edgeData = edgeDataRepeat;
        hangNodes = repeatHangNodes;
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
        edgeData = edgeDataFull;
        srcPartDict = partitionDict;
        hangNodes = defaultHangNodes;
        selectedChrom = "";
    }
    changeComponent(componentN, true);
    deselectContig();
    $("#contig_table tbody tr").removeClass('selected');
    $("#edge_table tbody tr").removeClass('selected');
    $("#vertex_table tbody tr").removeClass('selected');
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
        hideEdgesByThresholds(false, true, true);
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
        hideEdgesByThresholds(false, true, true);
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
        hideEdgesByThresholds(false, true, true);
    }
}

function buildContigsTable() {
    if (!Object.keys(contigInfo).length) {
        document.getElementById("contig_tab").style.display="none";
        return;
    }
    var showAssemblyErrors = chromosomes.length > 0;
    table = '';
    table += "<table border='1' id='contig_table' class='sortable scroll_table' style='width:" + (leftPanelWidth) + "px'>";
    table += "<thead><tr class='header'><th>Contig</th><th>Len (Kb)</th><th>Cov</th><th># edges</th>" +
        (showAssemblyErrors ? "<th># errors</th>" : "") + "</tr></thead><tbody>";
    enableContigs = [];
    for (x in contigInfo) {
        contigLen = contigInfo[x].length;
        contigLen = contigLen < 10000 ? Math.round(contigLen / 100) / 10 : Math.round(contigLen / 1000);
        edgesN = 0;
        errorsN = 0;
        if (misassembledContigs && misassembledContigs[x]) errorsN = misassembledContigs[x].length;
        for (i = 0; i < contigInfo[x].edges.length; i++) {
            edge = contigInfo[x].edges[i];
            if (edge != "*" && edge != "??") {
                edgeElId = edge[0] == '-' ? 'rc' + edge.substr(1) : 'e' + edge;
                //edgeId = getEdgeElement(edgeData[edgeElId]);
                if (checkEdge(edgeElId)) {
                     edgesN++;
                     errorsN = errorsN + edgeData[edgeElId].errors.length;
                }
            }
        }
        // if (edgesN) {
            enableContigs.push(x);
            table += "<tr id='contigrow" + x + "'><td>" + x + "</td><td>" + contigLen + "</td><td>" + contigInfo[x].cov +
                "</td><td>" + (edgesN ? edgesN : "-") + (showAssemblyErrors ? "</td><td>" + (errorsN ? errorsN : "-") : "") + "</td>" + "</tr>";
        // }
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
    if (chromosomes.length == 0) {
        document.getElementById("ref_tab").style.display="none";
        return;
    }
    table = '';
    table += "<table border='1' id='ref_table' class='sortable scroll_table' style='width:" + (leftPanelWidth) + "px'>";
    chromosomesData = {};
    chromosomesContigs = {};
    var contigsFound = false;
    var chromLengths = [];
    enableChroms = [];
    for (x in edgeMappingInfo) {
        for (i = 0; i < edgeMappingInfo[x].length; i++) {
            chrom = edgeMappingInfo[x][i];
            chromosomesData[chrom] = chromosomesData[chrom] || [];
            if (checkEdge(x, chromosomes.indexOf(chrom))) {
                if (x[0] == "e") chromosomesData[chrom].push(x);
                if (edgeInfo[x]) {
                    chromosomesContigs[chrom] = chromosomesContigs[chrom] || new Set();
                    for (var j = 0; j < edgeInfo[x].length; j++) {
                        chromosomesContigs[chrom].add(edgeInfo[x][j])
                    }
                    contigsFound = true;
                }
            }
        }
    }
    for (chrom in chrom_lengths) {
        chromLengths.push(chrom_lengths[chrom]);
    }
    var factor = Math.max.apply(Math, chromLengths) > 100000000 ? 1000000 : 1000;
    var factorText = factor == 1000 ? "Kb" : "Mb";
    table += "<thead><tr class='header'><th>Chromosome</th><th>Len (" + factorText + ")</th><th># edges</th>" +
        (contigsFound ? "<th># contigs</th>" : "") + "</tr></thead><tbody>";
    for (chrom in chrom_lengths) {
        len = Math.round(chrom_lengths[chrom] * 10 / factor) ? Math.round(chrom_lengths[chrom] * 10 / factor) / 10 : Math.round(chrom_lengths[chrom] * 100 / factor) / 100;
        table += "<tr id='chromrow" + chrom + "'><td>" + chrom + "</td><td>" + len + "</td><td>" + (chromosomesData[chrom] ? chromosomesData[chrom].length : '-') +
            (contigsFound ? ("</td><td>" + (chromosomesContigs[chrom] ? chromosomesContigs[chrom].size : '-')) : "") + "</td></tr>";
        enableChroms.push(chrom);
    }
    table += "</tbody></table>";
    document.getElementById("ref_table_div").innerHTML = table;
    $("#ref_table tbody tr").click(function(){
        $(this).addClass('selected').siblings().removeClass('selected');    
        selectedChromName = $(this).find('td:first').html();
        selectChrom(selectedChromName);
    });
    sorttable.makeSortable(document.getElementById("ref_table"));
    if (srcGraphs[componentN].chrom) {
        $('#chromrow' + srcGraphs[componentN].chrom).addClass('selected').siblings().removeClass('selected');
    } 
}

function buildEdgesTable() {
    table = '';
    table += "<table border='1' id='edge_table' class='sortable scroll_table' style='width:" + (leftPanelWidth) + "px'>";
    table += "<thead><tr class='header'><th>Edge</th><th>Len (Kb)</th><th>Cov</th><th>Mult.</th></tr></thead><tbody>";
    enableEdges = [];
    for (x in edgeData) {
        if (edgeData[x].name.toString()[0] != '-' && x.indexOf('_') == -1 && checkEdge(x) && 
            (selectedMethod != "ref" || !isNaN(parseInt(edgeDataRef[x].ref_comp)))) {
            enableEdges.push(edgeDataFull[x] || edgeData[x]);
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
    sorttable.makeSortable(document.getElementById("edge_table"));
}

function buildVertexTable() {
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
                //if (!d3.select('#' + edgeId).empty() == componentN) adjEdges[node] = componentN;
                if (diGraph[node] && diGraph[node][node2] && diGraph[node][node2].has(edgeId)) {
                    if (diGraph[node2] && diGraph[node2][node] && diGraph[node2][node].has(edgeId)) {
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
                        if (edgeData[edgeRealId] && checkEdge(edgeRealId)) {
                            nodeInfo['in']++;
                            nodeInfo['in_mult'] = nodeInfo['in_mult'] + edgeData[edgeRealId].mult;
                            inCoverage += edgeData[edgeRealId].cov;
                        }
                    }
                    /*else if (loopEdgeDict[edgeId]) {
                        for (var k = 0; k < loopEdgeDict[edgeId].length; k++) {
                            if (checkEdge(loopEdgeDict[edgeId][k])) nodeInfo['in_mult'] = nodeInfo['in_mult'] + edgeData[loopEdgeDict[edgeId][k]].mult;
                        }
                    }*/
                }
            }
        }
        nodeInfo['balance'] = Math.abs(nodeInfo['out_mult'] - nodeInfo['in_mult']);
        if (inCoverage && outCoverage && Math.abs(1 - (inCoverage / outCoverage)) > 0.1)
            unbalancedNodes.add(node);
        nodeInfo['size'] = clusterNodeSizeDict[node] || 0;
        if (!adjEdges[node]) adjEdges[node] = edgeId;
        if (node.indexOf('part') === -1)
            nodes.push(nodeInfo);
    }
    for (i = 0; i < nodes.length; i++) {
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
    table = '';
    table += "<table border='1' id='components_table' class='sortable scroll_table' style='width:" + (leftPanelWidth-11) + "px'>";
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
                    if (edgeId[0] === "e") {
                        if (edgeData[edgeRealId].s === edgeData[edgeRealId].e) {
                            if (edgeData[edgeRealId].unique) loopEdges.add(edgeRealId);
                            else loopRepeatEdges.add(edgeRealId);
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
                            if (edge.id[0] === "e") {
                                componentInfo['len'] = componentInfo['len'] + edge.len;
                            }
                        }
                    }
                    if (loopEdgesCount) filteredDotLines.push(dotSrcLines[j]);
                }
            }
            else filteredDotLines.push(dotSrcLines[j]);
        }
        componentInfo['unique'] = componentInfo['unique'] + loopEdges.size;
        componentInfo['repeat'] = componentInfo['repeat'] + loopRepeatEdges.size;
        if (selectedMethod == "ref" || selectedMethod == "contig")
            componentInfo['n'] = calculateComponents(toGraph(filteredDotLines));
        componentInfo['enter'] = srcGraphs[i].enters;
        componentInfo['exit'] = srcGraphs[i].exits;
        maxEnters = Math.max(maxEnters, srcGraphs[i].enters);
        maxExits = Math.max(maxEnters, srcGraphs[i].exits);
        components.push(componentInfo);
        lengths.push(componentInfo['len'])
    }
    var factor = Math.max.apply(Math, lengths) > 10000 ? 1000 : 1;
    var factorText = factor == 1 ? "Kb" : "Mb";
    var showExits = maxEnters || maxExits;
    table += "<thead><tr class='header'><th>#</th>" + "<th># unique edges</th>" +
        ($('#collapse_repeats_checkbox')[0].checked ? "" : "<th># repeat edges</th>") +
        (selectedMethod == "ref" || selectedMethod == "contig" ? "<th># components</th>" : "") +
        "<th>Total len (" + factorText + ")</th>" + (showExits ? "<th># entrances</th><th># exits</th>" : "") + "</tr></thead><tbody>";
    for (i = 0; i < components.length; i++) {
        if (components[i]['len']) {
            len = Math.round(components[i]['len'] * 10 / factor) ? Math.round(components[i]['len'] * 10 / factor) / 10 : Math.round(components[i]['len'] * 100 / factor) / 100;
            table += "<tr id='componentrow" + components[i]['id'] + "'><td>" + (components[i]['id'] + 1) +
                "</td><td>" + (components[i]['unique'] ? components[i]['unique'] : "-") +
                ($('#collapse_repeats_checkbox')[0].checked ? "" : "</td><td>" + (components[i]['repeat'] ? components[i]['repeat'] : "-")) + 
                (selectedMethod == "ref" || selectedMethod == "contig" ? "</td><td>" + (components[i]['n'] ? components[i]['n'] : "-") : "") +
                "</td><td>" + len + 
                (showExits ? "</td><td>" + (components[i]['enter'] ? components[i]['enter'] : "-") : "") + 
                (showExits ? "</td><td>" + (components[i]['exit'] ? components[i]['exit'] : "-") : "") + 
                "</td></tr>";
        }
    }
    table += "</tbody></table>";
    document.getElementById("components_table_div").innerHTML = table;
    $("#components_table tbody tr").click(function(){
        selectedComponent = parseInt($(this).find('td:first').html()) - 1;
        componentN = selectedComponent;
        changeComponent(selectedComponent);
    });
    if (components.length < 1000)
        sorttable.makeSortable(document.getElementById("components_table"));
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
    else highlightChromEdges();
}

function zoomToElement(elementId) {
    var graphBox = $("#graph0")[0].getBBox();
    if ((graphBox.width > 500 || graphBox.height > 500) && ("#" + elementId)[0]) {
        var b = $("#" + elementId)[0].getBBox();
        var scaleFactor = Math.ceil(graphBox.width / 400);
        //console.log(b)
        var zoomX = (-b.x)*scaleFactor+100;
        var zoomY = (-b.y)*scaleFactor+100;
        d3.select('svg').transition()
          .duration(150)
          .call(d3.zoom().transform,
                d3.zoomIdentity
                .translate(zoomX, zoomY)
                .scale(scaleFactor));
        d3.select("#graph0").attr("transform", "translate("+zoomX+","+zoomY+")"+"scale(" + scaleFactor + ")");
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
        part = srcPartDict[selectedNode];
        s = 'Graph part, ' + part.n + ' nodes.';
        s = s + ' <span class="link" onclick="javascript:changeComponent(' + part.idx + ');">Show</span>';
        for (var i = 0; i < part.in.length; i++) {
             edgeId = part.in[i];
             if (uniqueEdgesDict[edgeId]) {
                bigEdge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_in', true);
                if ((selectedMethod != "repeat" && bigEdge.comp == componentN) || (selectedMethod == "repeat" && bigEdge.rep_comp == componentN)) {
                    for (var k = 0; k < uniqueEdgesDict[edgeId].length; k++) {
                        if (edgeDataFull[uniqueEdgesDict[edgeId][k]]) {
                            edge = edgeData[uniqueEdgesDict[edgeId][k]];
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
             if (uniqueEdgesDict[edgeId]) {
                bigEdge = edgeData[edgeId];
                d3.select('#' + edgeId).classed('node_selected_out', true);
                if ((selectedMethod != "repeat" && bigEdge.comp == componentN) || (selectedMethod == "repeat" && bigEdge.rep_comp == componentN)) {
                    for (var k = 0; k < uniqueEdgesDict[edgeId].length; k++) {
                        if (edgeData[uniqueEdgesDict[edgeId][k]]) {
                            edge = edgeData[uniqueEdgesDict[edgeId][k]];
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
        var adjEdges = graph[selectedNode];
        if (adjEdges) {
            var adjNodes = Object.keys(adjEdges);
            for (var i = 0; i < adjNodes.length; i++) {
                var edges = Array.from(adjEdges[adjNodes[i]]);
                for (var j = 0; j < edges.length; j++) {
                    edgeId = edges[j];
                    edge = edgeDataFull[edgeId];
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
    hideEdgesByThresholds(true, false, doRefreshTables);
    if (selectedMethod == "ref")
        updateRefView();
}
 
function attributer(datum, index, nodes) {
    var selection = d3.select(this);
    if (datum.tag == "svg") {
        var graphHeight = datum.children[1].translation.y;
        var graphWidth = parseInt(datum.attributes.width);
        var margin = 100;
        var width = window.innerWidth - (leftPanelWidth + margin);
        var ratio = (window.innerHeight - margin) / width;
        var height = width * ratio;
        //var height = Math.min(graphHeight, newHeight - 50);

        var x = 0;
        var y = 0;
        var scale = Math.min(1, width/graphWidth);
        document.getElementById("pathDiv").style.width = width + "px";
        console.log(window.innerWidth,width, graphWidth, height, scale, width/scale);
        selection
            .attr("width", width + "px")
            .attr("height", height + "px");
            //.attr("viewBox", x + " " + y + " " + (width / scale) + " " + (height / scale));
        datum.attributes.width = width + "px";
        datum.attributes.height = height + "px";
        datum.attributes.overflow = "hidden";
        datum.attributes.preserveAspectRatio="none";
        datum.attributes.viewBox = x + " " + y + " " + (width / scale) + " " + (height / scale);
        chromViewWidth = width - 100;
        addRefView();
    }
}

function moveEdgeStartPoint(edge, endNode, x1, y1) {
    var endNodeEl = endNode.select('ellipse');
    _updateEdge(edge, x1, y1, endNodeEl.attr('cx'),endNodeEl.attr('cy'), true);

    return this;
}
    
function moveEdgeEndPoint(edge, startNode, x2, y2) {
    var startNodeEl = startNode.select('ellipse');
    _updateEdge(edge, startNodeEl.attr('cx'), startNodeEl.attr('cy'), x2, y2);

    return this;
}

function _updateEdge(edge, x1, y1, x2, y2, isStart) {
    var line = edge.selectWithoutDataPropagation("path");
    var id = edge.attr("id");
    var shortening = 0;
    var arrowHeadLength = 10;
    var nodeMargin = 11;
    var arrowHeadWidth = 6;
    var margin = 0.174;
    var edgeOffset = 10;

    var arrowHeadPoints = [[0, -arrowHeadWidth / 2], [arrowHeadLength, 0], [0, arrowHeadWidth / 2], [0, -arrowHeadWidth / 2]];

    var x1 = parseFloat(x1), x2 = parseFloat(x2), y1 = parseFloat(y1), y2 = parseFloat(y2);
    var dx = x2 - x1;
    var dy = y2 - y1;
    var length = Math.sqrt(dx * dx + dy * dy);
    var cosA = dx / length;
    var sinA = dy / length;

    if (!isStart) {
        x1 = x1 + edgeOffset*cosA;
        y1 = y1 + edgeOffset*sinA;
        x2 = x1 + (length - shortening - (arrowHeadLength + nodeMargin + margin)) * cosA;
        y2 = y1 + (length - shortening - (arrowHeadLength + nodeMargin + margin)) * sinA;
    }
    else {
        x1 = x1 + edgeOffset*cosA;
        y1 = y1 + edgeOffset*sinA;
        x2 = x2 - edgeOffset*cosA;
        y2 = y2 - edgeOffset*sinA;
    }

    var line = edge.selectWithoutDataPropagation("path");
    var arrowHead = edge.selectWithoutDataPropagation("polygon");
    var text =  edge.selectWithoutDataPropagation("text");

    var path1 = path();
    path1.moveTo(x1, y1)
    //path1.lineTo(x2, y2);
    //path1.quadraticCurveTo(x1, y1, x2, y2)
    path1='M'+x1+',' + y1 + 'Q'+x1+','+y1+','+x2+',' +y2
    line.attr("d", path1);

    var pos = line.node().getPointAtLength(line.node().getTotalLength()/2);
    text.attr('x', pos.x);
    text.attr('y', x2>x1 == y2>y1 ? pos.y-5 : pos.y+5);
    text.attr('text-anchor', 'left');

    x2 = x1 + (length - shortening - (arrowHeadLength + nodeMargin + edgeOffset)) * cosA;
    y2 = y1 + (length - shortening - (arrowHeadLength + nodeMargin + edgeOffset)) * sinA;

    for (var i = 0; i < arrowHeadPoints.length; i++) {
        var point = arrowHeadPoints[i];
        arrowHeadPoints[i] = rotate(point[0], point[1], cosA, sinA);
    }
    for (var i = 0; i < arrowHeadPoints.length; i++) {
        var point = arrowHeadPoints[i];
        arrowHeadPoints[i] = [x2 + point[0], y2 + point[1]];
    }
    var allPoints = [];
    for (var i = 0; i < arrowHeadPoints.length; i++) {
        var point = arrowHeadPoints[i];
        allPoints.push(point.join(','));
    }
    var pointsAttr = allPoints.join(' ');

    arrowHead.attr("points", pointsAttr);

    return this;
}
function rotate(x, y, cosA, sinA) {
    // (x + j * y) * (cosA + j * sinA) = x * cosA - y * sinA + j * (x * sinA + y * cosA)
    y = -y;
    sinA = -sinA;
    var _ref = [x * cosA - y * sinA, x * sinA + y * cosA];
    x = _ref[0];
    y = _ref[1];

    y = -y;
    return [x, y];
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
            edge = edgeDataFull[x] || edgeData[x];
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

