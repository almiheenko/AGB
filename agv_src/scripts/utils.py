import math
import os
import re
import sys
from os import listdir
from os.path import exists, getmtime, getsize, basename, splitext

from agv_src.scripts.config import *


def is_osx():
    from sys import platform
    if platform == "darwin":
        return True


def is_abyss(assembler):
    return assembler and assembler.lower() == ABYSS_NAME.lower()


def is_canu(assembler):
    return assembler and assembler.lower() == CANU_NAME.lower()


def is_flye(assembler):
    return assembler and assembler.lower() == FLYE_NAME.lower()


def is_spades(assembler):
    return assembler and assembler.lower() == SPADES_NAME.lower()


def is_sga(assembler):
   return assembler and assembler.lower() == SGA_NAME.lower()


def is_soap(assembler):
   return assembler and assembler.lower() == SOAP_NAME.lower()


def is_velvet(assembler):
   return assembler and assembler.lower() == VELVET_NAME.lower()


def get_scaffolds_fpath(assembler, input_dirpath):
    scaffolds_fpath = None
    if input_dirpath:
        if is_abyss(assembler):
            scaffolds_fpath = find_file_by_pattern(input_dirpath, "-scaffolds.fa") or \
                              find_file_by_pattern(input_dirpath, "-contigs.fa")
        elif is_canu(assembler):
            scaffolds_fpath = find_file_by_pattern(input_dirpath, ".contigs.fasta")
        elif is_flye(assembler):
            scaffolds_fpath = join(input_dirpath, "scaffolds.fasta")
        elif is_spades(assembler):
            scaffolds_fpath = join(input_dirpath, "scaffolds.fasta")
    if not is_empty_file(scaffolds_fpath):
        return scaffolds_fpath


def print_dot(dot_fpath, dict_edges):
    with open(dot_fpath, 'w') as out_f:
        print_dot_header(out_f)
        for edge in dict_edges.values():
            out_f.write(edge.print_edge_to_dot())
        out_f.write('}')


def get_median(arr):
    arr.sort()
    if len(arr) % 2:
        return arr[len(arr)//2 + 1]
    else:
        return (arr[len(arr)//2] + arr[len(arr)//2-1]) / 2


def calc_std_dev(arr):
    mean_value = sum(arr) / len(arr)
    std_dev = math.sqrt(sum([(x - mean_value) ** 2 for x in arr]) / (len(arr) - 1))
    return std_dev


def get_lower_half(arr):
    return arr[:math.floor(len(arr) / 2)]


def get_higher_half(arr):
    return arr[math.ceil(len(arr) / 2):]


def print_dot_header(out_f):
    out_f.write("digraph {\n")
    out_f.write("nodesep = 0.5;\n")
    out_f.write("node [shape = circle, label = \"\", height = 0.3];\n")


def natural_sort(l):
    convert = lambda text: int(text) if text.isdigit() else text.lower()
    alphanum_key = lambda key: [ convert(c) for c in re.split('([0-9]+)', key) ]
    return sorted(l, key = alphanum_key)


def format_pos(number):
    s = '%d' % number
    groups = []
    while s and s[-1].isdigit():
        groups.append(s[-3:])
        s = s[:-3]
    return s + ' '.join(reversed(groups))


def is_acgt_seq(seq):
    return seq[0] in {'A', 'C', 'G', 'T', 'N', 'a', 'c', 'g', 't', 'n'}


def get_edge_num(edge_id):
    return int(''.join(x for x in edge_id if x.isdigit()))


def get_edge_agv_id(edge_id):
    if edge_id != "*" and edge_id != "??":
        return 'rc%d' % abs(int(edge_id)) if int(edge_id) < 0 else 'e%d' % int(edge_id)


def get_match_edge_id(edge_id):
    return edge_id.replace("e", "rc") if edge_id[0] == "e" else edge_id.replace("rc", "e")


def edge_id_to_name(edge_id):
    return str(get_edge_num(edge_id)) if edge_id[0] == "e" else str(get_edge_num(edge_id) * (-1))


def get_canu_id(edge_id):
    edge_id = str(get_edge_num(edge_id))
    CANU_ID_LEN = 8
    return "tig%s%s" % ('0' * (CANU_ID_LEN - len(edge_id)), edge_id)


def calculate_median_cov(dict_edges):
    coverages = []
    for edge in dict_edges.values():
        coverages.extend([edge.cov] * int(edge.length / 100))
    return get_median(coverages)


def can_reuse(fpath, files_to_check=None, dir_to_check=None):
    if is_empty_file(fpath):
        return False
    mod_time = getmtime(fpath)
    if files_to_check and any([exists(f) and getmtime(f) > mod_time for f in files_to_check]):
        return False
    if dir_to_check and any([exists(join(dir_to_check, f)) and getmtime(join(dir_to_check, f)) > mod_time for f in listdir(dir_to_check)]):
        return False
    return True


def is_empty_file(fpath):
    return not fpath or not exists(fpath) or getsize(fpath) < 10


def get_filename(fpath):
    return splitext(basename(fpath))[0]


def get_quast_filename(fpath):
    fname = splitext(basename(fpath))[0]
    fname = re.sub(r'[^\w\._\-+|]', '_', fname.strip())
    fname = re.sub(r'[\.+]$', '', fname)
    return slugify(re.sub(r"[\|\+\-=\/]", '_', fname))


def slugify(value):
    """
    Prepare string to use in file names: normalizes string,
    removes non-alpha characters, and converts spaces to hyphens.
    """
    import unicodedata
    value = unicodedata.normalize('NFKD', convert_to_unicode(value)).encode('ascii', 'ignore').decode('utf-8')
    value = convert_to_unicode(re.sub('[^\w\s-]', '-', value).strip())
    value = convert_to_unicode(re.sub('[-\s]+', '-', value))
    return str(value)


def convert_to_unicode(value):
    if sys.version_info[0] < 3:  ## python 2
        return unicode(value)
    else:
        return str(value)


def find_file_by_pattern(dir, pattern):
    files = [join(path, file) for (path, dirs, files) in os.walk(dir) for file in files
             if file.endswith(pattern)]
    if files:
        return files[0]
    return None


def embed_css_and_scripts(html):
    js_line_tmpl = '<script type="text/javascript" src="%s"></script>'
    js_l_tag = '<script type="text/javascript" name="%s">'
    js_r_tag = '    </script>'

    css_line_tmpl = '<link rel="stylesheet" type="text/css" href="%s" />'
    css_l_tag = '<style type="text/css" rel="stylesheet" name="%s">'
    css_r_tag = '    </style>'

    for line_tmpl, files, l_tag, r_tag in [
            (js_line_tmpl, [join(JS_DIR, f) for f in listdir(JS_DIR) if f.endswith("js")], js_l_tag, js_r_tag),
            (css_line_tmpl, [join(CSS_DIR, f) for f in listdir(CSS_DIR) if f.endswith("css")], css_l_tag, css_r_tag),
        ]:
        for fpath in files:
            rel_fpath = basename(fpath)
            if not exists(fpath):
                continue

            line = line_tmpl % rel_fpath
            l_tag_formatted = l_tag % rel_fpath

            with open(fpath) as f: contents = f.read()
            contents = '\n'.join(' ' * 8 + l for l in contents.split('\n'))
            html = html.replace(line, l_tag_formatted + '\n' + contents + '\n' + r_tag)

    return html

