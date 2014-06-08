var clc = require('cli-color');
var maxNickLen = 12;
var path = require('path');

// we need this in global scope so we can remove the event listeners!
var out;
var openChan = function(filePath) {
	var outFile = filePath + '/out';
	var inFile = filePath + '/in';
	var file = require('fs').readFileSync(outFile, 'utf8');

	var bn = path.basename(filePath);
	var num_s = ' ' + bn.substring(0, bn.indexOf('_')) + ' ';
	var num = clc.xterm(232).bgXterm(255)(num_s);
	var chan_s = ' ' + bn.substring(bn.indexOf('_') + 1, bn.length) + ' ';
	var chan = clc.xterm(255).bgXterm(239)(chan_s);
	var bar = clc.xterm(239)('│');

	var printLine = function(line) {
		// clear channel name
		process.stdout.write('\r' + Array(num_s.length + chan_s.length + 1).join(' ') + '\r');

		// remove timestamps
		line = line.replace(/^([^ ]+ ){2}/, '');
		line = line.split(' ');
		// remove <> around nick
		var nick = line[0].substring(1, line[0].length - 1);

		// nick color, avoids dark colors
		var clrnick = 0;
		for(var i = 0; i < nick.length; i++) {
			clrnick += nick.charCodeAt(i);
		}
		clrnick = Math.pow(clrnick, 2) + clrnick * 2;
		clrnick = clrnick % 255;
		switch(clrnick) {
			case 18: case 22: case 23: case 24:
				clrnick += 3; break;
			case 52: case 53: case 54: case 55: case 56: case 57: case 88: case 89:
				clrnick += 6; break;
			case 232: case 233: case 234: case 235: case 236: case 237: case 238: case 239:
				clrnick += 8; break;
			case 0: case 8: case 19: case 22:
				clrnick++; break;
		}
		// limit nicklen
		nick = nick.substr(0, maxNickLen);
		// align nicks
		process.stdout.write(Array(maxNickLen - nick.length + 1).join(' '));
		process.stdout.write(clc.xterm(clrnick)(nick));
		process.stdout.write(' ');
		process.stdout.write(bar);
		process.stdout.write(' ');

		// remove nick from line array, now contains space separated text message
		line.shift();

		// TODO: wrap at whitespace
		for (var i = 0; i < line.length; i++) {
			process.stdout.write(line[i]);
			if(i != line.length - 1)
				process.stdout.write(' ');
		}
		process.stdout.write('\n');

		// print channel name again
		process.stdout.write(num + chan + ' ');
	};

	// log entire file
	var printFile = function(file) {
		var start = 0;
		while (start < file.length) {
			var end = file.indexOf('\n', start);
			if(end === -1)
				break;
			printLine(file.substring(start, end));
			start = end + 1;
		}
	};

	process.stdout.write('\u001B[2J\u001B[0;0f');
	printFile(file);

	// watch file
	Tail = require('tail').Tail;
	out = new Tail(outFile);

	out.on('line', function(data) {
		file += data + '\n';
		printLine(data);
	});

	process.stdout.on('resize', function() {
		process.stdout.write('\u001B[2J\u001B[0;0f');
		printFile(file);
	});
};

// TODO: changing channels?
var currentChan = process.argv[2];
openChan(process.argv[2]);
