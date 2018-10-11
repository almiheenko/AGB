import shlex
import subprocess
import sys
from collections import defaultdict
from os.path import join, abspath

from agb_src.scripts.graph_parser import parse_abyss_dot, parse_flye_dot, parse_gfa, get_edges_from_gfa
from agb_src.scripts.utils import get_edge_agv_id, is_empty_file, find_file_by_pattern, is_osx, get_edge_num, \
    get_canu_id


def parse_canu_output(input_dirpath, output_dirpath, min_edge_len):
    gfa_fpath = find_file_by_pattern(input_dirpath, ".unitigs.gfa")
    if not gfa_fpath:
        print("ERROR! GFA file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    cmd = "sed -i " + ("''" if is_osx() else "") + ' "1s/bogart.edges/1.0/" ' + gfa_fpath
    subprocess.call(shlex.split(cmd))
    dict_edges = parse_gfa(gfa_fpath, min_edge_len, input_dirpath, assembler="canu")
    contig_edges = parse_canu_assembly_info(input_dirpath, dict_edges)
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath, min_edge_len)
    return dict_edges, contig_edges, edges_fpath


def parse_flye_output(input_dirpath, output_dirpath, min_edge_len):
    dot_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gv") or find_file_by_pattern(input_dirpath, "assembly_graph.dot")
    if not dot_fpath:
        print("ERROR! File %s is not found in %s! Please check the options" % (dot_fpath, abspath(input_dirpath)))
        sys.exit(1)
    dict_edges = parse_flye_dot(dot_fpath, min_edge_len)
    contig_edges = parse_flye_assembly_info(input_dirpath, dict_edges)
    gfa_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gfa")
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath, min_edge_len)
    return dict_edges, contig_edges, edges_fpath


def parse_spades_output(input_dirpath, output_dirpath, min_edge_len):
    gfa_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.gfa")
    dict_edges = parse_gfa(gfa_fpath, min_edge_len, input_dirpath, assembler="spades")
    contig_edges = parse_spades_paths(input_dirpath, dict_edges)
    edges_fpath = get_edges_from_gfa(gfa_fpath, output_dirpath, min_edge_len)
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
            edge_id = get_edge_agv_id(get_edge_num(unitig))
            if edge_id in dict_edges:
                contig_id = get_canu_id(contig)
                contig_edges[contig_id].append((start, end, edge_id))
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


def parse_spades_paths(input_dirpath, dict_edges):
    contig_edges = defaultdict(list)
    paths_fpath = join(input_dirpath, "scaffolds.paths")
    if is_empty_file(paths_fpath):
        print("Warning! %s is not found, information about scaffold paths will not be provided" % paths_fpath)
    # NODE_1_length_8242890_cov_19.815448
    # 1893359+,1801779-,1893273-,400678-,1892977+,1869659-,1892443+,272108+,1694470+,1893863+
    with open(paths_fpath) as f:
        contig = None
        start = 0
        for line in f:
            if line.strip().endswith("'"):
                contig = None
            elif line.startswith("NODE"):
                contig = line.strip()
                start = 0
                continue
            elif contig:
                edges = line.strip().replace(';', '').split(',')
                for edge_name in edges:
                    edge_num = int(edge_name[:-1])
                    if edge_name[-1] == '-':
                        edge_num *= -1
                    edge_id = get_edge_agv_id(edge_num)
                    if edge_id in dict_edges:
                        edge_len = dict_edges[edge_id].length
                        contig_edges[contig].append((str(start), str(start + edge_len), edge_id))
                        start += edge_len
                start += 10  # NNNNNNNNNN
    return contig_edges


'''def parse_abyss_output(input_dirpath, output_dirpath):
    gfa_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.gfa2") or \
                find_file_by_pattern(input_dirpath, "-scaffolds.gfa") or \
                find_file_by_pattern(input_dirpath, "-contigs.gfa2") or \
                find_file_by_pattern(input_dirpath, "-contigs.gfa")
    if not is_empty_file(gfa_fpath):
        dict_edges = parse_gfa(gfa_fpath, input_dirpath)
    else:
        dot_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.dot") or \
                    find_file_by_pattern(input_dirpath, "-scaffolds.gv")
        if not dot_fpath:
            print("ERROR! DOT file is not found in %s! Please check the options" % abspath(input_dirpath))
            sys.exit(1)
        dict_edges = parse_abyss_dot(dot_fpath)
    contig_edges = []
    return dict_edges, contig_edges'''

