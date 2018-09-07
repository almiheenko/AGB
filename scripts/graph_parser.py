import re
from collections import defaultdict

import gfapy
import networkx as nx

from scripts.edge import Edge
from scripts.utils import get_edge_agv_id, calculate_mean_cov, get_edge_num, find_file_by_pattern, is_empty_file

repeat_colors = ["red", "darkgreen", "blue", "goldenrod", "cadetblue1", "darkorchid", "aquamarine1",
                 "darkgoldenrod1", "deepskyblue1", "darkolivegreen3"]


def parse_abyss_dot(dot_fpath):
    '''digraph adj {
    graph [k=50]
    edge [d=-49]
    "3+" [l=99 C=454]
    "3-" [l=99 C=454]
    '''
    dict_edges = dict()
    predecessors = defaultdict(list)
    successors = defaultdict(list)

    edge_pattern = '"?(?P<edge_id>\d+)(?P<edge_sign>[\+\-])"? (?P<info>.+)'
    link_pattern = '"?(?P<start>\d+)(?P<start_sign>[\+\-])"? -> "?(?P<end>\d+)(?P<end_sign>[\+\-])"?'
    info_pattern = 'l=(?P<edge_len>\d+) C=(?P<edge_cov>\d+)'
    with open(dot_fpath) as f:
        for line in f:
            if 'l=' in line:
                #  "3+" -> "157446-" [d=-45]
                match = re.search(edge_pattern, line)
                if not match or len(match.groups()) < 3:
                    continue
                edge_id, edge_sign, info = match.group('edge_id'), match.group('edge_sign'), match.group('info')
                edge_name = (edge_sign if edge_sign != '+' else '') + edge_id
                edge_id = get_edge_agv_id(edge_name)
                match = re.search(info_pattern, info)
                if match and len(match.groups()) == 2:
                    cov = max(1, int(match.group('edge_cov')))
                    edge_len = max(1, int(float(match.group('edge_len'))))
                    edge = Edge(edge_id, edge_name, edge_len, cov, element_id=edge_id)
                    dict_edges[edge_id] = edge
            if '->' in line:
                #  "3+" -> "157446-" [d=-45]
                match = re.search(link_pattern, line)
                if not match or len(match.groups()) < 2:
                    continue
                start, start_sign, end, end_sign = match.group('start'), match.group('start_sign'), match.group('end'), match.group('end_sign')
                start_edge_id = get_edge_agv_id((start_sign if start_sign == '-' else '') + start)
                end_edge_id = get_edge_agv_id((end_sign if end_sign == '-' else '') + end)
                predecessors[end_edge_id].append(start_edge_id)
                successors[start_edge_id].append(end_edge_id)

    dict_edges = construct_graph(dict_edges, predecessors, successors)
    return dict_edges


def parse_flye_dot(dot_fpath):
    dict_edges = dict()

    pattern = '"?(?P<start>\d+)"? -> "?(?P<end>\d+)"? \[(?P<info>.+)]'
    label_pattern = 'id (?P<edge_id>\-*.+) (?P<edge_len>[0-9\.]+)k (?P<coverage>\d+)'
    with open(dot_fpath) as f:
        for line in f:
            if 'label =' in line:
                # "7" -> "29" [label = "id 1\l53k 59x", color = "black"] ;
                line = line.replace('\\l', ' ')
                match = re.search(pattern, line)
                if not match or len(match.groups()) < 3:
                    continue
                start, end, info = match.group('start'), match.group('end'), match.group('info')
                params_dict = dict(param.split(' = ') for param in info.split(', ') if '=' in param)
                # label = params_dict.get('label')
                color = params_dict.get('color').strip().replace('"', '')
                line = line.replace(' ,', ',')
                match = re.search(label_pattern, info)
                if match and match.group('edge_id'):
                    edge_id = get_edge_agv_id(match.group('edge_id'))
                    cov = max(1, int(match.group('coverage')))
                    edge_len = max(1, int(float(match.group('edge_len')) * 1000))
                    edge = Edge(edge_id, match.group('edge_id'), edge_len, cov, element_id=edge_id)
                    edge.color = color
                    if edge.color != "black":
                        edge.repetitive = True
                    edge.start, edge.end = int(start), int(end)
                    if 'dir = both' in line:
                        edge.two_way = True
                    dict_edges[edge_id] = edge
    dict_edges = calculate_multiplicities(dict_edges)
    return dict_edges


def parse_canu_unitigs_info(input_dirpath, dict_edges):
    tiginfo_fpath = find_file_by_pattern(input_dirpath, ".contigs.layout.tigInfo")
    if not is_empty_file(tiginfo_fpath):
        with open(tiginfo_fpath) as f:
            for i, line in enumerate(f):
                if i == 0:
                    header = line.strip().split()
                    repeat_col = header.index("sugRept") if "sugRept" in header else None
                    cov_col = header.index("coverage") if "coverage" in header else None
                    if repeat_col is None or cov_col is None:
                        break
                    continue
                fs = line.strip().split()
                edge_id = get_edge_agv_id(get_edge_num(fs[0]))
                rc_edge_id = get_edge_agv_id(-get_edge_num(fs[0]))
                if edge_id in dict_edges:
                    coverage = int(float(fs[cov_col]))
                    dict_edges[edge_id].cov = coverage
                    dict_edges[rc_edge_id].cov = coverage
                    if fs[repeat_col] == "yes":
                        dict_edges[edge_id].repetitive = True
                        dict_edges[rc_edge_id].repetitive = True
                else:
                    print("Warning! Edge %s is not found!" % edge_id)
    return dict_edges


def parse_gfa(input_dirpath, gfa_fpath, assembler=None):
    gfa = gfapy.Gfa.from_file(gfa_fpath,vlevel = 0)
    links = []
    with open(gfa_fpath) as f:
        for line in f:
            if line[0] != 'L':
                continue
            _, from_name, from_orient, to_name, to_orient = line.split()[:5]
            links.append((from_name, from_orient, to_name, to_orient))

    dict_edges = dict()
    predecessors = defaultdict(list)
    successors = defaultdict(list)
    g = nx.DiGraph()
    ### gfa retains only canonical links
    for link in links:
        from_name, from_orient, to_name, to_orient = link
        edge1 = get_edge_agv_id(get_edge_num(from_name))
        edge2 = get_edge_agv_id(get_edge_num(to_name))
        if from_orient == '-': edge1 = 'rc' + edge1[1:]
        if to_orient == '-': edge2 = 'rc' + edge2[1:]
        if edge1 != edge2:
            predecessors[edge2].append(edge1)
            successors[edge1].append(edge2)
        g.add_edge(edge1, edge2)

    for i, n in enumerate(gfa.segments):
        if n.KC:
            cov = n.KC / n.length  ## k-mer count / edge length
        else:
            cov = 1
        edge_id = get_edge_agv_id(get_edge_num(n.name))
        edge = Edge(edge_id, get_edge_num(n.name), n.length, cov, element_id=edge_id)
        dict_edges[edge_id] = edge
        rc_edge_id = get_edge_agv_id(-get_edge_num(n.name))
        rc_edge = Edge(rc_edge_id, -get_edge_num(n.name), n.length, cov, element_id=rc_edge_id)
        dict_edges[rc_edge_id] = rc_edge

    if assembler == "canu":
        dict_edges = parse_canu_unitigs_info(input_dirpath, dict_edges)
    dict_edges = construct_graph(dict_edges, predecessors, successors)
    return dict_edges


def calculate_multiplicities(dict_edges):
    mean_cov = calculate_mean_cov(dict_edges)
    for name in dict_edges:
        multiplicity = dict_edges[name].cov / mean_cov
        dict_edges[name].multiplicity = max(1, round(multiplicity))
        if multiplicity > 1:
            dict_edges[name].repetitive = True
    return dict_edges


def construct_graph(dict_edges, predecessors, successors):
    dict_edges = calculate_multiplicities(dict_edges)

    ### construct graph
    node_id = 1
    graph = defaultdict(set)
    for edge_name in dict_edges.keys():
        start_node = None
        for prev_e in predecessors[edge_name]:
            if dict_edges[prev_e].end:
                start_node = dict_edges[prev_e].end
            if dict_edges[edge_name].repetitive and dict_edges[prev_e].repetitive:
                graph[edge_name].add(prev_e)
        for prev_e in predecessors[edge_name]:
            for next_e in successors[prev_e]:
                if dict_edges[next_e].start:
                    start_node = dict_edges[next_e].start
                if dict_edges[edge_name].repetitive and dict_edges[next_e].repetitive:
                    graph[edge_name].add(next_e)
        if not start_node:
            start_node = node_id
            node_id += 1
        end_node = None
        for next_e in successors[edge_name]:
            if dict_edges[next_e].start:
                end_node = dict_edges[next_e].start
            if dict_edges[edge_name].repetitive and dict_edges[next_e].repetitive:
                graph[edge_name].add(next_e)
        for next_e in successors[edge_name]:
            for prev_e in predecessors[next_e]:
                if dict_edges[prev_e].end:
                    end_node = dict_edges[prev_e].end
                if dict_edges[edge_name].repetitive and dict_edges[prev_e].repetitive:
                    graph[edge_name].add(prev_e)
        if not end_node:
            end_node = node_id
            node_id += 1
        dict_edges[edge_name].start = start_node
        dict_edges[edge_name].end = end_node

    ### color repeat edges
    colored_edges = set()
    color_idx = 0
    for edge_name in dict_edges.keys():
        if not dict_edges[edge_name].repetitive:
            continue
        if edge_name in colored_edges:
            continue
        for e in dfs_color(graph, edge_name):
            dict_edges[e].color = repeat_colors[color_idx % len(repeat_colors)]
            colored_edges.add(e)
        color_idx += 1
    return dict_edges


def dfs_color(graph, start, visited=None):
    if visited is None:
        visited = set()
    visited.add(start)
    for next in graph[start] - visited:
        dfs_color(graph, next, visited)
    return visited

