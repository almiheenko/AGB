#!/usr/bin/env python

import os
import sys
from os.path import exists
from optparse import OptionParser

from scripts.config import *
from scripts.edges_mapping import map_edges_to_ref
from scripts.info_parser import parse_abyss_output, parse_canu_output, parse_flye_output, parse_spades_output
from scripts.viewer_builder import build_jsons
from scripts.utils import embed_css_and_scripts


def parse_assembler_output(assembler_name, input_dirpath):
    assembler_name = assembler_name.lower()
    if assembler_name == ABYSS_NAME.lower():
        dict_edges, contig_edges = parse_abyss_output(input_dirpath)
    elif assembler_name == CANU_NAME.lower():
        dict_edges, contig_edges = parse_canu_output(input_dirpath)
    elif assembler_name == FLYE_NAME.lower():
        dict_edges, contig_edges = parse_flye_output(input_dirpath)
    elif assembler_name == SPADES_NAME.lower():
        dict_edges, contig_edges = parse_spades_output(input_dirpath)
    else:
        sys.exit("Assembler %s is not supported yet! Supported assemblers: %s. "
                 "More assemblers will be added in the next release. Sorry for the inconvenience." %
                 (assembler_name, ', '.join(SUPPORTED_ASSEMBLERS)))
    for edge_id, edge in dict_edges.items():
        dict_edges[edge_id].start, dict_edges[edge_id].end = str(edge.start), str(edge.end)
    return dict_edges, contig_edges


def main():
    description = (
        'The program will create interactive assembly graph viewer')
    parser = OptionParser(description=description)

    parser.add_option('-a', '--assembler', dest='assembler') #, choices=[ABYSS_NAME, CANU_NAME, FLYE_NAME, SPADES_NAME])
    parser.add_option('-i', dest='input_dir')
    parser.add_option('-o', dest='output_dir')
    parser.add_option('-r', dest='reference')
    parser.add_option('-t', dest='threads', default=DEFAULT_THREADS)

    parser.set_usage('Usage: ' + __file__ + ' -i assembler_output_dir -o output_dir [-r path_to_reference_genome]'
                     ' -a assembler_name (supported assemblers: ' + ', '.join(SUPPORTED_ASSEMBLERS) + ')')
    opts, args = parser.parse_args()
    if not opts.assembler:
        parser.print_help(file=sys.stderr)
        sys.exit(1)

    if not exists(opts.output_dir):
        os.makedirs(opts.output_dir)
    dict_edges, contig_edges = parse_assembler_output(opts.assembler, opts.input_dir)
    json_output_dir = join(opts.output_dir, "data")
    if not exists(json_output_dir):
        os.makedirs(json_output_dir)

    strict_mapping_info, chrom_names, edge_by_chrom = \
        map_edges_to_ref(opts.assembler, opts.input_dir, opts.output_dir, json_output_dir, opts.reference, opts.threads, dict_edges, contig_edges)
    build_jsons(dict_edges, opts.input_dir, json_output_dir, strict_mapping_info, chrom_names, edge_by_chrom, contig_edges)
    output_fpath = join(opts.output_dir, HTML_NAME)
    with open(TEMPLATE_PATH) as f: html = f.read()
    html = embed_css_and_scripts(html)
    with open(output_fpath, 'w') as f:
        f.write(html)
    print('Assembly graph viewer is saved to ' + output_fpath)


if __name__ == '__main__':
    main()

