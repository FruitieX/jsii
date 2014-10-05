#!/usr/bin/env node
var spawn = require('child_process').spawn;
var vimrl = require('vimrl');
var net = require('net');
var crypto = require('crypto');

var config = require(process.env.HOME + "/.jsiiConfig.js");

var nicks = {};

var chanNumber, server, chan;

var updateCompletions = function() {
    var nicksArray = Object.keys(nicks);
    for(var i = 0; i < nicksArray.length; i++) {
        if(nicksArray[i][0] === '@' || nicksArray[i][0] === '+') {
            nicksArray[i] = nicksArray[i].substr(1);
        }
        nicksArray[i] += ', ';
    }

    readline.setCompletions(nicksArray);
};

var findChannel = function(searchString) {
    // exact match for server:chan format
    if(searchString.indexOf(':') !== -1) {
        // first try looking for a match in config
        for(var i = 0; i < config.favoriteChannels.length; i++) {
            if(searchString === (config.favoriteChannels[i].server + ':' +
                                config.favoriteChannels[i].chan)) {
                return {
                    chanNumber: i,
                    server: config.favoriteChannels[i].server,
                    chan: config.favoriteChannels[i].chan
                }
            }
        }
        // otherwise assume the user knows better, use provided names
        return {
            server: searchString.split(':')[0],
            chan: searchString.split(':')[1]
        }
    }

    // search for substring in shortName
    for(var i = 0; i < config.favoriteChannels.length; i++) {
        if(config.favoriteChannels[i].shortName.match(new RegExp(searchString))) {
            return {
                chanNumber: i,
                server: config.favoriteChannels[i].server,
                chan: config.favoriteChannels[i].chan
            }
        }
    }
};

/* find server & channels names from first argument */
// no args: pick first favorite chan
if(!process.argv[2]) {
    server = config.favoriteChannels[0].server;
    chan = config.favoriteChannels[0].chan;
    chanNumber = 0;
// by channel number
} else if (!isNaN(process.argv[2])) {
    chanNumber = parseInt(process.argv[2]);
    server = config.favoriteChannels[chanNumber].server;
    chan = config.favoriteChannels[chanNumber].chan;
// else search
} else {
    var results = findChannel(process.argv[2]);

    if(results) {
        server = results.server;
        chan = results.chan;
        chanNumber = results.chanNumber;
    } else {
        console.log("No results with given search terms!");
        process.exit(1);
    }
}

// for prompt
var getChanName = function(server, chan, chanNumber) {
    if(!isNaN(chanNumber)) {
        return config.favoriteChannels[chanNumber].shortName;
    } else {
        return server + ':' + chan;
    }
};

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
    var separator = config.nickSeparator;

    // move cursor to lower left
    cursorReset();
    // clear current line
    clearLine();

    var nickColor = 0;
    var textColor = 15;

    // support irc ACTION messages
    if(msg.cmd === 'action') {
        msg.message = msg.nick + ' ' + msg.message;
        msg.nick = '*';
        nickColor = config.actionColor;
        textColor = config.actionColor;
    } else if (msg.cmd === 'join') {
        separator = '';
        msg.message = config.joinMsg;
        textColor = config.joinColor;
    } else if (msg.cmd === 'part') {
        separator = '';
        msg.message = config.partMsg;
        textColor = config.partColor;
    } else if (msg.cmd === 'nicklist') {
        msg.nick = '*';
        msg.message = 'Names: ' + msg.nicks.join(', ');
    } else if(msg.message.match(config.hilight_re)) {
        textColor = config.hilightColor;
    }

    if (msg.nick) {
        if(msg.nick === config.myNick) {
            nickColor = config.myNickColor;
            textColor = config.myNickColor;
        } else {
            // nick color, avoids dark colors
            var md5sum = crypto.createHash('md5');
            md5sum.update(msg.nick, 'utf8');
            nickColor = parseInt(md5sum.digest('hex'), 16) % 255;
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
    }

    // limit nicklen
    msg.nick = msg.nick.substr(0, config.maxNickLen);
    // align nicks and print
    process.stdout.write(Array(config.maxNickLen - msg.nick.length + 1).join(' '));
    process.stdout.write('\033[38;5;' + nickColor + 'm' + msg.nick + // set nick color + nick
                         '\033[38;5;' + config.separatorColor + 'm' + separator + // set separator color + separator
                         '\033[000m'); // reset colors

    for (i = 0; i < config.findAndReplace.length; i++) {
        msg.message = msg.message.replace(config.findAndReplace[i][0],
                                          config.findAndReplace[i][1]);
    }

    var availWidth = process.stdout.columns - config.maxNickLen - separator.length;

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
    readline.redraw();
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
        if(keyHex === '1b68') {
            if(isNaN(chanNumber)) chanNumber = 0;
            else chanNumber--;

            if(chanNumber < 0)
                chanNumber = config.favoriteChannels.length - 1;

            server = config.favoriteChannels[chanNumber].server;
            chan = config.favoriteChannels[chanNumber].chan;
            nicks = {};

            readline.changePrompt(config.getPrompt(
                        getChanName(server, chan, chanNumber), chanNumber));
            redraw();
        }
        // next channel (alt + l)
        else if(keyHex === '1b6c') {
            if(isNaN(chanNumber)) chanNumber = 0;
            else chanNumber++;

            if(chanNumber >= config.favoriteChannels.length)
                chanNumber = 0;

            server = config.favoriteChannels[chanNumber].server;
            chan = config.favoriteChannels[chanNumber].chan;
            nicks = {};

            readline.changePrompt(config.getPrompt(
                        getChanName(server, chan, chanNumber), chanNumber));
            redraw();
        }
        // jump to this channel (alt + 1-9)
        else if(keyHex.substring(0, 3) === '1b3' && !isNaN(keyHex[3])) {
            chanNumber = parseInt(keyHex.substring(3));

            server = config.favoriteChannels[chanNumber].server;
            chan = config.favoriteChannels[chanNumber].chan;
            nicks = {};

            readline.changePrompt(config.getPrompt(
                        getChanName(server, chan, chanNumber), chanNumber));
            redraw();
        }
        // plenty of weird alt combos start with 1b, ignore them or we risk
        // breaking the terminal
        else if(keyHex.substring(0, 2) === '1b') {
            // do nothing
        } else {
            readline.handleInput(input);
        }

        // DEBUG: uncomment this line to find the keycodes
        //console.log(keyHex.toString('hex'));
    }
});

var socket;
var connect = function() {
    socket = net.connect({port: config.port, host: config.addr});

    var buffer = "";

    socket.on('data', function(data) {
        buffer += data.toString('utf8');

        var lastNL = buffer.lastIndexOf('\n');
        if(lastNL !== -2) {
            var recvdLines = buffer.substr(0, lastNL).split('\n');
            buffer = buffer.substr(lastNL + 1);

            for(var i = 0; i < recvdLines.length; i++) {
                var msg = JSON.parse(recvdLines[i]);

                var msgChanLongName = msg.server + ':' + msg.chan;
                msgChanLongName = msgChanLongName.toLowerCase();

                var chanLongName = server + ':' + chan;
                chanLongName = chanLongName.toLowerCase();

                // is the message on the active channel?
                if(msg.broadcast || chanLongName === msgChanLongName) {
                    // store nicklist
                    if(msg.cmd === 'nicklist') {
                        for(var j = 0; j < msg.nicks.length; j++) {
                            nicks[msg.nicks[j]] = true;
                        }
                        updateCompletions();
                    } else if (msg.cmd === 'searchResults') {
                        if(msg.type === 'urllist') {
                            printLine({
                                nick: '***',
                                message: 'URL ' + msg.id + ':' + msg.message
                            });
                            readline.redraw();
                        } else if(msg.type === 'openurl') {
                            var child = spawn('chromium', [msg.message], {
                                detached: true,
                                stdio: [ 'ignore', 'ignore' , 'ignore' ]
                            });
                            child.unref();
                            printLine({
                                nick: '***',
                                message: 'URL opened:' + msg.message
                            });
                            readline.redraw();
                        }
                    } else {
                        printLine(msg);
                        readline.redraw();

                        if(msg.cmd === 'join') {
                            nicks[msg.nick] = true;
                            updateCompletions();
                        } else if(msg.cmd === 'part') {
                            delete(nicks[msg.nick]);
                            updateCompletions();
                        }
                    }
                }
            }
        }
    });

    socket.on('end', function() {
        socket.end();
    });
    socket.on('close', function() {
        printLine({
            cmd: 'message',
            nick: '!',
            message: 'lost connection to jsiid, reconnecting...'
        });
        setTimeout(connect, 1000);
    });
    socket.on('error', function(err) {
        printLine({
            cmd: 'message',
            nick: '!',
            message: 'socket error: ' + err.code
        });
    });
    socket.on('connect', function() {
        redraw();
    });
};


// handle terminal resize
process.stdout.on('resize', function() {
    redraw();
});

var prompt = config.getPrompt(getChanName(server, chan, chanNumber), chanNumber);

// parse some select commands from input line
readline = vimrl(prompt, function(line) {
    if(line === '/bl' || line.substring(0, 4) === '/bl ') {
        // request backlog
        sendMsg({
            cmd: "command",
            server: server,
            message: "PRIVMSG *backlog " + chan + ' ' + line.substring(4)
        });
    } else if(line.substring(0, 4) === '/me ') {
        // irc ACTION message
        sendMsg({
            cmd: "action",
            message: line.substring(4),
            chan: chan,
            server: server,
            nick: config.myNick
        });
    } else if(line === '/names') {
        // request nick list
        printLine({
            cmd: 'nicklist',
            nicks: Object.keys(nicks)
        });
    } else if (line === '/ul') {
        // list urls in buffer
        sendMsg({
            cmd: "search",
            type: "urllist",
            skip: (parseInt(line.substring(3)) | 0),
            chan: chan,
            server: server,
            searchRE: config.urlRE_s,
            firstMatchOnly: false,
            onlyMatching: true
        });
    } else if (line === '/u' || line.substring(0, 3) === '/u ') {
        // open url
        sendMsg({
            cmd: "search",
            type: "openurl",
            skip: (parseInt(line.substring(3)) | 0),
            chan: chan,
            server: server,
            searchRE: config.urlRE_s,
            firstMatchOnly: true,
            onlyMatching: true
        });
    } else if(line.substring(0, 5) === '/say ') {
        // say rest of line
        sendMsg({
            cmd: "message",
            message: line.substring(5),
            chan: chan,
            server: server,
            nick: config.myNick
        });
    } else if(line[0] === '/') {
        // irc commands
        sendMsg({
            cmd: "command",
            server: server,
            message: line.substring(1)
        });
    } else {
        // send input line to jsiid
        sendMsg({
            cmd: 'message',
            chan: chan,
            server: server,
            message: line,
            nick: config.myNick
        });
    }
});

connect();
readline.gotoInsertMode();
