#!/usr/bin/env python

import os
import sys
from copy import copy
from optparse import OptionParser, OptionGroup, Option
from os.path import exists

from agb_src.scripts.config import *
from agb_src.scripts.graph_parser import parse_gfa, parse_abyss_dot, parse_flye_dot, fastg_to_gfa, get_edges_from_gfa, \
    format_edges_file
from agb_src.scripts.info_parser import parse_canu_output, parse_flye_output, parse_spades_output
from agb_src.scripts.quast_runner import run_quast_analysis
from agb_src.scripts.utils import embed_css_and_scripts, get_scaffolds_fpath, is_empty_file, is_abyss, is_canu, is_flye, \
    is_spades
from agb_src.scripts.viewer_builder import build_jsons


class AGBOption(Option):
    def check_file(option, opt, fpath):
        if fpath and os.path.isdir(fpath):
            print("ERROR! You specify a folder instead of a file: %s" % (fpath))
            sys.exit(2)
        if not fpath or not os.path.isfile(fpath):
            print("ERROR! File not found: %s" % (fpath))
            sys.exit(2)
        return fpath
    def check_dir(option, opt, dirpath):
        if not dirpath or not os.path.isdir(dirpath):
            print("ERROR! Folder not found: %s" % (dirpath))
            sys.exit(2)
        return dirpath
    TYPES = Option.TYPES + ('file', 'dir')
    TYPE_CHECKER = copy(Option.TYPE_CHECKER)
    TYPE_CHECKER['file'] = check_file
    TYPE_CHECKER['dir'] = check_dir


def parse_assembler_output(assembler_name, input_dirpath, input_fpath, output_dirpath, input_fasta_fpath, min_edge_len):
    edges_fpath = None
    if not is_empty_file(input_fpath):
        contig_edges = []
        if input_fpath.endswith("fastg"):
            input_fpath = fastg_to_gfa(input_fpath, output_dirpath, assembler_name)
        if not input_fpath:
            sys.exit("ERROR! Failed parsing " + input_fpath + " file.")
        if input_fpath.endswith("gfa") or input_fpath.endswith("gfa2"):
            dict_edges = parse_gfa(input_fpath, min_edge_len)
            edges_fpath = get_edges_from_gfa(input_fpath, output_dirpath, min_edge_len)
        elif input_fpath.endswith("dot") or input_fpath.endswith("gv"):
            edges_fpath = format_edges_file(input_fasta_fpath, output_dirpath)
            if is_abyss(assembler_name):
                dict_edges = parse_abyss_dot(input_fpath, min_edge_len)
            else:
                try:
                    dict_edges = parse_flye_dot(input_fpath, min_edge_len)
                except:
                    sys.exit("ERROR! Failed parsing " + input_fpath + " file.")
    else:
        if is_canu(assembler_name):
            dict_edges, contig_edges, edges_fpath = parse_canu_output(input_dirpath, output_dirpath, min_edge_len)
        elif is_flye(assembler_name):
            dict_edges, contig_edges, edges_fpath = parse_flye_output(input_dirpath, output_dirpath, min_edge_len)
        elif is_spades(assembler_name):
            dict_edges, contig_edges, edges_fpath = parse_spades_output(input_dirpath, output_dirpath, min_edge_len)
        else:
            sys.exit("Assembler %s is not supported yet! Supported assemblers: %s. "
                     "More assemblers will be added in the next release."
                     "You can specify the assembly graph file in GFA/FASTG/GraphViz formats using --graph option "
                     "and (optionally) file with edge sequences using --fasta option" %
                     (assembler_name, ', '.join(SUPPORTED_ASSEMBLERS)))
    for edge_id, edge in dict_edges.items():
        dict_edges[edge_id].start, dict_edges[edge_id].end = str(edge.start), str(edge.end)
    return dict_edges, contig_edges, edges_fpath


def main():
    description = (
        'The program will create interactive assembly graph viewer')
    parser = OptionParser(description=description, option_class=AGBOption)

    group = OptionGroup(parser, "Common Options",
                        "Options that can be used in any mode")
    group.add_option('-a', '--assembler', dest='assembler', help='Required. Assembler name.') #, choices=[ABYSS_NAME, CANU_NAME, FLYE_NAME, SPADES_NAME])
    group.add_option('-o', dest='output_dir', help='Output directory [default: agb_output]', default='agb_output')
    group.add_option('-r', dest='reference', help='Path to the reference genome')
    group.add_option('-t', dest='threads', help='Maximum number of threads [default: %d]' % DEFAULT_THREADS, default=DEFAULT_THREADS)
    group.add_option('-m', dest='min_edge_len', help='Lower threshold for edge length [default: %d]' % MIN_EDGE_LEN, default=MIN_EDGE_LEN)
    group.add_option('--meta', dest='is_meta', action='store_true', help='Use QUAST options for metagenome', default=False)
    parser.add_option_group(group)

    group = OptionGroup(parser, "Special Options")
    group.add_option('-i', dest='input_dir', type="dir", help='Assembler output folder')
    group.add_option('--graph', dest='input_file', type="file", help='Assembly graph in GFA1/GFA2/Graphviz/FASTG format. Cannot be used with -i option')
    group.add_option('--fasta', dest='input_fasta', type="file", help='FASTA file with graph edge sequences. Cannot be used with -i option')
    # add options for contigs/scaffolds
    parser.add_option_group(group)

    parser.set_usage('Usage: \n' +
                     '1) ' + __file__ + ' [options] --graph assembly_graph_file -a <assembler_name> [--fasta file_with_graph_edge_sequences]\n'
                     '2) ' + __file__ + ' [options] -a <assembler_name> -i <assembler_output_dir> (supported for %s)' %
                     ', '.join(SUPPORTED_ASSEMBLERS))

    opts, args = parser.parse_args()
    if not opts.assembler:
        print('ERROR! You should specify the name of the used assembler software using the option -a')
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if opts.input_dir and opts.input_file:
        print('ERROR! You should specify an assembly graph file OR assembler output folder')
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if opts.input_fasta and not opts.input_file:
        print('ERROR! If you specify a file with graph edge sequences, you should specify an assembly graph')
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if not exists(opts.output_dir):
        os.makedirs(opts.output_dir)
    dict_edges, contig_edges, edges_fpath = parse_assembler_output(opts.assembler, opts.input_dir, opts.input_file,
                                                                   opts.output_dir, opts.input_fasta, opts.min_edge_len)
    scaffolds_fpath = get_scaffolds_fpath(opts.assembler, opts.input_dir)
    json_output_dirpath = join(opts.output_dir, "data")
    if not exists(json_output_dirpath):
        os.makedirs(json_output_dirpath)

    if opts.reference and (scaffolds_fpath or edges_fpath):
        print("Running QUAST...")
    run_quast_analysis(scaffolds_fpath, opts.reference, opts.output_dir, json_output_dirpath, opts.threads, contig_edges,
                       is_meta=opts.is_meta)
    mapping_info, chrom_names, edge_by_chrom, dict_edges = \
        run_quast_analysis(edges_fpath, opts.reference, opts.output_dir, json_output_dirpath, opts.threads, contig_edges,
                           dict_edges, is_meta=opts.is_meta)

    build_jsons(dict_edges, opts.input_dir, json_output_dirpath, mapping_info, chrom_names, edge_by_chrom, contig_edges, opts.assembler)
    output_fpath = join(opts.output_dir, HTML_NAME)
    with open(TEMPLATE_PATH) as f: html = f.read()
    html = embed_css_and_scripts(html)
    with open(output_fpath, 'w') as f:
        f.write(html)
    print('Assembly graph viewer is saved to ' + output_fpath)


if __name__ == '__main__':
    main()

