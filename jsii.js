#!/usr/bin/env node
var clc = require('cli-color');
var maxNickLen = 12;
var fileBuf = 8192; // how many characters of file to remember
var path = require('path');
var myNick = "FruitieX";
var hilight_re = new RegExp(".*" + myNick + ".*", 'i');
var url_re = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;
var url_ignore_nicks = [ 'BoWa' ];
var ansi_escape_re = /\x1b[^m]*m/;
var readline = require('readline');
var fs = require('fs');
var spawn = require('child_process').spawn;

var rlv = require('readline-vim');

var separatorColor = clc.xterm(239);
var numColor = clc.xterm(232).bgXterm(255);
var chanColor = clc.xterm(255).bgXterm(239);
var chanInsertColor = clc.xterm(232).bgXterm(255);
var myNickColor = 1;
var hilightColor = 3;
var actionColor = 10;

var openChan = function(filePath) {
	var out, rli, vim;
	var completions = [];

	var outFileName = filePath + '/out';
	var inFileName = filePath + '/in';
	var file = fs.readFileSync(outFileName, 'utf8');
	var inFile = fs.openSync(inFileName, 'a');

	var basename = path.basename(filePath);
	var num_s = basename.substring(0, basename.indexOf('_'));
	var num = "";
	if(num_s !== "") {
		num_s = ' ' + num_s + ' ';
		num = numColor(num_s);
	}
	var chan_s = basename.substring(basename.indexOf('_') + 1, basename.length);
	var chan_shortened;
	if(chan_s.charAt(0) === '!')
		chan_shortened = ' !' + chan_s.substring(6, chan_s.length) + ' ';
	else
		chan_shortened = ' ' + chan_s + ' ';
	var chan = chanColor(chan_shortened);
	var chan_insert = chanInsertColor(chan_shortened);

	// prompt printing function, assumes cursor is inside the prompt where node
	// readline expects it to be. cursor position is restored after printing the
	// prompt unless cursorAfterPrompt is given, then it's put after the input line
	var printPrompt = function(cursorAfterPrompt) {
		if(!cursorAfterPrompt)
			process.stdout.write('\033[s'); // store cursor position

		process.stdout.write('\r'); // move cursor to beginning of line

		// for multiline inputs move cursor up to prompt before printing
		var inputLength = num_s.length + chan_shortened.length + rli.cursor + 1;
		if(inputLength + 1 > process.stdout.columns)
			process.stdout.write('\033[' + Math.floor(inputLength / process.stdout.columns) + 'A');

		if(vim.isnormal)
			process.stdout.write(num + chan + ' ');
		else
			process.stdout.write(num + chan_insert + ' ');
		process.stdout.write(rli.line);

		if(!cursorAfterPrompt)
			process.stdout.write('\033[u'); // restore cursor position
	};

	var clearPrompt = function() {
		// move cursor to beginning of prompt first
		var inputLength = num_s.length + chan_shortened.length + rli.line.length;
		process.stdout.write('\033[' + Math.floor(process.stdout.rows - inputLength / process.stdout.columns + 1) + ';0H');
		// clear channel name + prompt
		process.stdout.write(Array(num_s.length + chan_shortened.length + 1 + rli.line.length + 1).join(' '));
	};

	// prints line at current terminal cursor position
	var printLine = function(line) {
		var hilight = false;
		var action = false;

		// remove timestamps
		line = line.replace(/^([^ ]+ ){2}/, '');
		line = line.split(' ');
		// remove <> around nick
		var nick = line[0].substring(1, line[0].length - 1);

		if(completions.indexOf(nick) === -1) {
			completions.push(nick);
		}

		// remove nick from line array, now contains space separated text message
		line.shift();
		line = line.join(' ');

		// support irc ACTION messages
		if(line.substring(0, 8) === "\001ACTION ") {
			line = nick + ' ' + line.substring(8);
			nick = '*';
			clrnick = actionColor;
			action = true;
		}
		else if(nick === myNick) {
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
		// align nicks and print
		process.stdout.write(Array(maxNickLen - nick.length + 1).join(' '));
		process.stdout.write(clc.xterm(clrnick)(nick) + separatorColor(':'));
		process.stdout.write(' ');

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
		else if (action)
			textColor = actionColor;
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
	};

	// redraw screen
	var redraw = function() {
		process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
		var inputLength = num_s.length + chan_shortened.length + rli.line.length;
		process.stdout.write('\033[' + Math.floor(process.stdout.rows - inputLength / process.stdout.columns + 1) + ';0H');

		var start = 0;
		while (start < file.length) {
			var end = file.indexOf('\n', start);
			if(end === -1)
				break;

			printLine(file.substring(start, end));
			start = end + 1;
		}
		// make room for the prompt
		// TODO: why should this be rli.cursor
		var inputLength = num_s.length + chan_shortened.length + 1 + rli.cursor;
		for(var i = 0; i < Math.floor(inputLength / process.stdout.columns); i++) {
			process.stdout.write('\n');
		}
	};

	// limit file to size fileBuf
	if(file.length >= fileBuf) {
		file = file.substr(file.length - fileBuf, file.length);
		file = file.substr(file.indexOf("\n") + 1, file.length);
	}

	// handle keyboard events
	process.stdin.on('data', function(key) {
		// 'ctrl-c' = quit
		if(key == '\u0003') process.exit(0);
	});
	process.stdin.on('data', function(key) {
		var keyHex = key.toString('hex');

		// previous channel (alt + h)
		if(keyHex === '1b68') process.exit(10);
		// next channel (alt + l)
		else if(keyHex === '1b6c') process.exit(11);
		// jump to this channel (alt + 1-9)
		else if(keyHex.substring(0, 3) === '1b3' &&
			keyHex.substring(3) !== '0') process.exit(keyHex.substring(3));

		// DEBUG: uncomment this line to find the keycodes
		//console.log(key.toString('hex'));
	});

	var rli = readline.createInterface({
		input: process.stdin,
		output: process.stdout,

		// nickname completion from nicknames in file buffer
		// TODO: get nicks from irc server?
		completer: function(line) {
			var word = line.substring(line.lastIndexOf(" ") + 1);
			var hits = completions.filter(function(c) { return c.indexOf(word) == 0 })
			for(var i = hits.length - 1; i >= 0; i--) {
				if(hits[i] === '!' || hits[i] === '***') { // skip status/info nicknames
					hits.splice(i, 1);
				} else if (word === line) { // typing at beginning of line? append colon
					hits[i] += ': ';
				} else { // else append comma
					hits[i] += ', ';
				}
			}
			return [hits, word]
		}
	});

	// clear prompt, print line above prompt, print prompt again and return cursor
	// to correct position within prompt
	var printLine_restorePrompt = function(line) {
		process.stdout.write('\033[s'); // store cursor position

		// clear prompt, then move cursor to beginning of prompt
		clearPrompt();
		var inputLength = num_s.length + chan_shortened.length + rli.line.length;
		process.stdout.write('\033[' + Math.floor(process.stdout.rows - inputLength / process.stdout.columns + 1) + ';0H');

		// print line
		printLine(line);

		// make room for prompt
		// TODO: WHY should we use rli.cursor not rli.line.length here?
		// otherwise we get too many newlines when cursor is positioned on an input
		// line != the last one. IDGI. :(
		inputLength = num_s.length + chan_shortened.length + rli.cursor;
		for(var i = 0; i < Math.floor(inputLength / process.stdout.columns); i++) {
			process.stdout.write('\n');
		}

		printPrompt(true); // print prompt again, but let us handle cursor restoring
		process.stdout.write('\033[u'); // restore cursor position
	};

	// watch file for changes
	Tail = require('tail').Tail;
	out = new Tail(outFileName);
	out.on('line', function(data) {
		file += data + '\n';
		// limit file to size fileBuf
		if(file.length >= fileBuf) {
			file = file.substr(file.length - fileBuf, file.length);
			file = file.substr(file.indexOf("\n") + 1, file.length);
		}

		printLine_restorePrompt(data);
	});

	// handle terminal resize
	process.stdout.on('resize', function() {
		var cursorPos = rli.cursor;
		process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
		redraw();

		// hack: print our prompt after node readline prints its prompt ;)
		setTimeout(function() {
			printPrompt(true);
			var inputLength = num_s.length + chan_shortened.length + 1 + rli.line.length;
			// move cursor to beginning of first prompt line
			process.stdout.write('\033[' + Math.floor(process.stdout.rows - inputLength / process.stdout.columns + 1) + ';0H');

			// move cursor back to where it was:
			// down
			if((num_s.length + chan_shortened.length + 1 + cursorPos) >= process.stdout.columns)
				process.stdout.write('\033[' + Math.floor((num_s.length + chan_shortened.length + 1 + cursorPos) / process.stdout.columns) + 'B');
			// right
			if((num_s.length + chan_shortened.length + 1 + cursorPos) % process.stdout.columns)
				process.stdout.write('\033[' + (num_s.length + chan_shortened.length + 1 + cursorPos) % process.stdout.columns + 'C');
		});
	});

	// parse some select commands from input line
	rli.setPrompt(num_s + chan_shortened + ' ');
	rli.on('line', function(cmd) {
		redraw();
		printPrompt(true);

		var msg_s = cmd;
		if(msg_s === '/bl' || msg_s.substring(0, 4) === '/bl ') { // request backlog
			msg_s = "/privmsg *backlog " + chan_s + msg_s.substring(4);
		} else if(msg_s.substring(0, 4) === '/me ') { // irc ACTION message
			msg_s = "\001ACTION " + msg_s.substring(4);
		} else if(msg_s === '/names') { // request nick list
			msg_s = "/names " + chan_s;
		} else if (msg_s === '/ul') { // list urls in buffer
			var current = 0;
			var splitFile = file.split('\n');

			var url;
			for (var i = splitFile.length - 1; i >= 0; i--) {
				// TODO: put this mess into a function
				// remove timestamps
				splitFile[i] = splitFile[i].replace(/^([^ ]+ ){2}/, '');
				var words = splitFile[i].split(' ');
				// nick is first whitespace separated word after timestamp
				var nick = words[0].substring(1, words[0].length - 1);
				// ignore select bots
				if(url_ignore_nicks.indexOf(nick) !== -1)
					continue;

				for (var j = words.length - 1; j >= 0; j--) {
					var res = url_re.exec(words[j]);
					if(res) {
						url = res[0];
						printLine_restorePrompt("xxxx-xx-xx xx:xx <***> URL " + current +  ": " + url);
						current++;
					}
				}
			}

			return;
		} else if (msg_s === '/u' || msg_s.substring(0, 3) === '/u ') { // open url
			var skip = parseInt(msg_s.substring(3)) | 0;
			var splitFile = file.split('\n');

			var url;
			for (var i = splitFile.length - 1; i >= 0; i--) {
				// TODO: put this mess into a function
				// remove timestamps
				splitFile[i] = splitFile[i].replace(/^([^ ]+ ){2}/, '');
				var words = splitFile[i].split(' ');
				// nick is first whitespace separated word after timestamp
				var nick = words[0].substring(1, words[0].length - 1);
				// ignore select bots
				if(url_ignore_nicks.indexOf(nick) !== -1)
					continue;

				for (var j = words.length - 1; j >= 0; j--) {
					var res = url_re.exec(words[j]);
					if(res) {
						if(skip > 0) {
							skip--;
							continue;
						}
						url = res[0];
						break;
					}
				}

				if(url)
					break;
			}

			if(url) {
				var child = spawn('chromium', [url], {
					detached: true,
					stdio: [ 'ignore', 'ignore' , 'ignore' ]
				});
				child.unref();
				printLine_restorePrompt("xxxx-xx-xx xx:xx <***> URL " + (parseInt(msg_s.substring(3)) | 0) +  " opened: " + url);
			} else {
				printLine_restorePrompt("xxxx-xx-xx xx:xx <***> No URL found");
			}

			return;
		}

		// send input line to ii
		var msg = new Buffer(msg_s + '\n', 'utf8');
		fs.writeSync(inFile, msg, 0, msg.length, null);
	});

	// vim like keybindings
	vim = rlv(rli, function() {
		// callback function prints our prompt whenever readline handles input
		printPrompt();
	});

	// custom keymap
	var map = vim.map;
	// typing 'jj' quickly toggles to normal mode
	map.insert('jj', 'esc');
	// 500 ms delay allowed between j keypresses
	vim.threshold = 500;

	// clear terminal and print file contents at launch
	process.stdout.write('\u001B[2J\u001B[0;0f');
	redraw();
	printPrompt(true);

	// start in insert mode
	vim.forceInsert();
};

openChan(process.argv[2]);
