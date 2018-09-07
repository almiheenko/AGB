# -*- coding: utf-8 -*-

# Copyright (C) 2015 ysitu <ysitu@users.noreply.github.com>
# All rights reserved

"""
Wrappers of METIS graph partitioning functions.
"""

import contextlib
import decorator
import itertools
import sys

import networkx as nx
import six

from external_libs.nxmetis import enums
from external_libs.nxmetis import exceptions
from external_libs.nxmetis import metis
from external_libs.nxmetis import types

__all__ = ['node_nested_dissection', 'partition', 'vertex_separator',
           'MetisOptions']

MetisOptions = types.MetisOptions


@contextlib.contextmanager
def _zero_numbering(options):
    """Temporarily force zero-based numbering."""
    if options:
        numbering = options.numbering
        options.numbering = enums.MetisNumbering.zero
    try:
        yield
    finally:
        if options:
            options.numbering = numbering


def _convert_graph(G):
    """Convert a graph to the numbered adjacency list structure expected by
    METIS.
    """
    index = dict(zip(G, list(range(len(G)))))
    xadj = [0]
    adjncy = []
    for u in G:
        adjncy.extend(index[v] for v in G[u])
        xadj.append(len(adjncy))
    return xadj, adjncy


def _convert_exceptions(convert_type, catch_types=None):
    """Decorator to convert types of exceptions

    Parameters
    ----------
    convert_type : subclass of Exception
        Target type to convert to.

    catch_types : tuple of subclasses of Exception, optional
        Source types whose instances are to be caught and converted. If None,
        all instances of Exception will be caught and converted.

    Returns
    -------
    _convert_exceptions : function
        Function that performs exception type conversion.

    Example
    -------
    Decorate functions like this::

        @_convert_exceptions(nx.NetworkXError, (ValueError,))
        def function():
            pass
    """
    @decorator.decorator
    def _convert_exceptions(func, *args, **kwargs):
        try:
            return func(*args, **kwargs)
        except catch_types as e:
            exc = e
        except Exception as e:
            if catch_types is not None:
                raise
            exc = sys.exc_info()
        six.reraise(convert_type, convert_type(exc[1]), exc[2])
    return _convert_exceptions


@nx.utils.not_implemented_for('directed')
@nx.utils.not_implemented_for('multigraph')
@_convert_exceptions(
    nx.NetworkXError, (ValueError, TypeError, exceptions.MetisError))
def node_nested_dissection(G, weight='weight', options=None):
    """Compute a node ordering of a graph that reduces fill when the Laplacian
    matrix of the graph is LU factorized. The algorithm aims to minimize the
    sum of weights of vertices in separators computed in the process.

    Parameters
    ----------
    G : NetworkX graph
        A graph.

    weight : object, optional
        The data key used to determine the weight of each node. If None, each
        node has unit weight. Default value: 'weight'.

    options : MetisOptions, optional
        METIS options. If None, the default options are used. Default value:
        None.

    Returns
    -------
    perm : list of nodes
        The node ordering.

    Raises
    ------
    NetworkXError
        If the parameters cannot be converted to valid METIS input format, or
        METIS returns an error status.
    """
    if len(G) == 0:
        return []

    vwgt = [G.node[u].get(weight, 1) for u in G]
    if all(w == 1 for w in vwgt):
        vwgt = None

    xadj, adjncy = _convert_graph(G)

    with _zero_numbering(options):
        perm = metis.node_nd(xadj, adjncy, vwgt, options)[0]

    nodes = list(G)
    perm = [nodes[i] for i in perm]

    return perm


@nx.utils.not_implemented_for('directed')
@nx.utils.not_implemented_for('multigraph')
@_convert_exceptions(
    nx.NetworkXError, (ValueError, TypeError, exceptions.MetisError))
def partition(G, nparts, node_weight='weight', node_size='size',
              edge_weight='weight', tpwgts=None, ubvec=None, options=None,
              recursive=False):
    """Partition a graph using multilevel recursive bisection or multilevel
    multiway partitioning.

    Parameters
    ----------
    G : NetworkX graph
        An undirected graph.

    nparts : int
        Number of parts to partition the graph. It should be at least 2.

    node_weight : object, optional
        The data key used to determine the weight of each node. If None, each
        node has unit weight. Default value: 'weight'.

    node_size : object, optional
        The data key used to determine the size of each node when computing the
        total communication volumne. If None, each node has unit size. Default
        value: 'size'

    edge_weight : object, optional
        The data key used to determine the weight of each edge. If None, each
        edge has unit weight. Default value: 'weight'.

    tpwgts : list of lists of floats, optional
        The target weights of the partitions and the constraints. The target
        weight of the `i`-th partition and the `j`-th constraint is given by
        ``tpwgts[i][j]`` (the numbering for both partitions and constraints
        starts from zero). For each constraint the sum of the ``tpwgts[][]``
        entries must be 1.0 (i.e., `\sum_i \\text{tpwgts}[i][j] = 1.0`). If
        None, the graph is equally divided among the partitions. Default value:
        None.

    ubvec : list of floats, optional
        The allowed load imbalance tolerance for each constraint. For the
        `i`-th and the `j`-th constraint, the allowed weight is the
        ``ubvec[j] * tpwgts[i][j]`` fraction of the `j`-th constraint's total
        weight. The load imbalances must be greater than 1.0. If None, the load
        imbalance tolerance is 1.001 if there is exactly one constraint or 1.01
        if there are more. Default value: None.

    options : MetisOptions, optional.
        METIS options. If None, the default options are used. Default value:
        None.

    recursive : bool, optional
        If True, multilevel recursive bisection is used. Otherwise, multileve
        multilevel multiway partitioning is used. Default value: False.

    Returns
    -------
    objval : int
        The edge-cut or the total communication volume of the partitioning
        solution. The value returned depends on the partitioining's objective
        function.

    parts : lists of nodes
        The partitioning.

    Raises
    ------
    NetworkXNotImplemented
        If the graph is directed or is a multigraph.

    NetworkXError
        If the parameters cannot be converted to valid METIS input format, or
        METIS returns an error status.
    """
    if nparts < 1:
        raise nx.NetworkXError('nparts is less than one.')
    if nparts == 1:
        return 0, [list(G)]

    if len(G) == 0:
        return 0, [[] for i in range(nparts)]

    xadj, adjncy = _convert_graph(G)

    vwgt = [G.node[u].get(node_weight, 1) for u in G]
    if all(w == 1 for w in vwgt):
        vwgt = None

    vsize = [G.node[u].get(node_size, 1) for u in G]
    if all(w == 1 for w in vsize):
        vsize = None

    adjwgt = [G[u][v].get(edge_weight, 1) for u in G for v in G[u]]
    if all(w == 1 for w in adjwgt):
        adjwgt = None

    if tpwgts is not None:
        if len(tpwgts) != nparts:
            raise nx.NetworkXError('length of tpwgts is not equal to nparts.')
        ncon = len(tpwgts[0])
        if any(len(tpwgts[j]) != ncon for j in range(1, nparts)):
            raise nx.NetworkXError(
                'lists in tpwgts are not of the same length.')
        if ubvec is not None and len(ubvec) != ncon:
            raise nx.NetworkXError(
                'ubvec is not of the same length as tpwgts.')
        tpwgts = list(itertools.chain.from_iterable(tpwgts))

    with _zero_numbering(options):
        objval, part = metis.part_graph(xadj, adjncy, nparts, vwgt, vsize,
                                         adjwgt, tpwgts, ubvec, options,
                                         recursive)

    parts = [[] for i in range(nparts)]
    for u, i in zip(G, part):
        parts[i].append(u)

    return objval, parts


@nx.utils.not_implemented_for('directed')
@nx.utils.not_implemented_for('multigraph')
@_convert_exceptions(
    nx.NetworkXError, (ValueError, TypeError, exceptions.MetisError))
def vertex_separator(G, weight='weight', options=None):
    """Compute a vertex separator that bisects a graph. The algorithm aims to
    minimize the sum of weights of vertices in the separator.

    Parameters
    ----------
    G : NetworkX graph
        A graph.

    weight : object, optional
        The data key used to determine the weight of each node. If None, each
        node has unit weight. Default value: 'weight'.

    options : MetisOptions, optional
        METIS options. If None, the default options are used. Default value:
        None.

    Returns
    -------
    sep, part1, part2 : lists of nodes
        The separator and the two parts of the bisection represented as lists.

    Raises
    ------
    NetworkXError
        If the parameters cannot be converted to valid METIS input format, or
        METIS returns an error status.
    """
    if len(G) == 0:
        return [], [], []

    vwgt = [G.node[u].get(weight, 1) for u in G]
    if all(w == 1 for w in vwgt):
        vwgt = None

    xadj, adjncy = _convert_graph(G)

    with _zero_numbering(options):
        part = metis.compute_vertex_separator(xadj, adjncy, vwgt, options)[1]

    groups = [[], [], []]
    for u, i in zip(G, part):
        groups[i].append(u)

    return groups[2], groups[0], groups[1]
