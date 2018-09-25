/*****************
 * Unix getopt() *
 *****************/

var getopt = function(args, ostr) {
	var oli; // option letter list index
	if (typeof(getopt.place) == 'undefined')
		getopt.ind = 0, getopt.arg = null, getopt.place = -1;
	if (getopt.place == -1) { // update scanning pointer
		if (getopt.ind >= args.length || args[getopt.ind].charAt(getopt.place = 0) != '-') {
			getopt.place = -1;
			return null;
		}
		if (getopt.place + 1 < args[getopt.ind].length && args[getopt.ind].charAt(++getopt.place) == '-') { // found "--"
			++getopt.ind;
			getopt.place = -1;
			return null;
		}
	}
	var optopt = args[getopt.ind].charAt(getopt.place++); // character checked for validity
	if (optopt == ':' || (oli = ostr.indexOf(optopt)) < 0) {
		if (optopt == '-') return null; //  if the user didn't specify '-' as an option, assume it means null.
		if (getopt.place < 0) ++getopt.ind;
		return '?';
	}
	if (oli+1 >= ostr.length || ostr.charAt(++oli) != ':') { // don't need argument
		getopt.arg = null;
		if (getopt.place < 0 || getopt.place >= args[getopt.ind].length) ++getopt.ind, getopt.place = -1;
	} else { // need an argument
		if (getopt.place >= 0 && getopt.place < args[getopt.ind].length)
			getopt.arg = args[getopt.ind].substr(getopt.place);
		else if (args.length <= ++getopt.ind) { // no arg
			getopt.place = -1;
			if (ostr.length > 0 && ostr.charAt(0) == ':') return ':';
			return '?';
		} else getopt.arg = args[getopt.ind]; // white space
		getopt.place = -1;
		++getopt.ind;
	}
	return optopt;
}

/**********************
 * Fasta/Fastq parser *
 **********************/

Fastx = function(f) {
	this._file = f;
	this._last = 0;
	this._line = new Bytes();
	this._finished = false;
	this.s = new Bytes();
	this.q = new Bytes();
	this.n = new Bytes();
	this.c = new Bytes();
}

Fastx.prototype.read = function() {
	var c, f = this._file, line = this._line;
	if (this._last == 0) { // then jump to the next header line
		while ((c = f.read()) != -1 && c != 62 && c != 64);
		if (c == -1) return -1; // end of file
		this._last = c;
	} // else: the first header char has been read in the previous call
	this.c.length = this.s.length = this.q.length = 0;
	if ((c = f.readline(this.n, 0)) < 0) return -1; // normal exit: EOF
	if (c != 10) f.readline(this.c); // read FASTA/Q comment
	if (this.s.capacity == 0) this.s.capacity = 256;
	while ((c = f.read()) != -1 && c != 62 && c != 43 && c != 64) {
		if (c == 10) continue; // skip empty lines
		this.s.set(c);
		f.readline(this.s, 2, this.s.length); // read the rest of the line
	}
	if (c == 62 || c == 64) this._last = c; // the first header char has been read
	if (c != 43) return this.s.length; // FASTA
	this.q.capacity = this.s.capacity;
	c = f.readline(this._line); // skip the rest of '+' line
	if (c < 0) return -2; // error: no quality string
	var size = this.s.length;
	while (f.readline(this.q, 2, this.q.length) >= 0 && this.q.length < size);
	f._last = 0; // we have not come to the next header line
	if (this.q.length != size) return -2; // error: qual string is of a different length
	return size;
}

Fastx.prototype.destroy = function() {
	this.s.destroy(); this.q.destroy(); this.c.destroy(); this.n.destroy(); this._line.destroy();
	if (typeof(this._file.close) == 'object') this._file.close();
}

/*******************************************
 * Sequence reverse and reverse-complement *
 *******************************************/

Bytes.prototype.reverse = function()
{
	for (var i = 0; i < this.length>>1; ++i) {
		var tmp = this[i];
		this[i] = this[this.length - i - 1];
		this[this.length - i - 1] = tmp;
	}
}

Bytes.prototype.revcomp = function()
{
	if (Bytes.rctab == null) {
		var s1 = 'WSATUGCYRKMBDHVNwsatugcyrkmbdhvn';
		var s2 = 'WSTAACGRYMKVHDBNwstaacgrymkvhdbn';
		Bytes.rctab = [];
		for (var i = 0; i < 256; ++i) Bytes.rctab[i] = 0;
		for (var i = 0; i < s1.length; ++i)
			Bytes.rctab[s1.charCodeAt(i)] = s2.charCodeAt(i);
	}
	for (var i = 0; i < this.length>>1; ++i) {
		var tmp = this[this.length - i - 1];
		this[this.length - i - 1] = Bytes.rctab[this[i]];
		this[i] = Bytes.rctab[tmp];
	}
	if (this.length&1)
		this[this.length>>1] = Bytes.rctab[this[this.length>>1]];
}

/**************
 * GFA -> dot *
 **************/

function gfa_gfa2dot(args)
{
	var c, both = false, no_end = false, undirected = false, max_size = 16, no_label = false;
	while ((c = getopt(args, 'bEuLS')) != null) {
		if (c == 'b') both = true;
		else if (c == 'E') no_end = true;
		else if (c == 'u') undirected = true;
		else if (c == 'L') no_label = true;
		else if (c == 'S') no_end = undirected = no_label = true;
	}

	if (getopt.ind == args.length) {
		print("");
		print("Usage:   k8 gfatools.js gfa2dot [options] <in.gfa>\n");
		print("Options: -b       the input contains links from both directions");
		print("         -E       don't show the ends of segments (more compact layout)");
		print("         -u       undirected dot output");
		print("         -L       don't display label");
		print("         -S       apply -uLE");
		print("");
		exit(1);
	}

	var file = args[getopt.ind] == '-'? new File() : new File(args[getopt.ind]);
	var buf = new Bytes();
	var log2 = Math.log(2);

	print(undirected? "graph G {" : "digraph G {");
	print('\tgraph[size="8,8"]');
	print(no_label? '\tnode[shape=point,color="#FF0000"]' : '\tnode[shape=record,fontsize=10,height=0,width=0,color="#CCCCCC"]');
	print(undirected? '\tedge[dir=none,color="#0080FF"]' : '\tedge[arrowsize=0.7,dir=both,color="#0080FF"]');

	while (file.readline(buf) >= 0) {
		var t = buf.toString().split("\t");
		if (t[0] == 'S') {
			var len = null;
			if (t[2] == '*') {
				for (var i = 3; i < t.length; ++i) {
					if (t[i].substr(0, 2) == 'LN') {
						len = parseInt(t[i].substr(5));
						break;
					}
				}
			} else len = t[2].length;
			var fs = '';
			if (len != null) {
				fs = Math.floor(Math.log(len + 100) / log2);
				if (fs > max_size) fs = max_size;
				fs = 'fontsize=' + fs;
				if (len >= 100000) fs += ',color="#FFC0C0"';
				else if (len >= 10000) fs += ',color="#FFE0C0"';
				else if (len >= 1000) fs += ',color="#C0FFC0"';
			}
			if (no_end) print("\t" + '"'+t[1]+'"' + '[' + fs + ']');
			else print("\t" + '"'+t[1]+'"' + '[' + fs + ',label="<f5>|<f0>' + t[1] + '|<f3>"]');
		} else if (t[0] == 'L') {
			var attr = '', f0 = '', f1 = '';
			if (both && t[1] > t[3]) continue;
			if (!undirected) {
				if (!no_end) {
					f0 = t[2] == '+'? ':f3' : ':f5';
					f1 = t[4] == '+'? ':f5' : ':f3';
				}
				if (t[2] == '+') attr = ' [arrowtail=inv,';
				else attr = ' [arrowtail=normal,';
				if (t[4] == '+') attr += 'arrowhead=normal]';
				else attr += 'arrowhead=inv]';
			}
			var dir = undirected? " -- " : " -> ";
			print("\t" + '"'+t[1]+'"'+f0 + dir + '"'+t[3]+'"'+f1 + attr);
		}
	}

	print("}");

	buf.destroy();
	file.close();
}

/*****************
 * Velvet -> GFA *
 *****************/

function gfa_velvet2gfa(args)
{
	var c, no_seq = false;
	while ((c = getopt(args, "S")) != null)
		if (c == 'S') no_seq = true;

	if (args.length == getopt.ind) {
		print("");
		print("Usage:   k8 gfatools.js velvet2gfa [options] <LastGraph>\n");
		print("Options: -S      don't show sequences");
		print("");
		exit(1);
	}

	var file = args[getopt.ind] == '-'? new File() : new File(args[getopt.ind]);
	var buf = new Bytes();
	var buf2 = new Bytes();
	file.readline(buf);
	var l = parseInt(buf.toString().split("\t")[2]) - 1; // l is the overlap length
	while (file.readline(buf) >= 0) {
		var m, line = buf.toString();
		if ((m = /^NODE\s+(\d+)/.exec(line)) != null) {
			file.readline(buf); file.readline(buf2);
			if (buf.length >= l) {
				var s = buf2.toString().substr(buf2.length - l);
				buf2.length = 0;
				buf2.set(s);
				buf2.revcomp();
			} else {
				buf2.revcomp();
				for (var i = 0; i < l - buf.length; ++i)
					buf2.set('N');
			}
			if (!no_seq) print("S", m[1], buf2.toString() + buf.toString());
			else print("S", m[1], '*', "LN:i:"+(buf2.length+buf.length));
		} else if ((m = /^ARC\s+(-)?(\d+)\s+(-)?(\d+)\s+(\d+)/.exec(line)) != null) {
			if (m[1] == null) m[1] = '+';
			if (m[3] == null) m[3] = '+';
			print('L', m[2], m[1], m[4], m[3], l+'M', 'RC:i:'+m[5]);
		}
	}
	buf2.destroy();
	buf.destroy();
	file.close();
}

/*****************
 * SPAdes -> GFA *
 *****************/

function gfa_spades2gfa(args)
{
	var c, ori_name = false, no_seq = false;
	while ((c = getopt(args, "OS")) != null)
		if (c == 'O') ori_name = true;
		else if (c == 'S') no_seq = true;

	if (args.length == getopt.ind) {
		print("");
		print("Usage:   k8 gfatools.js spades2gfa [options] <spades.fastg>\n");
		print("Options: -O      keep the original node names");
		print("         -S      don't show sequences");
		print("");
		exit(1);
	}

	var file = args[getopt.ind] == '-'? new File() : new File(args[getopt.ind]);
	var buf = new Bytes();
	var seq = null, last_hdr = null;
	var re = /NODE_(\d+)_length_(\d+)_cov_(\d+(\.\d+)?)_ID_(\d+)/;

	function print_node(h, s)
	{
		var t = h.split(':'), name;
		var len = null, cov = null;
		if (no_seq) s = '*';
		if (!ori_name) {
			var m = re.exec(t[0]);
			if (m == null) throw Error("Failed to parse the node name: "+t[0]);
			name = 'n'+m[1]+"_"+m[5];
			len = m[2]; cov = m[3];
			print('S', name, s, 'LN:i:'+m[2], 'KC:f:'+m[3]);
		} else {
			name = t[0];
			print('S', name, s);
		}
		for (var i = 1; i < t.length; ++i) {
			var ori, v;
			if (t[i].substr(t[i].length - 1) == "'") {
				ori = '-', v = t[i].substr(0, t[i].length - 1);
			} else ori = '+', v = t[i];
			if (!ori_name) {
				var m = re.exec(v);
				if (m == null) throw Error("Failed to parse the node name: "+v);
				v = 'n'+m[1]+"_"+m[5];
			}
			print('L', name, '+', v, ori, '0M');
		}
	}

	while (file.readline(buf) >= 0) {
		var line = buf.toString();
		if (line.charAt(0) == '>') {
			if (seq != null) print_node(last_hdr, seq);
			seq = '';
			last_hdr = line.substr(1, line.length - 2);
		} else seq += line;
	}
	if (seq != null) print_node(last_hdr, seq);
	buf.destroy();
	file.close();
}

/*********************
 * SOAPdenovo -> GFA *
 *********************/

function gfa_soap2gfa(args)
{
	var c, no_seq = false, keep_twin = false;
	while ((c = getopt(args, "ST")) != null)
		if (c == 'S') no_seq = true;
		else if (c == 'T') keep_twin = true;

	if (args.length == getopt.ind) {
		print("");
		print("Usage:   k8 gfatools.js soap2gfa [options] <soapdenovo.prefix>\n");
		print("Options: -S      don't show sequences");
		print("         -T      preserve twin edges");
		print("");
		exit(1);
	}

	var buf = new Bytes();
	var pre = args[getopt.ind];
	var kmeri = null;

	var file = new File(pre + '.preGraphBasic');
	file.readline(buf);
	var t = buf.toString().split(/\s+/);
	kmer = parseInt(t[3]);
	file.close();

	var ctg = new Fastx(new File(pre + '.contig'));
	while (ctg.read() >= 0) {
		if (!no_seq) print('S', ctg.n, ctg.s);
		else print('S', ctg.n, '*', 'LN:i:'+ctg.s.length);
	}
	ctg.destroy();

	file = new File(pre + '.Arc');
	while (file.readline(buf) >= 0) {
		var t = buf.toString().split(" ");
		var u = parseInt(t[0]);
		var ori = (u&1)? '+' : '-';
		if (!(u&1)) --u;
		for (var i = 1; i < t.length; i += 2) {
			var v = parseInt(t[i]);
			if (!keep_twin && u>>1 > (v-1)>>1) continue;
			if (v&1) print('L', u, ori, v, '+', kmer + 'M', 'RC:i:'+t[i+1]);
			else print('L', u, ori, v-1, '-', kmer + 'M', 'RC:i:'+t[i+1]);
		}
	}
	file.close();

	buf.destroy();
}

/***************
 * ASQG -> GFA *
 ***************/

function gfa_sga2gfa(args)
{
	var c, no_seq = false;
	while ((c = getopt(args, "S")) != null)
		if (c == 'S') no_seq = true;

	if (args.length == getopt.ind) {
		print("");
		print("Usage:   k8 gfatools.js sga2gfa [options] <sga.asqg>\n");
		print("Options: -S      don't show sequences");
		print("");
		exit(1);
	}

	var file = args[getopt.ind] == '-'? new File() : new File(args[getopt.ind]);
	var buf = new Bytes();

	while (file.readline(buf) >= 0) {
		var t = buf.toString().split(/\s+/);
		if (t[0] == "VT") {
			if (!no_seq) print('S', t[1], t[2]);
			else print('S', t[1], '*', 'LN:i:'+t[2].length);
		} else if (t[0] == "ED") {
			var l1, l2;
			for (var i = 3; i < t.length; ++i) t[i] = parseInt(t[i]);
			l1 = t[4] - t[3] + 1; l2 = t[7] - t[6] + 1;
			if (l1 != l2) throw Error("sga2gfa does NOT work with gapped overlaps");
			var o1, o2;
			if (t[3] == 0) o1 = '-';
			else if (t[4] + 1 == t[5]) o1 = '+';
			else throw Error("sga2gfa does NOT work with clipping");
			if (t[6] == 0) o2 = '+';
			else if (t[7] + 1 == t[8]) o2 = '-';
			else throw Error("sga2gfa does NOT work with clipping");
			print('L', t[1], o1, t[2], o2, l1+'M');
		}
	}

	buf.destroy();
	file.close();
}

/****************
 * ABySS -> GFA *
 ****************/

function gfa_abyss2gfa(args)
{
	var c, no_seq = false, keep_twin = false;
	while ((c = getopt(args, "ST")) != null)
		if (c == 'S') no_seq = true;
		else if (c == 'T') keep_twin = true;

	if (args.length == getopt.ind) {
		print("");
		print("Usage:   k8 gfatools.js abyss2gfa [options] <abyss.prefix>\n");
		print("Options: -S      don't show sequences");
		print("         -T      preserve twin edges");
		print("");
		exit(1);
	}

	var pre = args[getopt.ind]
	if (!no_seq) {
		var ctg = new Fastx(new File(pre + '.fa'));
		while (ctg.read() >= 0)
			print('S', ctg.n, ctg.s);
		ctg.destroy();
	}

	file = new File(pre + ".dot");
	var buf = new Bytes();

	var def_d = null;
	while (file.readline(buf) >= 0) {
		var line = buf.toString();
		var m;
		if ((m = /"(\d+)([+-])"\s*->\s*"(\d+)([+-])"(\s+\[d=(-?\d+)\])?/.exec(line)) != null) {
			var d = m[4] != null? parseInt(m[6]) : def_d;
			var cigar = d <= 0? (-d)+'M' : d+'N';
			if (!keep_twin && parseInt(m[1]) > parseInt(m[3])) continue;
			print('L', m[1], m[2], m[3], m[4], cigar)
		} else if (no_seq && (m = /"(\d+)\+"\s*\[l=(\d+) C=(\d+)\]/.exec(line)) != null) {
			print('S', m[1], '*', 'LN:i:'+m[2]);
		} else if ((m = /edge\s*\[d=(-?\d+)\]/.exec(line)) != null) {
			def_d = parseInt(m[1]);
		}
	}

	buf.destroy();
	file.close();
}

/*****************
 * Main function *
 *****************/

function main(args)
{
	if (args.length == 0) {
		print("\nUsage:    k8 gfatools.js <command> [arguments]\n");
		print("Commands: gfa2dot       convert GFA to graphviz's DOT");
		print("          velvet2gfa    convert Velvet's LastGraph to GFA");
		print("          spades2gfa    convert SPAdes's FASTG (version <=3.1.1) to GFA");
		print("          sga2gfa       convert SGA's ASQG to GFA");
		print("          soap2gfa      convert SOAPdenovo graph to GFA");
		print("          abyss2gfa     convert ABySS' DOT to GFA");
		print("");
		exit(1);
	}

	var cmd = args.shift();
	if (cmd == 'gfa2dot') gfa_gfa2dot(args);
	else if (cmd == 'velvet2gfa') gfa_velvet2gfa(args);
	else if (cmd == 'spades2gfa') gfa_spades2gfa(args);
	else if (cmd == 'sga2gfa') gfa_sga2gfa(args);
	else if (cmd == 'soap2gfa') gfa_soap2gfa(args);
	else if (cmd == 'abyss2gfa') gfa_abyss2gfa(args);
	else warn("Unrecognized command");
}

main(arguments);