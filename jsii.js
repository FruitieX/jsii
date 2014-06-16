#!/usr/bin/env node
var clc = require('cli-color');
var maxNickLen = 12;
var fileBuf = 4096; // how many characters of file to remember
var path = require('path');
var myNick = "FruitieX";
var hilight_re = new RegExp(".*" + myNick + ".*", 'i');
var ansi_escape_re = /\x1b[^m]*m/;
var readline = require('readline');

var rlv = require('readline-vim');
var repl = require('repl');

var separatorColor = clc.xterm(239);
var numColor = clc.xterm(232).bgXterm(255);
var chanColor = clc.xterm(255).bgXterm(239);
var myNickColor = 1;
var hilightColor = 3;

// TODO: remove event listeners from these when switching chans
var out, rl, vim;
var openChan = function(filePath) {
	var outFile = filePath + '/out';
	var inFile = filePath + '/in';
	var file = require('fs').readFileSync(outFile, 'utf8');

	var bn = path.basename(filePath);
	var num_s = bn.substring(0, bn.indexOf('_'));
	var num = "";
	if(num_s !== "") {
		num_s = ' ' + num_s + ' ';
		num = numColor(num_s);
	}
	var chan_s = ' ' + bn.substring(bn.indexOf('_') + 1, bn.length) + ' ';
	var chan = chanColor(chan_s);

	var printLine = function(line) {
		var hilight = false;

		// clear channel name
		process.stdout.write('\r' + Array(num_s.length + chan_s.length + 1).join(' ') + '\r');
		//process.stdout.write('\033[<' + (process.stdout.rows - 1) + '>;<0>H');

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
		line = line.join(' ');
		line = line.replace(ansi_escape_re, '');

		// 'fix' encoding of people not using utf-8...
		line = line.replace(/�/g, 'å');
		line = line.replace(/�/g, 'ä');
		line = line.replace(/�/g, 'ö');

		if(line.match(hilight_re))
			hilight = true;

		var textColor = 15;
		if (nick === myNick)
			textColor = myNickColor;
		else if (hilight)
			textColor = hilightColor;

		// separator takes up 1 char + whitespace
		var availWidth = process.stdout.columns - maxNickLen - 2;

		var wrappedChars = 0;
		var i = 0;

		// terminal too small? don't print anything
		if(availWidth <= 5)
			return;

		while(i * availWidth - wrappedChars < line.length) {
			var start = i * availWidth - wrappedChars;
			var curLine = line.substr(start, availWidth);
			// remove leading space on next line
			curLine.replace(/^\s+/, '');
			// line wrap at word boundary only if there is whitespace on this line
			if(start + availWidth < line.length && curLine.lastIndexOf(' ') !== -1) {
				curLine = curLine.slice(0, curLine.lastIndexOf(' '));
				// remove whitespace
				wrappedChars--;
			}

			wrappedChars += availWidth - curLine.length;

			// empty space on line wrap
			if (i > 0)
				process.stdout.write(Array(process.stdout.columns - availWidth + 1).join(' '));

			process.stdout.write(clc.xterm(textColor)(curLine));
			process.stdout.write('\n');
			i++;
		}

		// restore prompt
		process.stdout.write(num + chan + ' ');
	};

	// log entire file
	var redraw = function(file) {
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

	// 'ctrl-c' = quitting
	process.stdin.on('data', function(key) {
		if(key == '\u0003') process.exit();
	});

	// clear terminal and print
	process.stdout.write('\u001B[2J\u001B[0;0f');
	// move cursor to last line
	redraw(file);

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
		redraw(file);
	});

	var promptLength = num_s.length + chan_s.length + 1;

	r = repl.start({
		prompt: num_s + chan_s + ' ',
		input: process.stdin,
		output: process.stdout,
		eval: function(cmd, context, filename, callback) {
			console.log(cmd);
			redraw(file);
		}
	});

	vim = rlv(r.rli, function() {
		// prompt printing function
		process.stdout.write('\033[s');
		process.stdout.write('\r');
		var inputLength = num_s.length + chan_s.length + r.rli.line.length + 1;
		if(inputLength + 1 > process.stdout.columns)
			process.stdout.write('\033[' + Math.floor(inputLength / process.stdout.columns) + 'A');
		process.stdout.write(num + chan + ' ');
		process.stdout.write('\033[u');
	});
	vim.threshold = 500;
	var map = vim.map;
	map.insert('jj', 'esc');

	vim.events.on('normal', function() {
		// store cursor position
		process.stdout.write('\033[s');
		redraw(file);
		process.stdout.write(r.rli.line);
		// restore cursor position
		process.stdout.write('\033[u');
	});
	vim.events.on('insert', function() {
		// store cursor position
		process.stdout.write('\033[s');
		redraw(file);
		process.stdout.write(r.rli.line);
		// restore cursor position
		process.stdout.write('\033[u');
	});

	// hack to print the custom prompt on top of the node readline one at startup
	process.stdout.write('\033[s'); // store cursor position
	process.stdout.write('\r'); // carriage return
	process.stdout.write(num + chan + ' ');
	process.stdout.write('\033[u'); // restore cursor position
};

//rlv.on('line', function(cmd) {
	//console.log(cmd);
//});

// TODO: changing channels?
var currentChan = process.argv[2];
openChan(process.argv[2]);
