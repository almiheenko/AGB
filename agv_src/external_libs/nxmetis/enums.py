import enum

__all__ = ['MetisPType', 'MetisObjType', 'MetisCType', 'MetisIPType',
           'MetisRType', 'MetisNumbering', 'MetisDbgLvl', 'MetisRStatus']


@enum.unique
class MetisPType(enum.IntEnum):
    """Partitioning method."""

    default = -1
    """Default partitioning method."""

    rb = 0
    """Multilevel recursive bisectioning."""

    kway = 1
    """Multilevel `k`-way partitioning."""


@enum.unique
class MetisObjType(enum.IntEnum):
    """Type of objective."""

    default = -1
    """Default type of objective."""

    cut = 0
    """Edge-cut minimization."""

    vol = 1
    """Total communication volume minimization."""


@enum.unique
class MetisCType(enum.IntEnum):
    """Catching scheme to be used during coarsening."""

    default = -1
    """Default catching scheme."""

    rm = 0
    """Random matching."""

    shem = 1
    """Sorted heavy-edge matching."""


@enum.unique
class MetisIPType(enum.IntEnum):
    """Algorithm used during initial partitioning."""

    default = -1
    """Default method for initial partitioning."""

    grow = 0
    """Grow a bisection using a greedy strategy."""
    
    random = 1
    """Compute a bisection at random followed by a refinement."""
    
    edge = 2
    """Derive a separator from an edge cut."""
    
    node = 3
    """Grow a bisection using a greedy node-based strategy."""


@enum.unique
class MetisRType(enum.IntEnum):
    """Algorithm used for refinement."""

    default = -1
    """Default method used for refinement."""

    fm = 0
    """FM-based cut refinement."""
    
    greedy = 1
    """Greedy-based cut and volume refinement."""
    
    sep2sided = 2
    """Two-sided node FM refinement."""
    
    sep1sided = 3
    """One-sided node FM refinement."""


@enum.unique
class MetisNumbering(enum.IntEnum):
    """Numbering scheme is used for the adjacency structure of a graph or the
    element-node structure of a mesh."""

    default = -1
    """Default numbering scheme."""

    zero = 0
    """C-style zero-based numbering."""

    one = 1
    """Fortran-style one-based numbering."""


@enum.unique
class MetisDbgLvl(enum.IntEnum):
    """Amount of progress/debugging information will be printed during the
    execution of the algorithms. Can be combined by bit-wise OR."""

    default = -1
    """Display default statistics."""

    info = 1
    """Print various diagnostic messages."""

    time = 2
    """Perform timing analysis."""

    coarsen = 4
    """Display various statistics during coarsening."""

    refine = 8
    """Display various statistics during refinement."""

    ipart = 16
    """Display various statistics during initial partitioning."""

    moveinfo = 32
    """Display detailed information about vertex moves during
    refinement."""

    sepinfo = 64
    """Display information about vertex separators."""

    conninfo = 128
    """Display information related to the minimization of
    subdomain connectivity."""

    contiginfo = 256
    """Display information related to the elimination of
    connected components."""


@enum.unique
class MetisRStatus(enum.IntEnum):
    """Return codes by METIS."""

    ok = 1
    """Returned normally."""

    error_input = -2
    """Returned due to erroneous inputs and/or options."""
    
    error_memory = -3
    """Returned due to insufficient memory."""
    
    error = -4
    """Some other errors."""
