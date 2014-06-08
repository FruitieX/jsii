var clc = require('cli-color');
var maxNickLen = 12;
var fileBuf = 4096; // how many characters of file to remember
var path = require('path');
var myNick = "FruitieX";
var hilight_re = new RegExp(".*" + myNick + ".*", 'i');
var ansi_escape_re = /\x1b[^m]*m/;

var separatorColor = clc.xterm(239);
var numColor = clc.xterm(232).bgXterm(255);
var chanColor = clc.xterm(255).bgXterm(239);
var myNickColor = 1;
var hilightColor = 3;

// we need this in global scope so we can remove the event listeners!
var out;
var openChan = function(filePath) {
	var outFile = filePath + '/out';
	var inFile = filePath + '/in';
	var file = require('fs').readFileSync(outFile, 'utf8');

	var bn = path.basename(filePath);
	var num_s = ' ' + bn.substring(0, bn.indexOf('_')) + ' ';
	var num = numColor(num_s);
	var chan_s = ' ' + bn.substring(bn.indexOf('_') + 1, bn.length) + ' ';
	var chan = chanColor(chan_s);

	var printLine = function(line) {
		var hilight = false;

		// clear channel name
		process.stdout.write('\r' + Array(num_s.length + chan_s.length + 1).join(' ') + '\r');

		// remove timestamps
		line = line.replace(/^([^ ]+ ){2}/, '');
		line = line.split(' ');
		// remove <> around nick
		var nick = line[0].substring(1, line[0].length - 1);

		if(nick === myNick) {
			clrnick = myNickColor;
		} else {
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
		}

		// limit nicklen
		nick = nick.substr(0, maxNickLen);
		// align nicks
		process.stdout.write(Array(maxNickLen - nick.length + 1).join(' '));
		process.stdout.write(clc.xterm(clrnick)(nick) + separatorColor(':'));
		process.stdout.write(' ');

		// remove nick from line array, now contains space separated text message
		line.shift();

		for (var i = 0; i < line.length; i++) {
			if(line[i].match(hilight_re))
				hilight = true;
		}

		var textColor = 15;
		if (nick === myNick)
			textColor = myNickColor;
		else if (hilight)
			textColor = hilightColor;

		// TODO: wrap at whitespace
		for (var i = 0; i < line.length; i++) {
			line[i] = line[i].replace(ansi_escape_re, '');
			process.stdout.write(clc.xterm(textColor)(line[i]));
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

	// limit file to size fileBuf
	if(file.length >= fileBuf) {
		file = file.substr(file.length - fileBuf, file.length);
		file = file.substr(file.indexOf("\n") + 1, file.length);
	}

	// set raw mode
	var stdin = process.stdin;
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding('utf8');

	// handle 'q', 'ctrl-c' by quitting
	stdin.on('data', function(key) {
		if(key == 'q' || key == '\u0003') process.exit();
	});

	// clear terminal and print
	process.stdout.write('\u001B[2J\u001B[0;0f');
	printFile(file);

	// watch file
	Tail = require('tail').Tail;
	out = new Tail(outFile);

	out.on('line', function(data) {
		file += data + '\n';
		// limit file to size fileBuf
		if(file.length >= fileBuf) {
			file = file.substr(file.length - fileBuf, file.length);
			file = file.substr(file.indexOf("\n") + 1, file.length);
		}

		// print the line
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
