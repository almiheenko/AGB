cdef extern from "metis.h":
    ctypedef Py_ssize_t idx_t
    ctypedef float real_t

    int METIS_PartGraphRecursive(
        idx_t *nvtxs, idx_t *ncon, idx_t *xadj, idx_t *adjncy, idx_t *vwgt,
        idx_t *vsize, idx_t *adjwgt, idx_t *nparts, real_t *tpwgts,
        real_t *ubvec, idx_t *options, idx_t *edgecut, idx_t *part) nogil

    int METIS_PartGraphKway(
        idx_t *nvtxs, idx_t *ncon, idx_t *xadj, idx_t *adjncy, idx_t *vwgt,
        idx_t *vsize, idx_t *adjwgt, idx_t *nparts, real_t *tpwgts,
        real_t *ubvec, idx_t *options, idx_t *edgecut, idx_t *part) nogil

    int METIS_MeshToDual(
        idx_t *ne, idx_t *nn, idx_t *eptr, idx_t *eind, idx_t *ncommon,
        idx_t *numflag, idx_t **r_xadj, idx_t **r_adjncy) nogil

    int METIS_MeshToNodal(
        idx_t *ne, idx_t *nn, idx_t *eptr, idx_t *eind, idx_t *numflag,
        idx_t **r_xadj, idx_t **r_adjncy) nogil

    int METIS_PartMeshNodal(
        idx_t *ne, idx_t *nn, idx_t *eptr, idx_t *eind, idx_t *vwgt,
        idx_t *vsize, idx_t *nparts, real_t *tpwgts, idx_t *options,
        idx_t *objval, idx_t *epart, idx_t *npart) nogil

    int METIS_PartMeshDual(
        idx_t *ne, idx_t *nn, idx_t *eptr, idx_t *eind, idx_t *vwgt,
        idx_t *vsize, idx_t *ncommon, idx_t *nparts, real_t *tpwgts,
        idx_t *options, idx_t *objval, idx_t *epart, idx_t *npart) nogil

    int METIS_NodeND(
        idx_t *nvtxs, idx_t *xadj, idx_t *adjncy, idx_t *vwgt, idx_t *options,
        idx_t *perm, idx_t *iperm) nogil

    int METIS_Free(void *ptr) nogil

    int METIS_SetDefaultOptions(idx_t *options) nogil

    int METIS_ComputeVertexSeparator(
        idx_t *nvtxs, idx_t *xadj, idx_t *adjncy, idx_t *vwgt, idx_t *options,
        idx_t *sepsize, idx_t *part) nogil

    enum:
        METIS_VER_MAJOR
        METIS_VER_MINOR
        METIS_VER_SUBMINOR
        METIS_NOPTIONS

    enum rstatus_et:
        METIS_OK
        METIS_ERROR_INPUT
        METIS_ERROR_MEMORY
        METIS_ERROR

    enum moptype_et:
        METIS_OP_PMETIS
        METIS_OP_KMETIS
        METIS_OP_OMETIS

    enum moptions_et:
        METIS_OPTION_PTYPE
        METIS_OPTION_OBJTYPE
        METIS_OPTION_CTYPE
        METIS_OPTION_IPTYPE
        METIS_OPTION_RTYPE
        METIS_OPTION_DBGLVL
        METIS_OPTION_NITER
        METIS_OPTION_NCUTS
        METIS_OPTION_SEED
        METIS_OPTION_NO2HOP
        METIS_OPTION_MINCONN
        METIS_OPTION_CONTIG
        METIS_OPTION_COMPRESS
        METIS_OPTION_CCORDER
        METIS_OPTION_PFACTOR
        METIS_OPTION_NSEPS
        METIS_OPTION_UFACTOR
        METIS_OPTION_NUMBERING

    enum mptype_et:
        METIS_PTYPE_RB
        METIS_PTYPE_KWAY

    enum mgtype_et:
        METIS_GTYPE_DUAL
        METIS_GTYPE_NODAL

    enum mctype_et:
        METIS_CTYPE_RM
        METIS_CTYPE_SHEM

    enum miptype_et:
        METIS_IPTYPE_GROW
        METIS_IPTYPE_RANDOM
        METIS_IPTYPE_EDGE
        METIS_IPTYPE_NODE

    enum mrtype_et:
        METIS_RTYPE_FM
        METIS_RTYPE_GREEDY
        METIS_RTYPE_SEP2SIDED
        METIS_RTYPE_SEP1SIDED

    enum mdbglvl_et:
        METIS_DBG_INFO
        METIS_DBG_TIME
        METIS_DBG_COARSEN
        METIS_DBG_REFINE
        METIS_DBG_IPART
        METIS_DBG_MOVEINFO
        METIS_DBG_SEPINFO
        METIS_DBG_CONNINFO
        METIS_DBG_CONTIGINFO
        METIS_DBG_MEMORY

    enum mobjtype_et:
        METIS_OBJTYPE_CUT
        METIS_OBJTYPE_VOL
