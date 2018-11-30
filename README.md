## Assembly Graph Browser (AGB)

Provides interactive visualization of assembly graphs, a wide range of tuning parameters, and various options for modifying/simplifying the graph.

### Installation
Install conda if you don't have one:
```
wget https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
bash miniconda.sh -b -p ./miniconda
unset PYTHONPATH
export PATH=$(pwd)/miniconda/bin:$PATH
```

Create a new conda environment and install AGB into it:
```
conda create -c almiheenko -c graphtools -c bioconda -n AGB agb
```

Activate the environment:
```
source activate AGB
```

### Usage
Run AGB to visualize an assembly graph:
```
    agb.py --graph <GFA(1,2)/FASTG/Graphviz file> -a <assembler_name>
```

Run AGB on an assembler output folder to visualize an assembly graph with additional useful information:
```
    agb.py -i <assembler_output_dir> -a <assembler_name>
```

The assembly graph viewer will be saved to <code>agb_output/viewer.html</code>.

### Examples

You can see AGB examples here https://almiheenko.github.io/AGB/index.html

### Manual

Useful information can be found here https://almiheenko.github.io/AGB/manual.html

### Citation
