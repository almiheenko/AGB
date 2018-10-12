import json
import os
import re
from os.path import join, exists, getsize
import subprocess

from collections import defaultdict

from agb_src.scripts.config import GAP_THRESHOLD
from agb_src.scripts.edges_mapping import map_edges_to_ref, parse_mapping_info
from agb_src.scripts.utils import is_empty_file, can_reuse, get_quast_filename, get_edge_num, get_edge_agv_id, \
    edge_id_to_name, get_match_edge_id

align_pattern = "between (?P<start1>\d+) (?P<end1>\d+) and (?P<start2>\d+) (?P<end2>\d+)"


def get_alignments_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "all_alignments_%s.tsv" % get_quast_filename(input_fpath))


def get_mis_report_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "contigs_report_%s.mis_contigs.info" % get_quast_filename(input_fpath))


def get_stdout_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "contigs_report_%s.stdout" % get_quast_filename(input_fpath))


def get_minimap_out_fpath(quast_output_dir, input_fpath):
    return join(quast_output_dir, "contigs_reports", "minimap_output", "%s.coords_tmp" % get_quast_filename(input_fpath))


def run(input_fpath, reference_fpath, out_fpath, output_dirpath, threads, is_meta):
    if not exists(output_dirpath):
        os.makedirs(output_dirpath)
    if not can_reuse(out_fpath, files_to_check=[input_fpath, reference_fpath]):
        quast_exec_path = "quast.py"
        if is_empty_file(quast_exec_path):
            print("QUAST is not found!")
            return None
        cmdline = [quast_exec_path, "--fast",  "--agv", input_fpath, "-r", reference_fpath,
                   "-t", str(threads), "-o", output_dirpath, "--min-contig", "0"] + \
                  (["--large"] if getsize(input_fpath) > 10 * 1024 * 1024 else []) + (["--min-identity", "90"] if is_meta else [])
        subprocess.call(cmdline, stdout=open("/dev/null", "w"), stderr=open("/dev/null", "w"))
    if is_empty_file(out_fpath) or not can_reuse(out_fpath, files_to_check=[input_fpath, reference_fpath]):
        return None
    return out_fpath


def parse_alignments(alignments_fpath, json_output_dirpath):
    gaps_info = defaultdict(list)
    chrom_alignments = defaultdict(list)
    ms_info = defaultdict(list)
    aligns_by_chroms = defaultdict(list)
    # S1      E1      S2      E2      Reference       Contig  IDY     Ambiguous       Best_group
    with open(alignments_fpath) as f:
        for i, line in enumerate(f):
            if i == 0:
                continue
            fs = line.split('\t')
            if len(fs) > 5:
                start, end, start2, end2, chrom, edge_id = fs[:6]
                start, end = int(start), int(end)
                if int(start2) > int(end2):
                    edge_id = get_match_edge_id(edge_id)
                chrom_alignments[chrom].append((start, end, edge_id))
            elif line.startswith("relocation") or line.startswith("transloc") or line.startswith("invers"):
                ms_info[(chrom, start, end)].append(line.strip())
    for chrom, alignments in chrom_alignments.items():
        alignments.sort(key=lambda x: (x[0], x[1]))
        prev_end = 0
        for start, end, edge_id in alignments:
            if start - prev_end > GAP_THRESHOLD:
                gaps_info[chrom].append((prev_end, start - 1))
            prev_end = max(prev_end, end)
            align = {'s': start, 'e': end, 'edge': edge_id, 'ms': ';'.join(ms_info[(chrom, start, end)])}
            aligns_by_chroms[chrom].append(align)
    with open(join(json_output_dirpath, 'reference.json'), 'w') as handle:
        handle.write("gaps='" + json.dumps(gaps_info) + "';\n")
        handle.write("chrom_aligns='" + json.dumps(aligns_by_chroms) + "';\n")


def run_quast_analysis(input_fpath, reference_fpath, output_dirpath, json_output_dirpath, threads, contig_edges, dict_edges=None, is_meta=False):
    ms_out_fpath = None
    quast_output_dir = join(output_dirpath, "quast_output" if not dict_edges else "quast_edge_output")
    if not is_empty_file(input_fpath) and not is_empty_file(reference_fpath):
        ms_out_fpath = get_mis_report_fpath(quast_output_dir, input_fpath)
        ms_out_fpath = run(input_fpath, reference_fpath, ms_out_fpath, quast_output_dir, threads, is_meta)
    if not ms_out_fpath:
        if not is_empty_file(input_fpath) and not is_empty_file(reference_fpath):
            print("QUAST failed!")
        print("No information about %s mappings to the reference genome" % ("edge" if dict_edges else "contig"))
        with open(join(json_output_dirpath, "reference.json"), 'w') as handle:
            handle.write("chrom_lengths='" + json.dumps([]) + "';\n")
            handle.write("mapping_info='" + json.dumps([]) + "';\n")
            handle.write("gaps='" + json.dumps([]) + "';\n")
            handle.write("chrom_aligns='" + json.dumps([]) + "';\n")
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
                    edge_id = get_edge_agv_id(get_edge_num(seq_id))
                    dict_edges[edge_id].errors.append((start1, end1, start2, end2))
                else:
                    misassembled_seqs[seq_id].append((start1, end1, start2, end2))
                ## add misassembl edge
            else:
                seq_id = line.strip()

    if not dict_edges:
        with open(join(json_output_dirpath, 'errors.json'), 'w') as handle:
            handle.write("misassembled_contigs='" + json.dumps(misassembled_seqs) + "';\n")
        return None, None, None, dict_edges
    else:
        parse_alignments(get_alignments_fpath(quast_output_dir, input_fpath), json_output_dirpath)
        mapping_fpath = map_edges_to_ref(input_fpath, output_dirpath, reference_fpath, threads)
        mapping_info, chrom_names, edge_by_chrom = parse_mapping_info(mapping_fpath, json_output_dirpath, dict_edges)
        return mapping_info, chrom_names, edge_by_chrom, dict_edges