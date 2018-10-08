from os.path import join, dirname, abspath, realpath

ABYSS_NAME = 'ABYSS'
CANU_NAME = 'Canu'
FLYE_NAME = 'Flye'
SPADES_NAME = 'SPAdes'
SGA_NAME = 'SGA'
SOAP_NAME = 'SOAPdenovo2'
VELVET_NAME = 'Velvet'

SUPPORTED_ASSEMBLERS = [CANU_NAME, FLYE_NAME, SPADES_NAME]

MIN_EDGE_LEN = 100
MAX_SUB_NODES = 80
MAX_NODES = 300

ROOT_DIR = abspath(dirname(dirname(realpath(__file__))))
TOOLS_DIR = join(ROOT_DIR, "external_tools")
HTML_DIR = join(ROOT_DIR, "html_files")
CSS_DIR = join(HTML_DIR, "css")
JS_DIR = join(HTML_DIR, "js")
TEMPLATE_PATH = join(HTML_DIR, "template.html")
HTML_NAME = "viewer.html"

DEFAULT_THREADS = 4


