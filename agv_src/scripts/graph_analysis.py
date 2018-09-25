import json
import math
from os.path import join
from collections import defaultdict

import nxmetis
import networkx as nx

from agv_src.scripts.config import MAX_NODES, MAX_SUB_NODES
from agv_src.scripts.edge import Edge
from agv_src.scripts.utils import print_dot_header, natural_sort
from agv_src.scripts.viewer_data import ViewerData


def process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges, output_dirpath, suffix,
                  base_graph=None, contig_edges=None, chrom_names=None, edge_by_chrom=None, mapping_info=None):
    last_idx = 0
    parts_info = dict()
    graph = []
    modified_dict_edges = dict()
    loop_edges = defaultdict(set)
    hanging_nodes = []
    connected_nodes = []
    enters = []
    exits = []
    base_graph = base_graph or g

    chrom_list = []
    contig_list = []
    complex_component = False
    if chrom_names and suffix == "ref":
        for chrom in list(natural_sort(chrom_names)):
            edges = edge_by_chrom[chrom]
            ref_g = nx.DiGraph()
            for edge_id in set(edges):
                ref_g.add_edge(dict_edges[edge_id].start, dict_edges[edge_id].end)
            viewer_data, last_idx, sub_complex_component = \
                split_graph(ref_g, g, undirected_g, dict_edges, modified_dict_edges, loop_edges, edges_by_nodes,
                            two_way_edges, last_idx, parts_info, mapping_info=mapping_info, chrom=chrom)
            parts_info = viewer_data.parts_info
            graph.extend(viewer_data.g)
            for i in range(len(viewer_data.g)):
                chrom_list.append(chrom)
            complex_component = complex_component or sub_complex_component
        with open(join(output_dirpath, 'reference.json'), 'a') as handle:
            handle.write("chromosomes='" + json.dumps(chrom_list) + "';\n")
    elif contig_edges and suffix == "contig":
        for contig, edges in contig_edges.items():
            contig_g = nx.DiGraph()
            edge_ids = set()
            for edge in edges:
                _, _, edge_id = edge
                contig_g.add_edge(dict_edges[edge_id].start, dict_edges[edge_id].end)
                edge_ids.add(edge_id)
            viewer_data, last_idx, sub_complex_component = \
                split_graph(contig_g, g, undirected_g, dict_edges, modified_dict_edges, loop_edges, edges_by_nodes,
                            two_way_edges, last_idx, parts_info, contig_edges=edge_ids)
            parts_info = viewer_data.parts_info
            for i in range(len(viewer_data.g)):
                contig_list.append(contig)
            graph.extend(viewer_data.g)
    elif suffix == "repeat" or suffix == "def":
        ## combine reverse complement edges
        fake_edges = []
        for edge_id, edge in dict_edges.items():
            if edge_id.startswith("rc"): continue
            if suffix == "repeat" and not edge.repetitive: continue
            match_edge_id = edge_id.replace("e", "rc")
            if match_edge_id not in dict_edges: continue
            match_edge_nodes = [dict_edges[match_edge_id].start, dict_edges[match_edge_id].end]
            if not any([e in undirected_g.neighbors(edge.start) for e in match_edge_nodes]) and not \
                    any([e in undirected_g.neighbors(edge.end) for e in match_edge_nodes]):
                g.add_edge(edge.end, dict_edges[match_edge_id].start)
                g.add_edge(edge.start, dict_edges[match_edge_id].end)
                fake_edges.append((edge.start, dict_edges[match_edge_id].end))
                fake_edges.append((edge.end, dict_edges[match_edge_id].start))
        connected_components = list(nx.weakly_connected_component_subgraphs(g))
        if fake_edges:
            g.remove_edges_from(fake_edges)
        for i, subgraph in enumerate(connected_components):
            viewer_data, last_idx, sub_complex_component = \
                split_graph(subgraph, base_graph, undirected_g, dict_edges, modified_dict_edges, loop_edges, edges_by_nodes,
                        two_way_edges, last_idx, parts_info,
                        fake_edges=fake_edges, find_hanging_nodes=suffix == "def", is_repeat_graph=suffix == "repeat")
            parts_info = viewer_data.parts_info
            graph.extend(viewer_data.g)
            hanging_nodes.extend(viewer_data.hanging_nodes)
            connected_nodes.extend(viewer_data.connected_nodes)
            enters.extend(viewer_data.enters)
            exits.extend(viewer_data.exits)
    edges_by_component = save_graph(graph, hanging_nodes, connected_nodes, enters, exits, dict_edges, modified_dict_edges,
                                    loop_edges, parts_info, output_dirpath, suffix,
                                    complex_component=complex_component,
                                    mapping_info=mapping_info, chrom_list=chrom_list, contig_list=contig_list)
    return edges_by_component


def split_graph(sub_g, g, undirected_g, dict_edges, modified_dict_edges, loop_edges, edges_by_nodes, two_way_edges, last_idx, parts_info,
                  is_repeat_graph=False, fake_edges=None, find_hanging_nodes=False, mapping_info=None, chrom=None, contig_edges=None):
    graphs = []
    hanging_nodes = []
    connected_nodes = []
    num_enters = []
    num_exits = []

    complex_component = False
    if len(sub_g) > MAX_NODES:
        complex_component = True
        target_graph_parts = int(math.ceil(len(sub_g.nodes()) / MAX_SUB_NODES))
        options = nxmetis.MetisOptions(ncuts=5, niter=100, ufactor=2, objtype=1, contig=not mapping_info, minconn=True)
        edgecuts, parts = nxmetis.partition(sub_g.to_undirected(), target_graph_parts, options=options)
        graph_partition_dict = dict()
        for part_id, nodes in enumerate(parts):
            for node in nodes:
                graph_partition_dict[node] = part_id
        num_graph_parts = len(parts)
        # print('Partition:', edgecuts, len(parts), num_graph_parts, parts[0])
    else:
        graph_partition_dict = dict((n, 0) for n in sub_g.nodes())
        parts = [[sub_g.nodes()]]
        num_graph_parts = 1

    # print(last_idx, ' ', num_graph_parts)
    for part_id in range(num_graph_parts):
        parts_info['part' + str(last_idx + part_id)] = \
            {'n': len(parts[part_id]), 'big': False if num_graph_parts == 1 else True, 'idx': last_idx + part_id,
             'in': set(), 'out': set()}

    edges_count = defaultdict(int)

    def is_flanking_edge(edge_id):
        if mapping_info:
            return chrom not in mapping_info[edge_id]
        if is_repeat_graph:
            return not dict_edges[edge_id].repetitive
        if contig_edges:
            return edge_id not in contig_edges
        return False

    if fake_edges:
        sub_g.remove_edges_from(fake_edges)
    for part_id in range(num_graph_parts):
        subgraph = []
        subnodes = []
        sub_hanging_nodes = []
        sub_connected_nodes = []
        main_edges = defaultdict(set)
        flanking_edges = defaultdict(set)
        total_exits = 0
        total_enters = 0
        for e in sub_g.edges():
            start, end = e[0], e[1]
            if part_id == graph_partition_dict[start] or part_id == graph_partition_dict[end]:
                edges = edges_by_nodes[(start, end)] + two_way_edges[(start, end)]
                for edge_id in edges:
                    if not is_flanking_edge(edge_id):
                        main_edges[(start, end)].add(edge_id)
                flanking_edge_pairs = [(start, node) for node in undirected_g.neighbors(start)] + \
                                      [(node, start) for node in undirected_g.neighbors(start)] + \
                                      [(end, node) for node in undirected_g.neighbors(end)] + \
                                      [(node, end) for node in undirected_g.neighbors(end)]
                for start, end in flanking_edge_pairs:
                    for edge_id in edges_by_nodes[(start, end)] + two_way_edges[(start, end)]:
                        if is_flanking_edge(edge_id):
                            flanking_edges[(start, end)].add(edge_id)

        unique_nodes = set()
        for graph_edges, is_flanking in [(main_edges, False), (flanking_edges, True)]:
            for (start, end), edges in graph_edges.items():
                if is_repeat_graph and is_flanking:
                    unique_nodes.add(start)
                    unique_nodes.add(end)
                link_component = last_idx + part_id
                if start in graph_partition_dict and graph_partition_dict[start] != part_id:
                    link_component = last_idx + graph_partition_dict[start]
                    start = 'part' + str(link_component)
                elif end in graph_partition_dict and graph_partition_dict[end] != part_id:
                    link_component = last_idx + graph_partition_dict[end]
                    end = 'part' + str(link_component)
                if link_component != last_idx + part_id:
                    for edge_id in edges:
                        edge = dict_edges[edge_id]
                        new_edge_id = edge.id
                        if edges_count[edge.id]:
                            new_edge_id = edge.id + '_' + str(edges_count[edge.id])
                        edges_count[edge.id] += 1
                        if start == 'part' + str(link_component):
                            parts_info['part' + str(link_component)]['out'].add(new_edge_id)
                        else:
                            parts_info['part' + str(link_component)]['in'].add(new_edge_id)
                        new_edge = edge.create_copy(start, end)
                        modified_dict_edges[new_edge_id] = new_edge
                        subgraph.append(new_edge_id)
                elif start != end or len(edges) < 2:
                    for edge_id in edges:
                        edge = dict_edges[edge_id]
                        new_edge_id = edge.id
                        if edges_count[edge.id]:
                            new_edge_id = edge.id + '_' + str(edges_count[edge.id])
                        edges_count[edge.id] += 1
                        new_edge = edge.create_copy(start, end)
                        modified_dict_edges[new_edge_id] = new_edge
                        subgraph.append(new_edge_id)
                else:
                    edge_id = 'loop%s' % start
                    loop_edge = Edge(edge_id)
                    loop_edge.start, loop_edge.end = start, end
                    loop_edge.is_complex_loop = True
                    #modified_dict_edges[edge_id] = loop_edge
                    subgraph.append(edge_id)
                    for loop_edge_id in edges:
                        edge = dict_edges[loop_edge_id]
                        modified_dict_edges[loop_edge_id] = edge
                        loop_edges[edge_id].add(loop_edge_id)

        graphs.append((len(subgraph) + 10000 * (num_graph_parts - part_id), subgraph))
        if find_hanging_nodes:
            for n in sub_g.nodes():
                if graph_partition_dict[n] != part_id:
                    continue
                in_multiplicity = 0
                out_multiplicity = 0
                for e in g.in_edges(n):
                    edges = edges_by_nodes[(e[0], e[1])] + two_way_edges[(e[0], e[1])]
                    for edge_id in edges:
                        in_multiplicity += dict_edges[edge_id].multiplicity
                for e in g.out_edges(n):
                    edges = edges_by_nodes[(e[0], e[1])] + two_way_edges[(e[0], e[1])]
                    for edge_id in edges:
                        out_multiplicity += dict_edges[edge_id].multiplicity
                if not g.in_degree(n) or not g.out_degree(n):
                    sub_hanging_nodes.append(n)
                elif int(out_multiplicity - in_multiplicity) != 0:
                    subnodes.append(n)
            hanging_nodes.append(sub_hanging_nodes)
        if is_repeat_graph:
            for n in sub_g.nodes():
                if graph_partition_dict[n] != part_id:
                    continue
                if not g.in_degree(n) or not g.out_degree(n):
                    sub_hanging_nodes.append(n)
            for n in unique_nodes:
                if not g.in_degree(n) or not g.out_degree(n):
                    sub_hanging_nodes.append(n)
            for n in unique_nodes:
                enters = 0
                exits = 0
                other_edges = 0
                for e in g.in_edges(n):
                    start, end = e[0], e[1]
                    edges = edges_by_nodes[(start, end)] + two_way_edges[(start, end)]
                    for edge_id in edges:
                        if start == end:
                            continue
                        if edge_id in subgraph and dict_edges[edge_id].repetitive:
                            continue
                        if edge_id in subgraph:
                            if start != end:
                                exits += 1
                        else:
                            if start != end or n not in sub_g.nodes():
                                other_edges += 1
                for e in g.out_edges(n):
                    start, end = e[0], e[1]
                    edges = edges_by_nodes[(start, end)] + two_way_edges[(start, end)]
                    for edge_id in edges:
                        if start == end:
                            continue
                        if edge_id in subgraph and dict_edges[edge_id].repetitive:
                            continue
                        if edge_id in subgraph:
                            if start != end:
                                enters += 1
                        else:
                            if start != end or n not in sub_g.nodes():
                                other_edges += 1
                if other_edges:
                    sub_connected_nodes.append(n)
                    total_exits += exits
                    total_enters += enters
            connected_nodes.append(sub_connected_nodes)
            hanging_nodes.append(sub_hanging_nodes)
            num_enters.append(total_enters)
            num_exits.append(total_exits)
    last_idx += num_graph_parts
    viewer_data = ViewerData(graphs, hanging_nodes, connected_nodes, modified_dict_edges, parts_info,
                             enters=num_enters, exits=num_exits)
    return viewer_data, last_idx, complex_component


def save_graph(graph, hanging_nodes, connected_nodes, enters, exits, dict_edges, modified_dict_edges,
               loop_edges, parts_info, output_dirpath, suffix,
               mapping_info=None, complex_component=False, chrom_list=None, contig_list=None):
    if not complex_component:
        if connected_nodes:
            sorted_graph = sorted(zip(graph, hanging_nodes, connected_nodes, enters, exits), key=lambda pair: pair[0], reverse=True)
            graph = [x for x, _, _, _, _ in sorted_graph]
            hanging_nodes = [x for _, x, _, _, _ in sorted_graph]
            connected_nodes = [x for _, _, x, _, _ in sorted_graph]
            enters = [x for _, _, _, x, _ in sorted_graph]
            exits = [x for _, _, _, _, x in sorted_graph]
        elif hanging_nodes:
            sorted_graph = sorted(zip(graph, hanging_nodes), key=lambda pair: pair[0], reverse=True)
            graph = [x for x, _ in sorted_graph]
            hanging_nodes = [x for _, x in sorted_graph]

    edges_by_component = dict()
    with open(join(output_dirpath, suffix + '_graph.json'), 'w') as out_f:
        out_f.write(suffix + '_graphs=[')
        for i, (n, subgraph) in enumerate(graph):
            additional_info = ""
            if chrom_list:
                additional_info = 'chrom: "%s", ' % chrom_list[i]
            elif contig_list:
                additional_info = 'contig: "%s", ' % contig_list[i]
            if enters or exits:
                additional_info = 'enters: %d, exits: %d, ' % (enters[i], exits[i])
            out_f.write('{n:%d, ' % len(subgraph) + additional_info + 'dot:')
            out_f.write('`')
            print_dot_header(out_f)
            chrom = chrom_list[i] if chrom_list else None
            for edge_id in set(subgraph):
                edge = modified_dict_edges[edge_id] if edge_id in modified_dict_edges else None
                real_id = edge.id if edge else edge_id
                if real_id in dict_edges:
                    if not mapping_info or (mapping_info[real_id] and chrom in mapping_info[real_id]):
                        if suffix == "def":
                            modified_dict_edges[edge_id].component = i
                        elif suffix == "repeat":
                            modified_dict_edges[edge_id].repeat_component = i
                        elif suffix == "ref":
                            modified_dict_edges[edge_id].ref_component = i
                    edges_by_component[real_id] = i
                else:
                    edge = Edge(real_id)
                    edge.is_complex_loop = True
                    colors = set()
                    for loop_e in loop_edges[real_id]:
                        ###!!!!
                        real_id = dict_edges[loop_e].id if loop_e in dict_edges else loop_e
                        if not mapping_info or (mapping_info[real_id] and chrom in mapping_info[real_id]):
                            if suffix == "def":
                                modified_dict_edges[loop_e].component = i
                            elif suffix == "repeat":
                                modified_dict_edges[loop_e].repeat_component = i
                            elif suffix == "ref":
                                modified_dict_edges[loop_e].ref_component = i
                            modified_dict_edges[loop_e].element_id = edge_id
                            edges_by_component[loop_e] = i
                            edges_by_component[real_id] = i
                            edge.start, edge.end = modified_dict_edges[loop_e].start, modified_dict_edges[loop_e].start
                            colors.add(modified_dict_edges[loop_e].color)
                    if len(colors) == 1:
                        edge.color = colors.pop()
                if edge.start is not None:
                    out_f.write(edge.print_edge_to_dot(id=edge_id))
            out_f.write('}`},')
        out_f.write('];')

    for e, loops in loop_edges.items():
        loop_edges[e] = list(loops)

    for part_id in parts_info:
        parts_info[part_id]['in'] = list(parts_info[part_id]['in'])
        parts_info[part_id]['out'] = list(parts_info[part_id]['out'])
    with open(join(output_dirpath, suffix + '_partition_info.json'), 'w') as handle:
        handle.write(suffix + "_parts_info='" + json.dumps(parts_info) + "';")

    with open(join(output_dirpath, suffix + '_edges_data.json'), 'w') as handle:
        json_dict_edges = dict((edge_id, edge.as_dict()) for edge_id, edge in modified_dict_edges.items())
        handle.write(suffix + "_edge_data='" + json.dumps(json_dict_edges) + "';")
        handle.write(suffix + "_loop_edges='" + json.dumps(loop_edges) + "';")

    if suffix == "def" or suffix=="repeat":
        with open(join(output_dirpath, suffix + '_node_info.json'), 'w') as handle:
            handle.write(suffix + "_hanging_nodes='" + json.dumps(hanging_nodes) + "';")

    if suffix == "repeat":
        with open(join(output_dirpath, suffix + '_node_info.json'), 'a') as handle:
            handle.write(suffix + "_connected_nodes='" + json.dumps(connected_nodes) + "';")
    return edges_by_component
