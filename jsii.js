var clc = require('cli-color');
var file = require('fs').readFileSync(process.argv[2], 'utf8');

var printLine = function(line) {
	var num_s = ' 42 ';
	var num = clc.xterm(232).bgXterm(255)(num_s);
	var chan_s = ' trololo ';
	var chan = clc.xterm(255).bgXterm(239)(chan_s);
	// clear channel name
	process.stdout.write('\r' + Array(num_s.length + chan_s.length + 1).join(' ') + '\r');

	// remove timestamps
	line = line.split(' ');
	// remove <> around nick
	var nick = line[2].substring(1, line[2].length - 1);

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
	console.log(clc.xterm(clrnick)(nick));

	var text = line[3];
	console.log(text);

	// print channel name again
	process.stdout.write(num + chan);
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

printFile(file);

// watch file
Tail = require('tail').Tail;
var out = new Tail(process.argv[2]);

out.on('line', function(data) {
	file += data;
	printLine(data);
});

process.stdout.on('resize', function() {
	printFile(file);
});
