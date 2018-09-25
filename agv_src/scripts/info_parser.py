import subprocess
import sys
from collections import defaultdict
from os.path import join, abspath

from agv_src.scripts.graph_parser import parse_abyss_dot, parse_flye_dot, parse_gfa, get_edges_from_gfa
from agv_src.scripts.utils import get_edge_agv_id, is_empty_file, find_file_by_pattern, is_osx, get_edge_num, \
    get_canu_id


def parse_abyss_output(input_dirpath):
    dot_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.dot")
    if not dot_fpath:
        print("ERROR! DOT file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    dict_edges = parse_abyss_dot(dot_fpath)
    contig_edges = []
    edges_fpath = None
    if not is_empty_file(find_file_by_pattern(input_dirpath, "-scaffolds.fa")):
        edges_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.fa")
    return dict_edges, contig_edges, edges_fpath


def parse_canu_output(input_dirpath, output_dirpath):
    gfa_fpath = find_file_by_pattern(input_dirpath, ".contigs.gfa")
    if not gfa_fpath:
        print("ERROR! GFA file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    cmd = ["sed", "-i"] + (["''"] if is_osx() else []) + ["1s/bogart.edges/1.0/", gfa_fpath]
    subprocess.call(cmd)
    dict_edges = parse_gfa(gfa_fpath, input_dirpath, assembler="canu")
    contig_edges = parse_canu_assembly_info(input_dirpath, dict_edges)
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath)
    return dict_edges, contig_edges, edges_fpath


def parse_flye_output(input_dirpath, output_dirpath):
    dot_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gv")
    if not dot_fpath:
        print("ERROR! File %s is not found in %s! Please check the options" % (dot_fpath, abspath(input_dirpath)))
        sys.exit(1)
    dict_edges = parse_flye_dot(dot_fpath)
    contig_edges = parse_flye_assembly_info(input_dirpath, dict_edges)
    gfa_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gfa")
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath)
    return dict_edges, contig_edges, edges_fpath


def parse_spades_output(input_dirpath, output_dirpath):
    gfa_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gfa")
    dict_edges = parse_gfa(gfa_fpath, input_dirpath)
    contig_edges = []
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath)
    return dict_edges, contig_edges, edges_fpath


def parse_canu_assembly_info(input_dirpath, dict_edges):
    contig_edges = defaultdict(list)
    unitigs_fpath = find_file_by_pattern(input_dirpath, ".unitigs.bed")
    if is_empty_file(unitigs_fpath):
        print("Warning! Unitigs.bed is not found, information about contigs will not be provided")
    with open(unitigs_fpath) as f:
        for line in f:
            fs = line.strip().split()
            contig, start, end, unitig = fs[:4]
            edge_id = get_canu_id(get_edge_num(contig))
            if edge_id in dict_edges:
                contig_edges[unitig].append((start, end, edge_id))
    return contig_edges


def parse_flye_assembly_info(input_dirpath, dict_edges):
    contig_edges = defaultdict(list)
    info_fpath = join(input_dirpath, "assembly_info.txt")
    if is_empty_file(info_fpath):
        print("Warning! Assembly_info.txt is not found, information about contigs will not be provided")
    with open(info_fpath) as f:
        for i, line in enumerate(f):
            if i == 0:
                # header = line.strip().split()
                continue
            fs = line.strip().split()
            contig = fs[0]
            path = fs[-1]
            edges = path.split(',')
            start = 0
            for edge_name in edges:
                edge_id = get_edge_agv_id(edge_name)
                if edge_id in dict_edges:
                    edge_len = dict_edges[edge_id].length
                    contig_edges[contig].append((str(start), str(start + edge_len), edge_id))
                    start += edge_len
    return contig_edges

