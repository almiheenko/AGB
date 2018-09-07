from libc cimport stdio
cimport cpython.mem
cimport _api

import contextlib
import os
import sys
import tempfile

from nxmetis import exceptions

__all__ = ['part_graph', 'node_nd', 'compute_vertex_separator']


_STDOUT_FILENO = 1 #File descriptor for stdout


@contextlib.contextmanager
def redirect_stdout(target):
    """Temporarily redirect operations on ``stdout`` to file ``target``.
    """
    stdio.fflush(stdio.stdout)
    with os.fdopen(os.dup(_STDOUT_FILENO), 'w') as stdout_backup:
        os.dup2(target.fileno(), _STDOUT_FILENO)
        try:
            yield
        finally:
            stdio.fflush(stdio.stdout)
            os.dup2(stdout_backup.fileno(), _STDOUT_FILENO)


cdef void* checked_malloc(_api.idx_t size) except NULL:
    cdef void* ptr = cpython.mem.PyMem_Malloc(size)
    if ptr == NULL:
        raise MemoryError()
    return ptr


cdef _api.idx_t* convert_idx_array(array) except NULL:
    """Convert a list of ints to a C array of idx_t's.
    """
    cdef _api.idx_t size = len(array)
    cdef _api.idx_t *_array = <_api.idx_t*> checked_malloc(sizeof(_api.idx_t) * size)
    cdef _api.idx_t i
    try:
        for i from 0 <= i < size:
            _array[i] = array[i]
    except:
        cpython.mem.PyMem_Free(_array)
        raise
    return _array


cdef _api.real_t* convert_real_array(array) except NULL:
    """Convert a list of floats to a C array of real_t's.
    """
    cdef _api.idx_t size = len(array)
    cdef _api.real_t *_array = <_api.real_t*> checked_malloc(sizeof(_api.real_t) * size)
    cdef _api.idx_t i
    try:
        for i from 0 <= i < size:
            _array[i] = array[i]
    except:
        cpython.mem.PyMem_Free(_array)
        raise
    return _array


cdef convert_options(options, _api.idx_t *_options):
    """Convert a MetisOptions object to a C array.
    """
    _api.METIS_SetDefaultOptions(_options)
    if options is None:
        return

    _options[<_api.idx_t> _api.METIS_OPTION_PTYPE]     = options.ptype
    _options[<_api.idx_t> _api.METIS_OPTION_OBJTYPE]   = options.objtype
    _options[<_api.idx_t> _api.METIS_OPTION_CTYPE]     = options.ctype
    _options[<_api.idx_t> _api.METIS_OPTION_IPTYPE]    = options.iptype
    _options[<_api.idx_t> _api.METIS_OPTION_RTYPE]     = options.rtype
    _options[<_api.idx_t> _api.METIS_OPTION_NCUTS]     = options.ncuts
    _options[<_api.idx_t> _api.METIS_OPTION_NSEPS]     = options.nseps
    _options[<_api.idx_t> _api.METIS_OPTION_NUMBERING] = options.numbering
    _options[<_api.idx_t> _api.METIS_OPTION_NITER]     = options.niter
    _options[<_api.idx_t> _api.METIS_OPTION_SEED]      = options.seed
    _options[<_api.idx_t> _api.METIS_OPTION_MINCONN]   = options.minconn
    _options[<_api.idx_t> _api.METIS_OPTION_NO2HOP]    = options.no2hop
    _options[<_api.idx_t> _api.METIS_OPTION_CONTIG]    = options.contig
    _options[<_api.idx_t> _api.METIS_OPTION_COMPRESS]  = options.compress
    _options[<_api.idx_t> _api.METIS_OPTION_CCORDER]   = options.ccorder
    _options[<_api.idx_t> _api.METIS_OPTION_PFACTOR]   = options.pfactor
    _options[<_api.idx_t> _api.METIS_OPTION_UFACTOR]   = options.ufactor
    _options[<_api.idx_t> _api.METIS_OPTION_DBGLVL]    = options.dbglvl


cdef void convert_graph(xadj, adjncy, _api.idx_t *nvtxs_ptr, _api.idx_t **_xadj_ptr,
                        _api.idx_t **_adjncy_ptr) except *:
    """Convert a list-based graph structure to C arrays.
    """
    cdef _api.idx_t nvtxs
    cdef _api.idx_t *_xadj = NULL
    cdef _api.idx_t *_adjncy = NULL
    cdef _api.idx_t i, j, k, l
    try:
        _xadj = convert_idx_array(xadj)
        nvtxs = len(xadj) - 1
        if nvtxs < 1:
            raise ValueError('len(xadj) < 2')
        if _xadj[0] != 0:
            raise ValueError('xadj[0] != 0')
        for i from 0 <= i < nvtxs:
            if _xadj[i] > _xadj[i + 1]:
                raise ValueError('xadj[{0}] > xadj[{1}]'.format(i, i + 1))

        _adjncy = convert_idx_array(adjncy)
        if len(adjncy) != _xadj[nvtxs]:
            raise ValueError('len(adjncy) != xadj[-1]')

    except:
        cpython.mem.PyMem_Free(_xadj)
        cpython.mem.PyMem_Free(_adjncy)
        raise
    with nogil:
        # Remove selfloops to prevent METIS crashes.
        k = 0
        for i from 0 <= i < nvtxs:
            l = k
            for j from _xadj[i] <= j < _xadj[i + 1]:
                if _adjncy[j] != i:
                    _adjncy[k] = _adjncy[j]
                    k += 1
            _xadj[i] = l
        _xadj[nvtxs] = k

        nvtxs_ptr[0] = nvtxs
        _xadj_ptr[0] = _xadj
        _adjncy_ptr[0] = _adjncy


cdef void check_result(int result, msg) except *:
    if result != _api.METIS_OK:
        raise exceptions.MetisError(result, msg)


def part_graph(xadj, adjncy, nparts, vwgt=None, vsize=None, adjwgt=None,
               tpwgts=None, ubvec=None, options=None, recursive=False):
    """Partition a graph into `k` parts using either multilevel recursive
    bisection or multilevel `k`-way partitioning.

    Parameters
    ----------
    xadj, adjncy : lists of ints
        Adjacency structure of the graph.

    nparts : int
        Number of parts to partition the graph. It should be at least 2.

    vwgt : list of ints
        Weights of the vertices. Default value: None.

    vsize : list of ints
        Sizes of the vertices for computing the total communication volume.
        Default value: None.

    adjwgt : list of ints
        Weights of the edges.

    tpwgts : list of floats
        List of size `\text{nparts} \times \text{ncon}` that specifies the
        desired weight for each partition and constraint. The target partition
        weight for the `i`th partition and `j`th constraint is specified at
        `\text{tpwgts}[i \ast \text{ncon} + j]` (the numbering for both
        partitions and constraints starts from 0). For each constraint, the sum
        of the `\text{tpwghts}[]` entries must be 1.0 (i.e.,
        `\sum_i \text{tpwgts}[i \ast \text{ncon} + j] = 1.0`).

        If None, the graph is equally divided among the partitions. Default
        value: None.

    ubvec : list of floats.
        List of size `\text{ncon}` that specifies the allowed load imbalance
        tolerance for each constraint. For the ith partition and jth constraint
        the allowed weight is the
        `\text{ubvec}[j] \ast \text{tpwgts}[i \ast \text{ncon} + j]` fraction
        of the `j`th constraint's total weight. The load imbalances must be
        greater than 1.0.

        If None, the load imbalance tolerance for each constraint is 1.001 (for
        `\text{ncon} = 1`) or 1.01 (for `\text{ncon} \ne 1`). Default value:
        None.

    options : MetisOptions
        Options. Default value: None

    Returns
    -------
    objval : int
        The edge-cut or the total communication volume of the partitioning
        solution. The value returned depends on the partitioning's objective
        function.

    part : list of ints
        The partition vector of the graph. The numbering of this vector starts
        from either 0 or 1, depending on the value of options.numbering.

    Raises
    ------
    MetisError
        If METIS returns an error status.

    Notes
    -----
    This wrapper function performs only minimal input validation to ensure
    memory safety in invocation of METIS.
    """
    cdef _api.idx_t nvtxs
    cdef _api.idx_t *_xadj = NULL
    cdef _api.idx_t *_adjncy = NULL
    cdef _api.idx_t _nparts
    cdef _api.idx_t *_vwgt = NULL
    cdef _api.idx_t *_vsize = NULL
    cdef _api.idx_t *_adjwgt = NULL
    cdef _api.real_t *_tpwgts = NULL
    cdef _api.idx_t ncon
    cdef _api.real_t *_ubvec = NULL
    cdef _api.idx_t _options[_api.METIS_NOPTIONS]
    cdef _api.idx_t objval
    cdef _api.idx_t *_part = NULL
    cdef int _recursive
    cdef int result
    cdef int i
    try:
        convert_graph(xadj, adjncy, &nvtxs, &_xadj, &_adjncy)
        _nparts = nparts
        if _nparts < 2:
            raise ValueError('nparts < 2')

        if vwgt is not None:
            _vwgt = convert_idx_array(vwgt)
            if len(vwgt) != nvtxs:
                raise ValueError('len(vwgt) != len(xadj) - 1')

        if vsize is not None:
            _vsize = convert_idx_array(vsize)
            if len(vsize) != nvtxs:
                raise ValueError('len(vsize) != len(xadj) - 1')

        if adjwgt is not None:
            _adjwgt = convert_idx_array(adjwgt)
            if len(adjwgt) != len(adjncy):
                raise ValueError('len(adjwgt) != len(adjncy)')

        if tpwgts is not None:
            _tpwgts = convert_real_array(tpwgts)
            if len(tpwgts) % _nparts != 0:
                raise ValueError('len(tpwgts) % nparts != 0')
            ncon = len(tpwgts) / _nparts
        else:
            ncon = 1

        if ubvec is not None:
            _ubvec = convert_real_array(ubvec)
            if len(ubvec) != ncon:
                raise ValueError('len(ubvec) != ncon')

        convert_options(options, _options)
        _part = <_api.idx_t*> checked_malloc(sizeof(_api.idx_t) * nvtxs)
        _recursive = bool(recursive)

        with tempfile.TemporaryFile() as tmp:
            with redirect_stdout(tmp), nogil:
                if _recursive:
                    result = _api.METIS_PartGraphRecursive(
                        &nvtxs, &ncon, _xadj, _adjncy, _vwgt, _vsize, _adjwgt,
                        &_nparts, _tpwgts, _ubvec, _options, &objval, _part)
                else:
                    result = _api.METIS_PartGraphKway(
                        &nvtxs, &ncon, _xadj, _adjncy, _vwgt, _vsize, _adjwgt,
                        &_nparts, _tpwgts, _ubvec, _options, &objval, _part)
            tmp.seek(0)
            msg = tmp.read().decode('ascii')

        check_result(result, msg)

        part = [_part[i] for i from 0 <= i < nvtxs]
        return objval, part
    finally:
        cpython.mem.PyMem_Free(_xadj)
        cpython.mem.PyMem_Free(_adjncy)
        cpython.mem.PyMem_Free(_vwgt)
        cpython.mem.PyMem_Free(_vsize)
        cpython.mem.PyMem_Free(_adjwgt)
        cpython.mem.PyMem_Free(_tpwgts)
        cpython.mem.PyMem_Free(_ubvec)
        cpython.mem.PyMem_Free(_part)


def node_nd(xadj, adjncy, vwgt=None, options=None):
    """Computes fill reducing orderings of sparse matrices using the multilevel
    nested dissection algorithm.

    Parameters
    ----------

    xadj, adjncy : lists of ints
        Adjacency structure of the graph.

    vwgt : list of ints, optional
        Weights of the vertices. If the graph is weighted, the nested
        dissection ordering computes vertex separators that minimize the sum of
        the weights of the vertices on the separators. Default value: None.

    options : MetisOptions
        Options. Default value: None

    Returns
    -------
    perm, iperm : lists of ints
        Upon successful completion, they store the fill-reducing permutation
        and inverse permutation. Let A be the original matrix and `A'` be the
        permuted matrix. The arrays perm and iperm are defined as follows. Row
        (column) `i` of `A'` is the perm[`i`] row (column) of `A`, and row
        (column) `i` of `A` is the iperm[`i`] row (column) of `A'`. The
        numbering of this vector starts from either 0 or 1, depending on the
        value of options.numbering.

    Raises
    ------
    MetisError
        If METIS returns an error status.

    Notes
    -----
    This wrapper function performs only minimal input validation to ensure
    memory safety in invocation of METIS.
    """
    cdef _api.idx_t nvtxs
    cdef _api.idx_t *_xadj = NULL
    cdef _api.idx_t *_adjncy = NULL
    cdef _api.idx_t *_vwgt = NULL
    cdef _api.idx_t _options[_api.METIS_NOPTIONS]
    cdef _api.idx_t *_perm = NULL
    cdef _api.idx_t *_iperm = NULL
    cdef int result
    cdef _api.idx_t i
    try:
        convert_graph(xadj, adjncy, &nvtxs, &_xadj, &_adjncy)

        if vwgt is not None:
            _vwgt = convert_idx_array(vwgt)
            if len(vwgt) != nvtxs:
                raise ValueError(
                    'length of vwgt is not equal to len(xadj) - 1')

        convert_options(options, _options)

        _perm = <_api.idx_t*> checked_malloc(sizeof(_api.idx_t) * nvtxs)
        _iperm = <_api.idx_t*> checked_malloc(sizeof(_api.idx_t) * nvtxs)

        with tempfile.TemporaryFile() as tmp:
            with redirect_stdout(tmp), nogil:
                result = _api.METIS_NodeND(&nvtxs, _xadj, _adjncy, _vwgt, _options,
                                           _perm, _iperm)
            tmp.seek(0)
            msg = tmp.read().decode('ascii')

        check_result(result, msg)

        perm = [_perm[i] for i from 0 <= i < nvtxs]
        iperm = [_iperm[i] for i from 0 <= i < nvtxs]
        return perm, iperm
    finally:
        cpython.mem.PyMem_Free(_xadj)
        cpython.mem.PyMem_Free(_adjncy)
        cpython.mem.PyMem_Free(_vwgt)
        cpython.mem.PyMem_Free(_perm)
        cpython.mem.PyMem_Free(_iperm)


def set_default_options(options):
    """Assign default values to a MetisOptions object.

    Parameters
    ----------
    options : MetisOptions
        Options.
    """
    cdef _api.idx_t _options[_api.METIS_NOPTIONS]
    _api.METIS_SetDefaultOptions(_options)
    options.ptype     = _options[<_api.idx_t> _api.METIS_OPTION_PTYPE]
    options.objtype   = _options[<_api.idx_t> _api.METIS_OPTION_OBJTYPE]
    options.ctype     = _options[<_api.idx_t> _api.METIS_OPTION_CTYPE]
    options.iptype    = _options[<_api.idx_t> _api.METIS_OPTION_IPTYPE]
    options.rtype     = _options[<_api.idx_t> _api.METIS_OPTION_RTYPE]
    options.ncuts     = _options[<_api.idx_t> _api.METIS_OPTION_NCUTS]
    options.nseps     = _options[<_api.idx_t> _api.METIS_OPTION_NSEPS]
    options.numbering = _options[<_api.idx_t> _api.METIS_OPTION_NUMBERING]
    options.niter     = _options[<_api.idx_t> _api.METIS_OPTION_NITER]
    options.seed      = _options[<_api.idx_t> _api.METIS_OPTION_SEED]
    options.minconn   = _options[<_api.idx_t> _api.METIS_OPTION_MINCONN]
    options.no2hop    = _options[<_api.idx_t> _api.METIS_OPTION_NO2HOP]
    options.contig    = _options[<_api.idx_t> _api.METIS_OPTION_CONTIG]
    options.compress  = _options[<_api.idx_t> _api.METIS_OPTION_COMPRESS]
    options.ccorder   = _options[<_api.idx_t> _api.METIS_OPTION_CCORDER]
    options.pfactor   = _options[<_api.idx_t> _api.METIS_OPTION_PFACTOR]
    options.ufactor   = _options[<_api.idx_t> _api.METIS_OPTION_UFACTOR]
    options.dbglvl    = _options[<_api.idx_t> _api.METIS_OPTION_DBGLVL]


def compute_vertex_separator(xadj, adjncy, vwgt=None, options=None):
    cdef _api.idx_t nvtxs
    cdef _api.idx_t *_xadj = NULL
    cdef _api.idx_t *_adjncy = NULL
    cdef _api.idx_t *_vwgt = NULL
    cdef _api.idx_t _options[_api.METIS_NOPTIONS]
    cdef _api.idx_t sepsize
    cdef _api.idx_t *_part = NULL
    cdef int result
    cdef int i
    try:
        convert_graph(xadj, adjncy, &nvtxs, &_xadj, &_adjncy)

        if vwgt is not None:
            _vwgt = convert_idx_array(vwgt)
            if len(vwgt) != nvtxs:
                raise ValueError('len(vwgt) != len(xadj) - 1')

        convert_options(options, _options)
        _part = <_api.idx_t*> checked_malloc(sizeof(_api.idx_t) * nvtxs)

        with tempfile.TemporaryFile() as tmp:
            with redirect_stdout(tmp), nogil:
                result = _api.METIS_ComputeVertexSeparator(
                    &nvtxs, _xadj, _adjncy, _vwgt, _options, &sepsize, _part)
            tmp.seek(0)
            msg = tmp.read().decode('ascii')

        check_result(result, msg)

        part = [_part[i] for i from 0 <= i < nvtxs]
        return sepsize, part
    finally:
        cpython.mem.PyMem_Free(_xadj)
        cpython.mem.PyMem_Free(_adjncy)
        cpython.mem.PyMem_Free(_vwgt)
        cpython.mem.PyMem_Free(_part)
