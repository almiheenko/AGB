import json
import subprocess
import sys
from collections import defaultdict, OrderedDict
from os.path import join, abspath

from scripts.graph_parser import parse_abyss_dot, parse_flye_dot, parse_gfa
from scripts.utils import natural_sort, get_edge_agv_id, is_empty_file, find_file_by_pattern, is_osx, get_edge_num, \
    get_canu_id


def parse_abyss_output(input_dirpath):
    dot_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.dot")
    if not dot_fpath:
        print("ERROR! DOT file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    dict_edges = parse_abyss_dot(dot_fpath)
    contig_edges = []
    return dict_edges, contig_edges


def parse_canu_output(input_dirpath):
    gfa_fpath = find_file_by_pattern(input_dirpath, ".contigs.gfa")
    if not gfa_fpath:
        print("ERROR! GFA file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    cmd = ["sed", "-i"] + (["''"] if is_osx() else []) + ["1s/bogart.edges/1.0/", gfa_fpath]
    subprocess.call(cmd)
    dict_edges = parse_gfa(input_dirpath, gfa_fpath, assembler="canu")
    contig_edges = parse_canu_assembly_info(input_dirpath, dict_edges)
    return dict_edges, contig_edges


def parse_flye_output(input_dirpath):
    dot_fpath = find_file_by_pattern(input_dirpath, "assembly_graph.dot")
    if not dot_fpath:
        print("ERROR! DOT file is not found in %s! Please check the options" % abspath(input_dirpath))
        sys.exit(1)
    dict_edges = parse_flye_dot(dot_fpath)
    contig_edges = parse_flye_assembly_info(input_dirpath, dict_edges)
    return dict_edges, contig_edges


def parse_spades_output(input_dirpath):
    gfa_fpath = find_file_by_pattern(input_dirpath, ".contigs.gfa")
    dict_edges = parse_gfa(input_dirpath, gfa_fpath)
    contig_edges = []
    return dict_edges, contig_edges


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


def parse_mapping_info(output_dirpath, json_output_dir, contig_edges, dict_edges):
    mapping_info = defaultdict(set)
    strict_mapping_info = defaultdict(set)

    mapping_fpath = join(output_dirpath, "mapping.paf")
    if is_empty_file(mapping_fpath):
        print("No information about mapping to reference genome")
        with open(join(json_output_dir, "reference.json"), 'w') as handle:
            handle.write("chrom_lengths='" + json.dumps([]) + "';\n")
            handle.write("mapping_info='" + json.dumps([]) + "';\n")
        return None, None, None

    chrom_lengths = dict()
    contig_mappings = defaultdict(lambda: defaultdict(list))
    with open(mapping_fpath) as f:
        for line in f:
            # contig_1        257261  14      160143  -       chr13   924431  196490  356991  147365  161095  60      tp:A:P  cm:i:14049      s1:i:147260     s2:i:4375       dv:f:0.0066
            fs = line.split()
            contig = fs[0]
            start, end = int(fs[2]), int(fs[3])
            chrom, chrom_len = fs[5], int(fs[6])
            chrom_lengths[chrom] = chrom_len
            contig_mappings[contig][chrom].append((start, end))

    chroms_by_edge = defaultdict(set)
    edge_by_chrom = defaultdict(set)
    chrom_names = set()
    for contig in contig_mappings:
        for chrom, mappings in contig_mappings[contig].items():
            mappings.sort(key=lambda x: (x[0], -x[1]), reverse=False)
        cum_len = 0
        for edge in contig_edges[contig]:
            edge_s, edge_e, edge_id = edge
            edge_s, edge_e = int(edge_s), int(edge_e)
            edge_len = edge_e - edge_s + 1
            len_threshold = max(500, 0.9 * edge_len)

            for chrom, mappings in contig_mappings[contig].items():
                covered_len = 0
                last_pos = 0
                for (start, end) in mappings:
                    if end <= edge_s:
                        continue
                    if start >= edge_e:
                        break
                    start = max(start, edge_s, last_pos)
                    end = min(end, edge_e)
                    covered_len += max(0, end - start + 1)
                    last_pos = max(last_pos, end + 1)
                if covered_len >= len_threshold:
                    chroms_by_edge[edge_id].add(chrom)
                    chrom_names.add(chrom)
                    edge_by_chrom[chrom].add(edge_id)
            cum_len += edge_len

    chrom_len_dict = OrderedDict((chrom, chrom_lengths[chrom]) for i, chrom in enumerate(list(natural_sort(chrom_names))))
    non_alt_chroms = [c for c in chrom_names if 'alt' not in c and 'random' not in c and 'chrUn' not in c]
    chrom_order = OrderedDict((chrom, i) for i, chrom in enumerate(list(natural_sort(non_alt_chroms))))
    color_list = ['#e6194b', '#3cb44b', '#ffe119', '#1792d4', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#d2f53c',
                  '#fabebe', '#00dbb1', '#dba2ff', '#aa6e28', '#83360e', '#800000', '#003bff', '#808000', '#8d73d4',
                  '#000080', '#806680', '#51205a', '#558859', '#d1a187', '#87a1d1', '#87a1d1', '#afd187']

    for edge_id, chroms in chroms_by_edge.items():
        match_edge_id = edge_id.replace('rc', 'e') if edge_id.startswith('rc') else edge_id.replace('e', 'rc')
        for chrom in chroms:
            mapping_info[edge_id].add(chrom)
            strict_mapping_info[edge_id].add(chrom)
            if match_edge_id in dict_edges:
                mapping_info[match_edge_id].add(chrom)
                edge_by_chrom[chrom].add(match_edge_id)

    for edge_id, chroms in mapping_info.items():
        mapping_info[edge_id] = list(chroms)
        if len(chroms) == 1:
            chrom = chroms.pop()
            color = color_list[chrom_order[chrom]] if chrom in chrom_order else '#808080'
            dict_edges[edge_id].chrom = color
        elif chroms:
            colors = set()
            for chrom in chroms:
                color = color_list[chrom_order[chrom]] if chrom in chrom_order else '#808080'
                colors.add(color)
            if len(colors) <= 4:
                dict_edges[edge_id].chrom = ':white:'.join(list(colors))
            else:
                dict_edges[edge_id].chrom = 'red:black:red:black'
    with open(join(json_output_dir, "reference.json"), 'w') as handle:
        handle.write("chrom_lengths='" + json.dumps(chrom_len_dict) + "';\n")
        handle.write("mapping_info='" + json.dumps(mapping_info) + "';\n")
    return strict_mapping_info, non_alt_chroms, edge_by_chrom

