import numbers

from agv_src.external_libs.nxmetis import enums
from agv_src.external_libs.nxmetis import metis

__all__ = ['MetisOptions']


class MetisOptions(object):
    """Options controlling behaviors of METIS algorithms."""

    def __init__(self, **kwargs):
        """Initializes a MetisOptions object. Values can be provided
        for some parameters as arguments.

        Example
        -------
        >>> options = MetisOptions(ncuts=2, niter=100)

        """
        metis.set_default_options(self)
        for key, value in kwargs.items():
            if value is not None:
                setattr(self, key, value)

    @property
    def ptype(self):
        """Types of Partitioning method.

            ==== =================================
            rb   Multilevel recursive bisectioning
            kway Multilevel `k`-way partitioning
            ==== =================================
        """
        return self._ptype

    @ptype.setter
    def ptype(self, value):
        self._ptype = enums.MetisPType(value)

    @property
    def objtype(self):
        """Type of objective.

            === =======================================
            cut Edge-cut minimization
            vol Total communication volume minimization
            === =======================================
        """
        return self._objtype

    @objtype.setter
    def objtype(self, value):
        self._objtype = enums.MetisObjType(value)

    @property
    def ctype(self):
        """Matching scheme to be used during coarsening.

            ==== ==========================
            rm   Random matching
            shem Sorted heavy-edge matching
            ==== ==========================
        """
        return self._ctype

    @ctype.setter
    def ctype(self, value):
        self._ctype = enums.MetisCType(value)

    @property
    def iptype(self):
        """Algorithm used during initial partitioning.

            ====== ======================================================
            grow   Grow a bisection using a greedy strategy
            random Compute a bisection at random followed by a refinement
            edge   Derive a separator from an edge cut
            node   Grow a bisection using a greedy node-based strategy
            ====== ======================================================
       """
        return self._iptype

    @iptype.setter
    def iptype(self, value):
        self._iptype = enums.MetisIPType(value)

    @property
    def rtype(self):
        """Algorithm used for refinement.

            ========= ======================================
            fm        FM-based cut refinement
            greedy    Greedy-based cut and volume refinement
            sep2sided Two-sided node FM refinement
            sep1sided One-sided node FM refinement
            ========= ======================================
        """
        return self._rtype

    @rtype.setter
    def rtype(self, value):
        self._rtype = enums.MetisRType(value)

    @property
    def ncuts(self):
        """Number of cuts."""
        return self._ncuts

    @ncuts.setter
    def ncuts(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._ncuts = int(value)

    @property
    def nseps(self):
        """Number of separators."""
        return self._nseps

    @nseps.setter
    def nseps(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._nseps = int(value)

    @property
    def numbering(self):
        """Numbering scheme is used for the adjacency structure of a graph or the
        element-node structure of a mesh.

            ==== =================================
            zero C-style zero-based numbering
            one  Fortran-style one-based numbering
            ==== =================================
        """
        return self._numbering

    @numbering.setter
    def numbering(self, value):
        self._numbering = enums.MetisNumbering(value)

    @property
    def niter(self):
        """Number of refinement iterations."""
        return self._niter

    @niter.setter
    def niter(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._niter = value

    @property
    def seed(self):
        """Random number seed."""
        return self._seed

    @seed.setter
    def seed(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._seed = value

    @property
    def minconn(self):
        """Number of mimimum connectivity."""
        return self._minconn

    @minconn.setter
    def minconn(self, value):
        self._minconn = bool(value)

    @property
    def no2hop(self):
        """A boolean to perform a 2-hop matching."""
        return self._no2hop

    @no2hop.setter
    def no2hop(self, value):
        self._no2hop = bool(value)

    @property
    def contig(self):
        """A boolean to create contigous partitions."""
        return self._contig

    @contig.setter
    def contig(self, value):
        self._contig = bool(value)

    @property
    def compress(self):
        """A boolean to compress graph prior to ordering."""
        return self._compress

    @compress.setter
    def compress(self, value):
        self._compress = bool(value)

    @property
    def ccorder(self):
        """A boolean to detect & order connected components separately."""
        return self._ccorder

    @ccorder.setter
    def ccorder(self, value):
        self._ccorder = bool(value)

    @property
    def pfactor(self):
        """Prunning factor for high degree vertices."""
        return self._pfactor

    @pfactor.setter
    def pfactor(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._pfactor = value

    @property
    def ufactor(self):
        """User-supplied ufactor."""
        return self._ufactor

    @ufactor.setter
    def ufactor(self, value):
        if not isinstance(value, numbers.Number) or value != int(value):
            raise ValueError('{0} is not an int'.format(repr(value)))
        self._ufactor = value

    @property
    def dbglvl(self):
        """Amount of progress/debugging information will be printed during the
        execution of the algorithms. Can be combined by bit-wise OR.

            ========== ======================================================
            info       Print various diagnostic messages
            time       Perform timing analysis
            coarsen    Display various statistics during coarsening
            refine     Display various statistics during refinement
            ipart      Display various statistics during initial partitioning
            moveinfo   Display detailed information about vertex moves during
                       refinement
            sepinfo    Display information about vertex separators
            conninfo   Display information related to the minimization of
                       subdomain connectivity
            contiginfo Display information related to the elimination of
                       connected components
            ========== ======================================================
        """
        return self._dbglvl

    @dbglvl.setter
    def dbglvl(self, value):
        if (not isinstance(value, numbers.Number) or value != int(value) or
            not (value == -1 or (value >= 0 and value < 512) or
                 (value >= 2048 and value < 2560))):
            raise ValueError('{0} is not a valid dbglvl'.format(repr(value)))
        self._dbglvl = int(value)

    def __repr__(self):
        names = ['ptype', 'objtype', 'ctype', 'iptype', 'rtype', 'ncuts',
                 'nseps', 'numbering', 'niter', 'seed', 'minconn', 'no2hop',
                 'contig', 'compress', 'ccorder', 'pfactor', 'ufactor']
        return '{0}({1})'.format(
            self.__class__.__name__,
            ', '.join('{0}={1}'.format(name, repr(getattr(self, name)))
                      for name in names))
