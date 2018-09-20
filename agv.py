#!/usr/bin/env python

import os
import sys
from optparse import OptionParser
from os.path import exists

from agv_src.scripts.config import *
from agv_src.scripts.edges_mapping import get_edges_fpath
from agv_src.scripts.info_parser import parse_abyss_output, parse_canu_output, parse_flye_output, parse_spades_output
from agv_src.scripts.quast_runner import find_errors
from agv_src.scripts.utils import embed_css_and_scripts, get_scaffolds_fpath
from agv_src.scripts.viewer_builder import build_jsons


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
    json_output_dirpath = join(opts.output_dir, "data")
    if not exists(json_output_dirpath):
        os.makedirs(json_output_dirpath)

    find_errors(get_scaffolds_fpath(opts.assembler, opts.input_dir), opts.reference,
                opts.output_dir, json_output_dirpath, opts.threads, contig_edges)
    strict_mapping_info, chrom_names, edge_by_chrom, dict_edges = find_errors(get_edges_fpath(opts.assembler, opts.input_dir, opts.output_dir),
                                  opts.reference, opts.output_dir, json_output_dirpath, opts.threads, contig_edges, dict_edges)

    build_jsons(dict_edges, opts.input_dir, json_output_dirpath, strict_mapping_info, chrom_names, edge_by_chrom, contig_edges)
    output_fpath = join(opts.output_dir, HTML_NAME)
    with open(TEMPLATE_PATH) as f: html = f.read()
    html = embed_css_and_scripts(html)
    with open(output_fpath, 'w') as f:
        f.write(html)
    print('Assembly graph viewer is saved to ' + output_fpath)


if __name__ == '__main__':
    main()

