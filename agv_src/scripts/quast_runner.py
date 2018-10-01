import json
import os
import re
from os.path import join, exists
import subprocess

from collections import defaultdict

from agv_src.scripts.edges_mapping import map_edges_to_ref, parse_mapping_info
from agv_src.scripts.utils import is_empty_file, can_reuse, get_quast_filename

align_pattern = "between (?P<start1>\d+) (?P<end1>\d+) and (?P<start2>\d+) (?P<end2>\d+)"


def get_alignments_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "all_alignments_%s.tsv" % get_quast_filename(input_fpath))


def get_mis_report_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "contigs_report_%s.mis_contigs.info" % get_quast_filename(input_fpath))


def get_minimap_out_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "minimap_output", "%s.coords_tmp" % get_quast_filename(input_fpath))


def run(input_fpath, reference_fpath, out_fpath, output_dirpath, threads):
    if not exists(output_dirpath):
        os.makedirs(output_dirpath)
    if not can_reuse(out_fpath, files_to_check=[input_fpath, reference_fpath]):
        cmdline = ["quast.py", "--large", "--agv", input_fpath, "-r", reference_fpath, "-t", str(threads), "-o", output_dirpath]
        subprocess.call(cmdline, stdout=open("/dev/null", "w"), stderr=open("/dev/null", "w"))
    if is_empty_file(out_fpath) or not can_reuse(out_fpath, files_to_check=[input_fpath, reference_fpath]):
        return None
    return out_fpath


def find_errors(input_fpath, reference_fpath, output_dirpath, json_output_dirpath, threads, contig_edges, dict_edges=None):
    ms_out_fpath = None
    if input_fpath and reference_fpath:
        quast_output_dir = join(output_dirpath, "quast_output" if not dict_edges else "quast_edge_output")
        ms_out_fpath = get_mis_report_fpath(quast_output_dir, input_fpath)
        ms_out_fpath = run(input_fpath, reference_fpath, ms_out_fpath, quast_output_dir, threads)
    if not ms_out_fpath:
        if not is_empty_file(input_fpath) and not is_empty_file(reference_fpath):
            print("QUAST failed!")
        print("No information about %s mappings to the reference genome" % ("edge" if dict_edges else "contig"))
        with open(join(json_output_dirpath, "reference.json"), 'w') as handle:
            handle.write("chrom_lengths='" + json.dumps([]) + "';\n")
            handle.write("mapping_info='" + json.dumps([]) + "';\n")
        with open(join(json_output_dirpath, 'errors.json'), 'w') as handle:
            handle.write("misassembled_contigs='[]';\n")
        return None, None, None, dict_edges

    misassembled_seqs = defaultdict(list)
    with open(ms_out_fpath) as f:
        seq_id = ''
        for line in f:
            if line.startswith("Extensive misassembly"):
                match = re.search(align_pattern, line)
                if not match or len(match.groups()) < 4:
                    continue
                start1, end1, start2, end2 = match.group('start1'), match.group('end1'), match.group('start2'), match.group('end2')
                if dict_edges:
                    dict_edges[seq_id].errors.append((end1, start2))
                else:
                    misassembled_seqs[seq_id].append((end1, start2))
                ## add misassembl edge
            else:
                seq_id = line.strip()

    if not dict_edges:
        with open(join(json_output_dirpath, 'errors.json'), 'w') as handle:
            handle.write("misassembled_contigs='" + json.dumps(misassembled_seqs) + "';\n")
        return None, None, None, dict_edges
    else:
        mapping_fpath = map_edges_to_ref(input_fpath, output_dirpath, reference_fpath, threads)
        mapping_info, chrom_names, edge_by_chrom = parse_mapping_info(mapping_fpath, json_output_dirpath, contig_edges, dict_edges)
        return mapping_info, chrom_names, edge_by_chrom, dict_edges