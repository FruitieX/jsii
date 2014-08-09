#!/usr/bin/env node
var fs = require('fs');
var spawn = require('child_process').spawn;
var vimrl = require('vimrl');
var path = require('path');

// argv[2] must contain path to out / in files
if(!process.argv[2]) {
    console.log("ERROR: please provide a valid path!");
    process.exit(0);
}
var config = require('./config')(process.argv[2]);

var out, rli, vim;
var completions = [];

var outFile = fs.openSync(config.outFileName, 'r+');
var inFile = fs.openSync(config.inFileName, 'a');
var outFileStat = fs.statSync(config.outFileName);

var backlog = new Buffer(config.fileBufSize);
var bytesRead = fs.readSync(outFile, backlog, 0, config.fileBufSize, outFileStat.size - config.fileBufSize);
backlog = backlog.toString('utf8', 0, bytesRead);

// reset cursor to lower left corner
var cursorReset = function() {
    process.stdout.write('\033[' + process.stdout.rows + ';0f');
};
// clear line where cursor currently is
var clearLine = function() {
    process.stdout.write('\033[K');
};

// prints line from lower left corner
var printLine = function(line) {
    var i;

    var hilight = false;
    var action = false;

    // move cursor to lower left
    cursorReset();
    // clear current line
    clearLine();

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
        clrnick = config.actionColor;
        action = true;
    }
    else if(nick === config.myNick) {
        clrnick = config.myNickColor;
    } else {
        // nick color, avoids dark colors
        for(i = 0; i < nick.length; i++) {
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
    nick = nick.substr(0, config.maxNickLen);
    // align nicks and print
    process.stdout.write(Array(config.maxNickLen - nick.length + 1).join(' '));
    process.stdout.write('\033[38;5;' + clrnick + 'm' + nick + // set nick color + nick
                         '\033[38;5;' + config.separatorColor + ':' + // set separator color + separator
                         '\033[000m'); // reset colors
    process.stdout.write(' ');

    for (i = 0; i < config.findAndReplace.length; i++) {
        line = line.replace(config.findAndReplace[i][0],
                            config.findAndReplace[i][1]);
    }

    if(line.match(config.hilight_re))
        hilight = true;

    var textColor = 15;
    if (nick === config.myNick)
        textColor = config.myNickColor;
    else if (action)
        textColor = config.actionColor;
    else if (hilight)
        textColor = config.hilightColor;

    // separator takes up 1 char + whitespace
    var availWidth = process.stdout.columns - config.maxNickLen - 2;

    var wrappedChars = 0;
    i = 0;

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

        process.stdout.write('\033[38;5;' + textColor + 'm' + curLine + // set text color + text
                             '\033[000m' + '\n'); // reset colors + newline
        i++;
    }
};

// redraw screen
var redraw = function() {
    process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal

    var start = 0;
    while (start < backlog.length) {
        var end = backlog.indexOf('\n', start);
        if(end === -1)
            break;

        printLine(backlog.substring(start, end));
        start = end + 1;
    }

    readline.redraw();
};

// limit file to size fileBufSize
if(backlog.length >= config.fileBufSize) {
    backlog = backlog.substr(backlog.length - config.fileBufSize, backlog.length);
    backlog = backlog.substr(backlog.indexOf("\n") + 1, backlog.length);
}

process.stdin.setRawMode(true);

// handle keyboard events
process.stdin.on('readable', function() {
    var input;
    while (null !== (input = process.stdin.read())) {
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
out = new Tail(config.outFileName);
out.on('line', function(data) {
    backlog += data + '\n';
    // limit file to size fileBufSize
    if(backlog.length >= config.fileBufSize) {
        backlog = backlog.substr(backlog.length - config.fileBufSize, backlog.length);
        backlog = backlog.substr(backlog.indexOf("\n") + 1, backlog.length);
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
    normalPrompt: config.normalPrompt,
    normalPromptColors: config.normalPromptColors,
    insertPrompt: config.insertPrompt,
    insertPromptColors: config.insertPromptColors
}, function(line) {
    redraw();

    if(line === '/bl' || line.substring(0, 4) === '/bl ') { // request backlog
        line = "/privmsg *backlog " + config.chanFullName + ' ' + line.substring(4);
    } else if(line.substring(0, 4) === '/me ') { // irc ACTION message
        line = "\001ACTION " + line.substring(4);
    } else if(line === '/names') { // request nick list
        line = "/names " + config.chanFullName;
    } else if (line === '/ul') { // list urls in buffer
        var current = 0;
        var splitFile = backlog.split('\n');

        var url;
        for (var i = splitFile.length - 1; i >= 0; i--) {
            // TODO: put this mess into a function
            // remove timestamps
            splitFile[i] = splitFile[i].replace(/^([^ ]+ ){2}/, '');
            var words = splitFile[i].split(' ');
            // nick is first whitespace separated word after timestamp
            var nick = words[0].substring(1, words[0].length - 1);
            // ignore select bots
            if(config.url_ignore_nicks.indexOf(nick) !== -1)
                continue;

            for (var j = words.length - 1; j >= 0; j--) {
                var res = config.url_re.exec(words[j]);
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
        var splitFile = backlog.split('\n');

        var url;
        for (var i = splitFile.length - 1; i >= 0; i--) {
            // TODO: put this mess into a function
            // remove timestamps
            splitFile[i] = splitFile[i].replace(/^([^ ]+ ){2}/, '');
            var words = splitFile[i].split(' ');
            // nick is first whitespace separated word after timestamp
            var nick = words[0].substring(1, words[0].length - 1);
            // ignore select bots
            if(config.url_ignore_nicks.indexOf(nick) !== -1)
                continue;

            for (var j = words.length - 1; j >= 0; j--) {
                var res = config.url_re.exec(words[j]);
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
