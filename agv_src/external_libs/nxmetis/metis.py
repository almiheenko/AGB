"""
    This module is a wrapper of the ``_metis`` extension generated
    from ``_metis.pyx``. This is to let sphinx import the module for
    documentation builds with or without the ``_metis`` extension.
"""
try:
    from agv_src.external_libs.nxmetis import _metis
except ImportError:
    def node_nd(*args, **kwargs):
        raise Exception("NetworkX-METIS not installed!")

    def part_graph(*args, **kwargs):
        raise Exception("NetworkX-METIS not installed!")

    def compute_vertex_separator(*args, **kwargs):
        raise Exception("NetworkX-METIS not installed!")

    def set_default_options(*args, **kwargs):
        raise Exception("NetworkX-METIS not installed!")
else:
    node_nd = _metis.node_nd
    part_graph = _metis.part_graph
    compute_vertex_separator = _metis.compute_vertex_separator
    set_default_options = _metis.set_default_options
