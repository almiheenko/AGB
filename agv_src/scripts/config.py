from os.path import join, dirname, abspath, realpath

ABYSS_NAME = 'ABYSS'
CANU_NAME = 'Canu'
FLYE_NAME = 'Flye'
SPADES_NAME = 'SPAdes'

SUPPORTED_ASSEMBLERS = [CANU_NAME, FLYE_NAME]

MAX_SUB_NODES = 80
MAX_NODES = 300

ROOT_DIR = abspath(dirname(dirname(realpath(__file__))))
HTML_DIR = join(ROOT_DIR, "html_files")
CSS_DIR = join(HTML_DIR, "css")
JS_DIR = join(HTML_DIR, "js")
TEMPLATE_PATH = join(HTML_DIR, "template.html")
HTML_NAME = "viewer.html"

DEFAULT_THREADS = 4


