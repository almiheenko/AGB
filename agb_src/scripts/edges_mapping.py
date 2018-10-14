import json
import subprocess
from collections import defaultdict, OrderedDict

from agb_src.scripts.config import *
from agb_src.scripts.utils import can_reuse, is_empty_file, natural_sort, get_edge_agv_id, get_edge_num, \
    get_match_edge_id, format_pos


def map_edges_to_ref(input_fpath, output_dirpath, reference_fpath, threads):
    mapping_fpath = join(output_dirpath, "mapping.paf")
    if reference_fpath:
        if not can_reuse(mapping_fpath, files_to_check=[input_fpath, reference_fpath]):
            if not is_empty_file(input_fpath):
                print("Aligning graph edges to the reference...")
                cmdline = ["minimap2", "-x", "asm20", "--score-N", "0", "-E", "1,0",
                           "-N", "200", "-p", "0.5", "-f", "200", "-t", str(threads),
                           reference_fpath, input_fpath]
                return_code = subprocess.call(cmdline,
                              stdout=open(mapping_fpath, "w"), stderr=open(join(output_dirpath, "minimap.log"), "w"))
                if return_code != 0 or is_empty_file(mapping_fpath):
                    print("Warning! Minimap2 failed aligning edges to the reference")
            else:
                print("Warning! File with edge sequences was not found, failed aligning edges to the reference")
    return mapping_fpath


def parse_mapping_info(mapping_fpath, json_output_dir, dict_edges):
    mapping_info = defaultdict(set)

    edge_mappings = defaultdict(lambda: defaultdict(list))
    edge_lengths = dict()
    chrom_lengths = dict()
    with open(mapping_fpath) as f:
        for line in f:
            # contig_1        257261  14      160143  -       chr13   924431  196490  356991  147365  161095  60      tp:A:P  cm:i:14049      s1:i:147260     s2:i:4375       dv:f:0.0066
            fs = line.split()
            edge_id = get_edge_agv_id(get_edge_num(fs[0]))
            start, end = int(fs[2]), int(fs[3])
            edge_lengths[edge_id] = int(fs[1])
            chrom, chrom_len = fs[5], int(fs[6])
            ref_start, ref_end = int(fs[7]), int(fs[8])
            chrom_lengths[chrom] = chrom_len
            edge_mappings[edge_id][chrom].append((start, end, ref_start, ref_end))

    chroms_by_edge = defaultdict(set)
    edge_by_chrom = defaultdict(set)
    chrom_names = set()
    for edge_id in edge_mappings:
        len_threshold = 0.9 * edge_lengths[edge_id]
        gap_threshold = min(5000, 0.05 * edge_lengths[edge_id])
        for chrom, mappings in edge_mappings[edge_id].items():
            mappings.sort(key=lambda x: (x[0], -x[1]), reverse=False)
        for chrom, mappings in edge_mappings[edge_id].items():
            aligns = []
            covered_len = 0
            last_pos = 0
            last_ref_pos = 0
            align_s, align_e = 0, 0
            for (start, end, ref_start, ref_end) in mappings:
                start = max(start, last_pos)
                covered_len += max(0, end - start + 1)
                last_pos = max(last_pos, end + 1)
            if covered_len >= len_threshold:
                chroms_by_edge[edge_id].add(chrom)
                chrom_names.add(chrom)
                edge_by_chrom[chrom].add(edge_id)
                mappings.sort(key=lambda x: (x[2], -x[3]), reverse=False)
                for (start, end, ref_start, ref_end) in mappings:
                    ref_start = max(ref_start, last_ref_pos)
                    last_ref_pos = max(last_ref_pos, ref_end + 1)
                    if not align_s:
                        align_s = ref_start
                    if align_e and ref_start - align_e >= gap_threshold:
                        if align_e - align_s >= 500:
                            aligns.append((chrom, align_s, align_e))
                        align_s = ref_start
                    align_e = ref_end - 1
                if align_e and align_e - align_s >= 500:
                    aligns.append((chrom, align_s, align_e))
                aligns.sort(reverse=True, key=lambda x: x[2] - x[1])
                edge_alignment = chrom + ":"
                for align in aligns[:3]:
                    edge_alignment += " %s-%s," % (format_pos(align[1]), format_pos(align[2]))
                dict_edges[edge_id].aligns[chrom] = edge_alignment[:-1]
                if get_match_edge_id(edge_id) in dict_edges:
                    dict_edges[get_match_edge_id(edge_id)].aligns[chrom] = edge_alignment[:-1]

    chrom_len_dict = OrderedDict((chrom, chrom_lengths[chrom]) for i, chrom in enumerate(list(natural_sort(chrom_names))))
    non_alt_chroms = [c for c in chrom_names if 'alt' not in c and 'random' not in c and 'chrUn' not in c]
    chrom_order = OrderedDict((chrom, i) for i, chrom in enumerate(list(natural_sort(non_alt_chroms))))
    color_list = ['#e6194b', '#3cb44b', '#ffe119', '#1792d4', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#d2f53c',
                  '#fabebe', '#00dbb1', '#dba2ff', '#aa6e28', '#83360e', '#800000', '#003bff', '#808000', '#8d73d4',
                  '#000080', '#806680', '#51205a', '#558859', '#d1a187', '#87a1d1', '#87a1d1', '#afd187']

    edge_chroms = defaultdict(set)
    for edge_id, chroms in chroms_by_edge.items():
        match_edge_id = edge_id.replace('rc', 'e') if edge_id.startswith('rc') else edge_id.replace('e', 'rc')
        for chrom in chroms:
            edge_chroms[edge_id].add(chrom)
            edge_chroms[match_edge_id].add(chrom)
            if match_edge_id in dict_edges:
                edge_by_chrom[chrom].add(match_edge_id)

    for edge_id, chroms in edge_chroms.items():
        if edge_id not in dict_edges:
            continue
        mapping_info[edge_id] = list(chroms)
        colors = set()
        for chrom in chroms:
            if chrom in chrom_order:
                color = color_list[chrom_order[chrom] % len(color_list)]
            else:
                color = '#808080'
            colors.add(color)
        if len(colors) <= 5:
            dict_edges[edge_id].chrom = ':'.join(list(colors))
        else:
            dict_edges[edge_id].chrom = 'white:red:black:red:black:white'
    with open(join(json_output_dir, "reference.json"), 'a') as handle:
        handle.write("chrom_lengths='" + json.dumps(chrom_len_dict) + "';\n")
        handle.write("mapping_info='" + json.dumps(mapping_info) + "';\n")
    return mapping_info, non_alt_chroms, edge_by_chrom
