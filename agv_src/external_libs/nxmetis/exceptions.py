from agv_src.external_libs.nxmetis import enums
__all__ = ['MetisError']


class MetisError(Exception):
    """Error returned by METIS"""

    def __init__(self, rstatus, msg):
        """Initializes a MetisError object.

        Parameters
        ----------
        rstatus : int
            Error code returned by METIS.

        msg : string
            Error message returned by METIS.
        """
        super(MetisError, self).__init__('{0}: {1}'.format(
            enums.MetisRStatus(rstatus).name, msg))
