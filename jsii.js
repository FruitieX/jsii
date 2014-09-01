#!/usr/bin/env node
var spawn = require('child_process').spawn;
var vimrl = require('vimrl');
var net = require('net');

var config = require(process.env.HOME + "/.jsiiConfig.js");
var chanLongName = process.argv[2];
var server = process.argv[2].split(':')[0];
var chan = process.argv[2].split(':')[1];

var sendMsg = function(msg) {
    socket.write(JSON.stringify(msg) + '\n');
};

// reset cursor to lower left corner
var cursorReset = function() {
    process.stdout.write('\033[' + process.stdout.rows + ';0f');
};
// clear line where cursor currently is
var clearLine = function() {
    process.stdout.write('\033[K');
};

// prints line to lower left corner of terminal
var printLine = function(msg) {
    var i;

    var hilight = false;
    var action = false;

    // move cursor to lower left
    cursorReset();
    // clear current line
    clearLine();

    var nickColor = 0;
    // support irc ACTION messages
    if(msg.cmd === 'action') {
        line = nick + ' ' + line.substring(8);
        nick = '*';
        nickColor = config.actionColor;
        action = true;
    }
    if(msg.nick === config.myNick) {
        nickColor = config.myNickColor;
    } else if (msg.cmd === 'message') {
        // nick color, avoids dark colors
        for(i = 0; i < msg.nick.length; i++) {
            nickColor += msg.nick.charCodeAt(i);
        }
        nickColor = Math.pow(nickColor, 2) + nickColor * 2;
        nickColor = nickColor % 255;
        switch(nickColor) {
            case 18: case 22: case 23: case 24:
                nickColor += 3; break;
            case 52: case 53: case 54: case 55: case 56: case 57: case 88: case 89:
                nickColor += 6; break;
            case 232: case 233: case 234: case 235: case 236: case 237: case 238: case 239:
                nickColor += 8; break;
            case 0: case 8: case 19: case 22:
                nickColor++; break;
        }
    }

    // limit nicklen
    msg.nick = msg.nick.substr(0, config.maxNickLen);
    // align nicks and print
    process.stdout.write(Array(config.maxNickLen - msg.nick.length + 1).join(' '));
    process.stdout.write('\033[38;5;' + nickColor + 'm' + msg.nick + // set nick color + nick
                         '\033[38;5;' + config.separatorColor + 'm' + ':' + // set separator color + separator
                         '\033[000m'); // reset colors
    process.stdout.write(' ');

    for (i = 0; i < config.findAndReplace.length; i++) {
        msg.message = msg.message.replace(config.findAndReplace[i][0],
                                          config.findAndReplace[i][1]);
    }

    if(msg.message.match(config.hilight_re))
        hilight = true;

    var textColor = 15;
    if (msg.nick === config.myNick)
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

    while(i * availWidth - wrappedChars < msg.message.length) {
        var start = i * availWidth - wrappedChars;
        var curLine = msg.message.substr(start, availWidth);
        // remove leading space on next line
        curLine.replace(/^\s+/, '');
        // line wrap at word boundary only if there is whitespace on this line
        if(start + availWidth < msg.message.length && curLine.lastIndexOf(' ') !== -1) {
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
    sendMsg({
        cmd: 'backlog',
        chan: chan,
        server: server
    });
};

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
var socket = net.connect({port: config.port, host: config.addr});
var buffer = "";

socket.on('data', function(data) {
    buffer += data.toString('utf8');

    var lastNL = buffer.lastIndexOf('\n');
    if(lastNL !== -1) {
        var recvdLines = buffer.substr(0, lastNL).split('\n');
        buffer = buffer.substr(lastNL + 1);

        for(var i = 0; i < recvdLines.length; i++) {
            var msg = JSON.parse(recvdLines[i]);
            if(msg.server + ':' + msg.chan === server + ':' + chan) {
                printLine(msg);
                readline.redraw();
            }
        }
    }
});

// handle terminal resize
process.stdout.on('resize', function() {
    process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
    redraw();
});

var prompt = config.getPrompt(chanLongName);

// parse some select commands from input line
readline = vimrl(prompt, function(line) {
    redraw();

    if(line === '/bl' || line.substring(0, 4) === '/bl ') { // request backlog
        line = "/privmsg *backlog " + chan + ' ' + line.substring(4);
    } else if(line.substring(0, 4) === '/me ') { // irc ACTION message
        line = "\001ACTION " + line.substring(4);
    } else if(line === '/names') { // request nick list
        line = "/names " + chan;
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
                    printLine({
                        nick: '***',
                        msg: 'URL ' + current + ': ' + url
                    });
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
            printLine({
                nick: '***',
                msg: 'URL ' + (parseInt(line.substring(3)) | 0) +  " opened: " + url
            });
            readline.redraw();
        } else {
            printLine({
                nick: '***',
                msg: 'No URL found'
            });
            readline.redraw();
        }

        return;
    }

    // send input line to ii
    var msgString = line;
    var msg = {
        cmd: 'message',
        chan: chan,
        server: server,
        message: msgString
    };
    socket.write(msg);
});

readline.gotoInsertMode();

// clear terminal and print file contents at launch
process.stdout.write('\u001B[2J\u001B[0;0f');
redraw();
