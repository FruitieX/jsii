#!/usr/bin/env node
var clc = require('cli-color');
var maxNickLen = 12;
var fileBufSize = 8192; // how many characters of file to remember
var path = require('path');
var myNick = "FruitieX";
var hilight_re = new RegExp(".*" + myNick + ".*", 'i');
var url_re = /(^|\s)((https?:\/\/)[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi;
var url_ignore_nicks = [ 'BoWa' ];
var ansi_escape_re = /\x1b[^m]*m/;
var fs = require('fs');
var spawn = require('child_process').spawn;

var vimrl = require('vimrl');

var separatorColor = clc.xterm(239);
var chanColor = clc.xterm(242);
var chanInsertColor = clc.xterm(252);
var myNickColor = 1;
var hilightColor = 3;
var actionColor = 10;

var filePath = process.argv[2];
var out, rli, vim;
var completions = [];

var outFileName = filePath + '/out';
var inFileName = filePath + '/in';
var outFile = fs.openSync(outFileName, 'r+');
var inFile = fs.openSync(inFileName, 'a');

var outFileStat = fs.statSync(outFileName);

var file = new Buffer(fileBufSize);
var bytesRead = fs.readSync(outFile, file, 0, fileBufSize, outFileStat.size - fileBufSize);
file = file.toString('utf8', 0, bytesRead);

var basename = path.basename(filePath);
var num_s = basename.substring(0, basename.indexOf('_'));
var num = "";
if(num_s !== "") {
    num = num_s;
}

var chan_s = basename.substring(basename.indexOf('_') + 1, basename.length);
var chan_shortened;
if(chan_s.charAt(0) === '!')
    chan_shortened = ' !' + chan_s.substring(6, chan_s.length);
else
    chan_shortened = ' ' + chan_s;
var chan = chanColor(chan_shortened);
var chan_insert = chanInsertColor(chan_shortened);

var prompt_s = num_s + chan_shortened;
var prompt_s_len = prompt_s.length + 3;
prompt_s += chanColor(' > ');

var prompt_s_ins = num_s + chan_shortened;
var prompt_s_ins_len = prompt_s_ins.length + 3;
prompt_s_ins += chanInsertColor(' > ');

var cursorReset = function() {
    process.stdout.write('\033[' + process.stdout.rows + ';0f');
};
var clearLine = function() {
    process.stdout.write('\033[K');
};

// prints line from lower left corner
var printLine = function(line) {
    // move cursor to lower left
    cursorReset();
    // clear current line
    clearLine();

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

    var clrnick = 0;
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

    // get rid of tabs in irc messages
    line = line.replace(/\t/g, '    ');

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

    var start = 0;
    while (start < file.length) {
        var end = file.indexOf('\n', start);
        if(end === -1)
            break;

        printLine(file.substring(start, end));
        start = end + 1;
    }

    readline.redraw();
};

// limit file to size fileBufSize
if(file.length >= fileBufSize) {
    file = file.substr(file.length - fileBufSize, file.length);
    file = file.substr(file.indexOf("\n") + 1, file.length);
}

process.stdin.setRawMode(true);

// handle keyboard events
process.stdin.on('readable', function() {
    var input = process.stdin.read();
    if(input) {
        // 'ctrl-c' = quit
        if(input == '\u0003') process.exit(0);

        var keyHex = input.toString('hex');

        // previous channel (alt + h)
        if(keyHex === '1b68') process.exit(10);
        // next channel (alt + l)
        else if(keyHex === '1b6c') process.exit(11);
        // jump to this channel (alt + 1-9)
        else if(keyHex.substring(0, 3) === '1b3' &&
            keyHex.substring(3) !== '0') process.exit(keyHex.substring(3));
        else
            readline.handleInput(input);

        // DEBUG: uncomment this line to find the keycodes
        //console.log(key.toString('hex'));
    }
});

/*
// nickname completion from nicknames in file buffer
// TODO: get nicks from irc server?
completer: function(line) {
}
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
*/

// watch file for changes
Tail = require('tail').Tail;
out = new Tail(outFileName);
out.on('line', function(data) {
    file += data + '\n';
    // limit file to size fileBufSize
    if(file.length >= fileBufSize) {
        file = file.substr(file.length - fileBufSize, file.length);
        file = file.substr(file.indexOf("\n") + 1, file.length);
    }

    printLine(data);
    readline.redraw();
});

// handle terminal resize
process.stdout.on('resize', function() {
    process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
    redraw();
});

// parse some select commands from input line
readline = vimrl({
    normalPrompt: prompt_s,
    normalPromptLen: prompt_s_len,
    insertPrompt: prompt_s_ins,
    insertPromptLen: prompt_s_ins_len
}, function(line) {
    redraw();

    if(line === '/bl' || line.substring(0, 4) === '/bl ') { // request backlog
        line = "/privmsg *backlog " + chan_s + ' ' + line.substring(4);
    } else if(line.substring(0, 4) === '/me ') { // irc ACTION message
        line = "\001ACTION " + line.substring(4);
    } else if(line === '/names') { // request nick list
        line = "/names " + chan_s;
    } else if (line === '/ul') { // list urls in buffer
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
                    printLine("xxxx-xx-xx xx:xx <***> URL " + current +  ": " + url);
                    readline.redraw();
                    current++;
                }
            }
        }

        return;
    } else if (line === '/u' || line.substring(0, 3) === '/u ') { // open url
        var skip = parseInt(line.substring(3)) | 0;
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
            printLine("xxxx-xx-xx xx:xx <***> URL " + (parseInt(line.substring(3)) | 0) +  " opened: " + url);
            readline.redraw();
        } else {
            printLine("xxxx-xx-xx xx:xx <***> No URL found");
            readline.redraw();
        }

        return;
    }

    // send input line to ii
    var msg = new Buffer(line + '\n', 'utf8');
    fs.writeSync(inFile, msg, 0, msg.length, null);
});

readline.gotoInsertMode();

// clear terminal and print file contents at launch
process.stdout.write('\u001B[2J\u001B[0;0f');
redraw();
