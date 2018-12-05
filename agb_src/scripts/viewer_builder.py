import json
import re
from collections import defaultdict

import networkx as nx

from agb_src.scripts.config import *
from agb_src.scripts.graph_analysis import process_graph
from agb_src.scripts.utils import print_dot_header, get_edge_agv_id, calculate_median_cov, is_empty_file, \
    find_file_by_pattern, get_edge_num, get_canu_id, get_scaffolds_fpath, is_flye, is_canu, is_spades, edge_id_to_name, \
    get_match_edge_id


def build_jsons(dict_edges, input_dirpath, output_dirpath, mapping_info, chrom_names, edge_by_chrom, contig_edges, assembler):
    edges_by_nodes = defaultdict(list)
    two_way_edges = defaultdict(list)

    g = nx.DiGraph()
    repeat_g = nx.DiGraph()

    with open(join(output_dirpath, 'assembly_graph.json'), 'w') as out_f:
        out_f.write('full_graph=`')
        print_dot_header(out_f)
        for edge in dict_edges.values():
            g.add_edge(edge.start, edge.end)
            if edge.repetitive:
                repeat_g.add_edge(edge.start, edge.end)
            edges_by_nodes[(edge.start, edge.end)].append(edge.id)
            if edge.two_way:
                two_way_edges[(edge.start, edge.end)].append(edge.id)
            out_f.write(edge.print_edge_to_dot())
        out_f.write('}`')

    undirected_g = g.to_undirected()
    print("Building JSON files...")
    edges_by_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges, output_dirpath, 'def', assembler)
    edges_by_repeat_component = process_graph(repeat_g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                              output_dirpath, 'repeat', assembler, base_graph=g)
    edges_by_ref_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                           output_dirpath, 'ref', assembler, chrom_names=chrom_names,
                                           edge_by_chrom=edge_by_chrom, mapping_info=mapping_info)
    edges_by_contig_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                              output_dirpath, 'contig', assembler, contig_edges=contig_edges)
    create_contig_info(dict_edges, input_dirpath, output_dirpath, contig_edges,
                       edges_by_component, edges_by_repeat_component, edges_by_ref_component, assembler)
    with open(join(output_dirpath, 'title.json'), 'w') as handle:
        handle.write("title='yeast';\n")


def parse_canu_contigs_info(input_dirpath):
    contig_info = dict()
    edges_by_contig = defaultdict(list)
    unitigs_info_fpath = find_file_by_pattern(input_dirpath, "unitigs.bed")
    if input_dirpath and not is_empty_file(unitigs_info_fpath):
        with open(unitigs_info_fpath) as f:
            for line in f:
                fs = line.strip().split()
                contig, start, end, unitig = fs[:4]
                strand = fs[-1]
                edge_name = get_edge_num(unitig) if strand == "+" else -get_edge_num(unitig)
                contig_id = get_canu_id(contig)
                edges_by_contig[contig_id].append(str(edge_name))
    contigs_info_fpath = find_file_by_pattern(input_dirpath, "contigs.layout.tigInfo")
    if input_dirpath and not is_empty_file(contigs_info_fpath):
        len_col = None
        cov_col = None
        with open(contigs_info_fpath) as f:
            for i, line in enumerate(f):
                if i == 0:
                    header = line.strip().split()
                    len_col = header.index("tigLen") if "tigLen" in header else None
                    cov_col = header.index("coverage") if "coverage" in header else None
                    if len_col is None or cov_col is None:
                        break
                    continue
                fs = line.strip().split()
                length = int(float(fs[len_col]))
                coverage = int(float(fs[cov_col]))
                contig_id = get_canu_id(fs[0])
                if contig_id in edges_by_contig:
                    contig_info[contig_id] = {'length': length, 'cov': coverage, 'mult': 1}
    for contig_id, edges in edges_by_contig.items():
        contig_info[contig_id]['edges'] = edges
    return contig_info


def parse_flye_contigs_info(input_dirpath):
    contig_info = dict()
    if input_dirpath and not is_empty_file(join(input_dirpath, 'assembly_info.txt')):
        with open(join(input_dirpath, 'assembly_info.txt')) as f:
            for i, line in enumerate(f):
                if i == 0:
                    header = line.strip().split()
                    continue
                fs = line.strip().split()
                contig = fs[0]
                path = fs[-1]
                length, cov = map(int, (fs[1], fs[2]))
                multiplicity = fs[5]
                edges = path.split(',')
                contig_info[contig] = {'edges': edges, 'length': length, 'cov': cov, 'mult': multiplicity}
    return contig_info


def parse_spades_contigs_info(input_dirpath, contig_edges):
    contig_info = dict()
    node_pattern = '_length_(?P<length>\d+)_cov_(?P<cov>\d+\.?\d*)'
    scaffolds_fpath = get_scaffolds_fpath(SPADES_NAME, input_dirpath)
    if scaffolds_fpath:
        with open(scaffolds_fpath) as f:
            for line in f:
                if line.startswith('>'):
                    contig = line.strip()[1:]
                    match = re.search(node_pattern, line)
                    if not match or len(match.groups()) < 2:
                        continue
                    length = int(match.group('length'))
                    cov = int(float(match.group('cov')))
                    edges = []
                    if contig in contig_edges:
                        edges = [edge_id_to_name(x[-1]) for x in contig_edges[contig]]
                    contig_info[contig] = {'edges': edges, 'length': length, 'cov': cov, 'mult': 1}
    return contig_info


def create_contig_info(dict_edges, input_dirpath, output_dirpath, contig_edges,
                       edges_by_component, edges_by_repeat_component, edges_by_ref_component, assembler):
    contig_info = None
    if is_canu(assembler):
        contig_info = parse_canu_contigs_info(input_dirpath)
    elif is_flye(assembler):
        contig_info = parse_flye_contigs_info(input_dirpath)
    elif is_spades(assembler):
        contig_info = parse_spades_contigs_info(input_dirpath, contig_edges)
    if not contig_info:
        with open(join(output_dirpath, 'contig_info.json'), 'w') as handle:
            handle.write("contigInfo=" + json.dumps([]) + ";\n")

        with open(join(output_dirpath, 'edges_base_info.json'), 'w') as handle:
            handle.write("edgeInfo=" + json.dumps([]) + ";")
            handle.write("medianCov=" + json.dumps(calculate_median_cov(dict_edges)) + ";\n")
        return

    edge_contigs = defaultdict(set)
    for contig, data in contig_info.items():
        subgraph = None
        repeat_subgraph = None
        ref_subgraph = None
        edges = data['edges']
        for edge_name in set(edges):
            edge_id = get_edge_agv_id(edge_name)
            if edge_id in dict_edges:
                edge_contigs[edge_id].add(contig)
                match_edge_id = get_match_edge_id(edge_id)
                if match_edge_id in dict_edges:
                    edge_contigs[match_edge_id].add(contig)
            if not subgraph and edge_id in edges_by_component:
                data['g'] = edges_by_component[edge_id]
            if not repeat_subgraph and edge_id in edges_by_repeat_component:
                data['rep_g'] = edges_by_repeat_component[edge_id]
            if not ref_subgraph and edge_id in edges_by_ref_component:
                data['ref_g'] = edges_by_ref_component[edge_id]

        data['num_edges'] = str(len(edges))
        contig_info[contig] = data

    for edge_id in edge_contigs:
        edge_contigs[edge_id] = list(edge_contigs[edge_id])

    with open(join(output_dirpath, 'contig_info.json'), 'a') as handle:
        handle.write("contigInfo=" + json.dumps(contig_info) + ";\n")

    with open(join(output_dirpath, 'edges_base_info.json'), 'w') as handle:
        handle.write("edgeInfo=" + json.dumps(edge_contigs) + ";")
        handle.write("medianCov=" + json.dumps(calculate_median_cov(dict_edges)) + ";\n")
    return

