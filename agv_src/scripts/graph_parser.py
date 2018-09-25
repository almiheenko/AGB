import re
import sys
import subprocess
from os.path import join, basename
from collections import defaultdict

import gfapy
import networkx as nx

from agv_src.scripts.config import *
from agv_src.scripts.edge import Edge
from agv_src.scripts.utils import get_edge_agv_id, calculate_median_cov, get_edge_num, find_file_by_pattern, \
    is_empty_file, can_reuse, is_osx

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
                # else:
                #    print("Warning! Edge %s is not found!" % edge_id)
    return dict_edges


def get_edges_from_gfa(gfa_fpath, output_dirpath):
    edges_fpath = join(output_dirpath, "edges.fasta")
    if not is_empty_file(gfa_fpath) and not can_reuse(edges_fpath, files_to_check=[gfa_fpath]):
        gfa = gfapy.Gfa.from_file(gfa_fpath,vlevel = 0)
        with open(edges_fpath, "w") as f:
            for edge in gfa.segments:
                f.write(">%s\n" % get_edge_agv_id(get_edge_num(edge.name)))
                f.write(edge.sequence)
                f.write("\n")
    return edges_fpath


def format_edges_file(input_fpath, output_dirpath):
    if is_empty_file(input_fpath):
        return None
    edges_fpath = join(output_dirpath, "edges.fasta")
    if not can_reuse(edges_fpath, files_to_check=[input_fpath]):
        with open(input_fpath) as f:
            with open(edges_fpath, "w") as out_f:
                for line in f:
                    if line.startswith('>'):
                        edge_id = get_edge_agv_id(get_edge_num(line[1:]))
                        out_f.write(">%s\n" % edge_id)
                    else:
                        out_f.write(line)
    return edges_fpath


def fastg_to_gfa(input_fpath, output_dirpath, assembler):
    k8_exec = join(TOOLS_DIR, "k8-darwin") if is_osx() else join(TOOLS_DIR, "k8-linux")
    gfatools_exec = join(TOOLS_DIR, "gfatools.js")
    if gfatools_exec and k8_exec:
        output_fpath = join(output_dirpath, basename(input_fpath).replace("fastg", "gfa"))
        cmd = None
        if assembler.lower == SPADES_NAME.lower():
            cmd = "spades2gfa"
        elif assembler.lower == ABYSS_NAME.lower():
            cmd = "abyss2gfa"
        elif assembler.lower == SGA_NAME.lower():
            cmd = "sga2gfa"
        elif assembler.lower == SOAP_NAME.lower():
            cmd = "soap2gfa"
        elif assembler.lower == VELVET_NAME.lower():
            cmd = "velvet2gfa"
        if not cmd:
            sys.exit("FASTG files produced by " + assembler + " are not supported. Supported assemblers: " +
                     ' '.join([ABYSS_NAME, SGA_NAME, SOAP_NAME, SPADES_NAME, VELVET_NAME]) + " or use files in GFA format.")
        cmdline = [k8_exec, gfatools_exec, cmd, input_fpath]
        subprocess.call(cmdline, stdout=output_fpath, stderr=open("/dev/null", "w"))
        if not is_empty_file(output_fpath):
            return output_fpath


def parse_gfa(gfa_fpath, input_dirpath=None, assembler=None):
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

    if assembler == "canu" and input_dirpath:
        dict_edges = parse_canu_unitigs_info(input_dirpath, dict_edges)
    dict_edges = construct_graph(dict_edges, predecessors, successors)
    return dict_edges


def calculate_multiplicities(dict_edges):
    median_cov = calculate_median_cov(dict_edges)
    for name in dict_edges:
        multiplicity = dict_edges[name].cov / median_cov
        dict_edges[name].multiplicity = 1 if multiplicity <= 1.75 else round(multiplicity)
        if dict_edges[name].multiplicity > 1:
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

