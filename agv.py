#!/usr/bin/env python

import os
import sys
from optparse import OptionParser
from os.path import exists

from agv_src.scripts.config import *
from agv_src.scripts.graph_parser import parse_gfa, parse_abyss_dot, parse_flye_dot, fastg_to_gfa, get_edges_from_gfa, \
    format_edges_file
from agv_src.scripts.info_parser import parse_abyss_output, parse_canu_output, parse_flye_output, parse_spades_output
from agv_src.scripts.quast_runner import find_errors
from agv_src.scripts.utils import embed_css_and_scripts, get_scaffolds_fpath, is_empty_file
from agv_src.scripts.viewer_builder import build_jsons


def parse_assembler_output(assembler_name, input_dirpath, input_fpath, output_dirpath, input_fasta_fpath):
    edges_fpath = None
    if not is_empty_file(input_fpath):
        contig_edges = []
        if input_fpath.endswith("fastg"):
            input_fpath = fastg_to_gfa(input_fpath, output_dirpath, assembler_name)
        if not input_fpath:
            sys.exit("ERROR! Failed parsing " + input_fpath + " file.")
        if input_fpath.endswith("gfa"):
            dict_edges = parse_gfa(input_fpath)
            edges_fpath = get_edges_from_gfa(input_fpath, output_dirpath)
        elif input_fpath.endswith("dot") or input_fpath.endswith("gv"):
            assembler_name = assembler_name.lower()
            edges_fpath = format_edges_file(input_fasta_fpath, output_dirpath)
            if assembler_name == ABYSS_NAME.lower():
                dict_edges = parse_abyss_dot(input_fpath)
            else:
                try:
                    dict_edges = parse_flye_dot(input_fpath)
                except:
                    sys.exit("ERROR! Failed parsing " + input_fpath + " file.")
    else:
        assembler_name = assembler_name.lower()
        if assembler_name == ABYSS_NAME.lower():
            dict_edges, contig_edges, edges_fpath = parse_abyss_output(input_dirpath)
        elif assembler_name == CANU_NAME.lower():
            dict_edges, contig_edges, edges_fpath = parse_canu_output(input_dirpath, output_dirpath)
        elif assembler_name == FLYE_NAME.lower():
            dict_edges, contig_edges, edges_fpath = parse_flye_output(input_dirpath, output_dirpath)
        elif assembler_name == SPADES_NAME.lower():
            dict_edges, contig_edges, edges_fpath = parse_spades_output(input_dirpath, output_dirpath)
        else:
            sys.exit("Assembler %s is not supported yet! Supported assemblers: %s. "
                     "More assemblers will be added in the next release."
                     "You can specify the assembly graph file in GFA/FASTG/GraphViz formats using --graph option "
                     "and file with edge sequences using --fasta option" %
                     (assembler_name, ', '.join(SUPPORTED_ASSEMBLERS)))
    for edge_id, edge in dict_edges.items():
        dict_edges[edge_id].start, dict_edges[edge_id].end = str(edge.start), str(edge.end)
    return dict_edges, contig_edges, edges_fpath


def main():
    description = (
        'The program will create interactive assembly graph viewer')
    parser = OptionParser(description=description)

    parser.add_option('-a', '--assembler', dest='assembler', help='Used assembler (ABYSS, Canu, Flye, SPAdes)') #, choices=[ABYSS_NAME, CANU_NAME, FLYE_NAME, SPADES_NAME])
    parser.add_option('-i', dest='input_dir', help='Assembler output folder')
    parser.add_option('--graph', dest='input_file', help='Assembly graph in GraphViz/GFA/FASTG format')
    parser.add_option('--fasta', dest='input_fasta', help='FASTA file with graph edge sequences')
    parser.add_option('-o', dest='output_dir', help='Output directory')
    parser.add_option('-r', dest='reference', help='Path to the reference genome')
    parser.add_option('-t', dest='threads', default=DEFAULT_THREADS)

    parser.set_usage('Usage: \n1) ' + __file__ + ' -i assembler_output_dir -o output_dir [-r path_to_reference_genome]'
                     ' -a assembler_name (supported assemblers: ' + ', '.join(SUPPORTED_ASSEMBLERS) + ')'
                     '\n2) ' + __file__ + ' --graph assembly_graph_file (supported formats: GFA, FASTG, GraphViz)'
                     ' [--fasta file_with_graph_edge_sequences (in FASTA format)] [-r path_to_reference_genome]'
                     ' -o output_dir  -a assembler_name (supported assemblers: ' + ', '.join(SUPPORTED_ASSEMBLERS) + ')')
    opts, args = parser.parse_args()
    if not opts.assembler:
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if opts.input_dir and opts.input_file:
        print('ERROR! You should specify assembly graph file OR assembler output folder')
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if opts.input_fasta and not opts.input_file:
        print('ERROR! If you specify a file with graph edge sequences, you should specify an assembly graph')
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if not exists(opts.output_dir):
        os.makedirs(opts.output_dir)
    dict_edges, contig_edges, edges_fpath = parse_assembler_output(opts.assembler, opts.input_dir, opts.input_file, opts.output_dir, opts.input_fasta)
    scaffolds_fpath = get_scaffolds_fpath(opts.assembler, opts.input_dir)
    json_output_dirpath = join(opts.output_dir, "data")
    if not exists(json_output_dirpath):
        os.makedirs(json_output_dirpath)

    if opts.reference and (scaffolds_fpath or edges_fpath):
        print("Running QUAST...")
    find_errors(scaffolds_fpath, opts.reference, opts.output_dir, json_output_dirpath, opts.threads, contig_edges)
    mapping_info, chrom_names, edge_by_chrom, dict_edges = \
        find_errors(edges_fpath, opts.reference, opts.output_dir, json_output_dirpath, opts.threads, contig_edges, dict_edges)

    build_jsons(dict_edges, opts.input_dir, json_output_dirpath, mapping_info, chrom_names, edge_by_chrom, contig_edges)
    output_fpath = join(opts.output_dir, HTML_NAME)
    with open(TEMPLATE_PATH) as f: html = f.read()
    html = embed_css_and_scripts(html)
    with open(output_fpath, 'w') as f:
        f.write(html)
    print('Assembly graph viewer is saved to ' + output_fpath)


if __name__ == '__main__':
    main()

