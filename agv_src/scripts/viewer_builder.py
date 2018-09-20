import json
from collections import defaultdict
from os.path import join

import networkx as nx

from agv_src.scripts.graph_analysis import process_graph
from agv_src.scripts.utils import print_dot_header, get_edge_agv_id, calculate_median_cov, is_empty_file


def build_jsons(dict_edges, input_dirpath, output_dirpath, strict_mapping_info, chrom_names, edge_by_chrom, contig_edges):
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
    edges_by_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges, output_dirpath, 'def')
    edges_by_repeat_component = process_graph(repeat_g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                              output_dirpath, 'repeat', base_graph=g)
    edges_by_ref_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                           output_dirpath, 'ref', chrom_names=chrom_names,
                                           edge_by_chrom=edge_by_chrom, strict_mapping_info=strict_mapping_info)
    edges_by_contig_component = process_graph(g, undirected_g, dict_edges, edges_by_nodes, two_way_edges,
                                              output_dirpath, 'contig', contig_edges=contig_edges)
    create_contig_info(dict_edges, input_dirpath, output_dirpath,
                       edges_by_component, edges_by_repeat_component, edges_by_ref_component)
    with open(join(output_dirpath, 'title.json'), 'w') as handle:
        handle.write("title='yeast';\n")


def create_contig_info(dict_edges, input_dirpath, output_dirpath,
                       edges_by_component, edges_by_repeat_component, edges_by_ref_component):
    contig_info = dict()
    edge_contigs = defaultdict(list)
    if not is_empty_file(join(input_dirpath, 'assembly_info.txt')):
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
                subgraph = None
                repeat_subgraph = None
                ref_subgraph = None
                for edge_name in set(edges):
                    edge_id = get_edge_agv_id(edge_name)
                    if edge_id in dict_edges:
                        edge_contigs[edge_id].append(contig)
                    if not repeat_subgraph and edge_id in edges_by_repeat_component:
                        repeat_subgraph = edges_by_repeat_component[edge_id]
                    if not subgraph and edge_id in edges_by_component:
                        subgraph = edges_by_component[edge_id]
                    if not ref_subgraph and edge_id in edges_by_ref_component:
                        ref_subgraph = edges_by_ref_component[edge_id]

                num_edges = str(len(edges))
                contig_info[contig] = {'edges': edges, 'length': length, 'cov': cov, 'n_edges': num_edges,
                                       'mult': multiplicity, 'g': subgraph, 'rep_g': repeat_subgraph, 'ref_g': ref_subgraph}
    with open(join(output_dirpath, 'contig_info.json'), 'w') as handle:
        handle.write("contig_info='" + json.dumps(contig_info) + "';\n")

    with open(join(output_dirpath, 'edges_base_info.json'), 'w') as handle:
        handle.write("edge_info='" + json.dumps(edge_contigs) + "';")
        handle.write("median_cov='" + json.dumps(calculate_median_cov(dict_edges)) + "';\n")

