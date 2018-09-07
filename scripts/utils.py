import math
import os
import re

from os import listdir
from os.path import exists, getmtime, join, getsize, abspath, basename

from scripts.config import CSS_DIR, JS_DIR


def is_osx():
    from sys import platform
    if platform == "darwin":
        return True


def print_dot(dot_fpath, dict_edges):
    with open(dot_fpath, 'w') as out_f:
        print_dot_header(out_f)
        for edge in dict_edges.values():
            out_f.write(edge.print_edge_to_dot())
        out_f.write('}')


def calc_median(arr):
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


def get_edge_num(edge_id):
    return int(''.join(x for x in edge_id if x.isdigit()))


def get_edge_agv_id(edge_id):
    if edge_id != "*" and edge_id != "??":
        return 'rc%d' % abs(int(edge_id)) if int(edge_id) < 0 else 'e%d' % int(edge_id)


def get_canu_id(edge_name):
    CANU_ID_LEN = 8
    return "tig%s%s" % ('0' * (CANU_ID_LEN - len(str(edge_name))), edge_name)


def calculate_mean_cov(dict_edges):
    coverages = []
    for edge in dict_edges.values():
        coverages.extend([edge.cov] * int(edge.length / 100))
    return sum(coverages) / len(coverages)


def can_reuse(fpath, files_to_check=None, dir_to_check=None):
    if is_empty_file(fpath):
        return False
    mod_time = getmtime(fpath)
    if files_to_check and any([getmtime(f) > mod_time for f in files_to_check]):
        return False
    if dir_to_check and any([getmtime(join(dir_to_check, f)) > mod_time for f in listdir(dir_to_check)]):
        return False
    return True


def is_empty_file(fpath):
    return not fpath or not exists(fpath) or getsize(fpath) < 10


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

