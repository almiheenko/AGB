import subprocess
from os.path import exists

from agv_src.scripts.config import *
from agv_src.scripts.info_parser import parse_mapping_info
from agv_src.scripts.utils import can_reuse, is_empty_file, find_file_by_pattern


def get_contigs_fpath(assembler, input_dirpath):
    if assembler.lower() == ABYSS_NAME.lower():
        return find_file_by_pattern(input_dirpath, "-contigs.fa")
    if assembler.lower() == CANU_NAME.lower():
        return find_file_by_pattern(input_dirpath, ".contigs.fasta")
    if assembler.lower() == FLYE_NAME.lower():
        return join(input_dirpath, "contigs.fasta")
    if assembler.lower() == SPADES_NAME.lower():
        return join(input_dirpath, "contigs.fasta")


def map_edges_to_ref(assembler, input_dirpath, output_dirpath, json_output_dir, reference_fpath, threads, dict_edges, contig_edges):
    mapping_fpath = join(output_dirpath, "mapping.paf")
    if reference_fpath:
        if not can_reuse(mapping_fpath, files_to_check=[reference_fpath], dir_to_check=input_dirpath):
            input_fpath = get_contigs_fpath(assembler, input_dirpath)
            if exists(input_fpath):
                cmdline = ["minimap2", "-c", "-x", "asm20", "--cs", "-t", str(threads), reference_fpath, input_fpath]
                return_code = subprocess.call(cmdline,
                              stdout=open(mapping_fpath, "w"), stderr=open(join(output_dirpath, "minimap.log"), "w"))
                if return_code != 0 or is_empty_file(mapping_fpath):
                    print("Warning! Minimap2 failed aligning edges to the reference")
            else:
                print("Warning! File with contigs was not found, failed aligning edges to the reference")
    strict_mapping_info, chrom_names, edge_by_chrom = parse_mapping_info(output_dirpath, json_output_dir, contig_edges, dict_edges)
    return strict_mapping_info, chrom_names, edge_by_chrom

