#!/usr/bin/env node
var spawn = require('child_process').spawn;
var vimrl = require('vimrl');
var net = require('net');

var config = require(process.env.HOME + "/.jsiiConfig.js");

var nicks = {};

var chanNumber, server, chan;

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

    server = results.server;
    chan = results.chan;
    chanNumber = results.chanNumber;
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
        line = nick + ' ' + line.substring(8);
        nick = '*';
        nickColor = config.actionColor;
        textColor = config.actionColor;
    } else if (msg.cmd === 'join') {
        msg.message = config.joinMsg;
        textColor = config.joinColor;
    } else if (msg.cmd === 'part') {
        msg.message = config.partMsg;
        textColor = config.partColor;
    } else if(msg.message.match(config.hilight_re)) {
        textColor = config.hilightColor;
    }

    if (msg.nick) {
        if(msg.nick === config.myNick) {
            nickColor = config.myNickColor;
            textColor = config.myNickColor;
        } else {
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
    }

    // limit nicklen
    msg.nick = msg.nick.substr(0, config.maxNickLen);
    // align nicks and print
    process.stdout.write(Array(config.maxNickLen - msg.nick.length + config.nickSeparator.length).join(' '));
    process.stdout.write('\033[38;5;' + nickColor + 'm' + msg.nick + // set nick color + nick
                         '\033[38;5;' + config.separatorColor + 'm' + config.nickSeparator + // set separator color + separator
                         '\033[000m'); // reset colors

    for (i = 0; i < config.findAndReplace.length; i++) {
        msg.message = msg.message.replace(config.findAndReplace[i][0],
                                          config.findAndReplace[i][1]);
    }

    var availWidth = process.stdout.columns - config.maxNickLen - config.nickSeparator.length;

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

            readline.changePrompt(config.getPrompt(
                        getChanName(server, chan, chanNumber), chanNumber));
            redraw();
        }
        // jump to this channel (alt + 1-9)
        else if(keyHex.substring(0, 3) === '1b3' && keyHex.substring(3) !== '0') {
            chanNumber = parseInt(keyHex.substring(3));

            server = config.favoriteChannels[chanNumber].server;
            chan = config.favoriteChannels[chanNumber].chan;

            readline.changePrompt(config.getPrompt(
                        getChanName(server, chan, chanNumber), chanNumber));
            redraw();
        } else {
            readline.handleInput(input);
        }

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
    redraw();
});

var prompt = config.getPrompt(getChanName(server, chan, chanNumber), chanNumber);

// parse some select commands from input line
readline = vimrl(prompt, function(line) {
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

    // send input line to jsiid
    var msg = {
        cmd: 'message',
        chan: chan,
        server: server,
        message: line,
        nick: config.myNick
    };
    sendMsg(msg);

    msg.nick = config.myNick;
    printLine(msg);
});

readline.gotoInsertMode();

redraw();
