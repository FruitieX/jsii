// jsii configuration
//
// NOTE that most config.* values are mandatory and jsii won't work if they aren't
// defined!

var config = {};

/*
 * General
 */

config.myNick = "myNick"; // for hilights

config.addr = '127.0.0.1'; // address to jsiid
config.port = '6666'; // port to jsiid

config.favoriteChannels = [
        { server: 'qnet', chan: '#test', shortName: 'test' },
        { server: 'hut', chan: '#blargh_longchan', shortName: 'blargh' }
    ];

config.hilight_re = new RegExp(".*" + config.myNick + ".*", 'i');
// NOTE: the following regex needs all backslashed double escaped
config.urlRE_s = '(^|\\s)((https?:\\/\\/)[\\w-]+(\\.[\\w-]+)+\\.?(:\\d+)?(\\/\\S*)?)'; // matches count as urls
//config.url_ignore_nicks = [ 'sillybot' ]; // ignore urls by these nicks

// find and replace these characters in others' messages
config.findAndReplace =
    [
        // remove funky ansi characters
        [ /\x1b[^m]*m/, '' ],

        // 'fix' insane encodings
        [ /�/g, 'å' ],
        [ /�/g, 'ä' ],
        [ /�/g, 'ö' ],

        // tabs -> spaces
        [/\t/g, '    '],

        // crlf
        [/\n/g, ' '],
        [/\r/g, ' ']
    ];

/*
 * Appearance
 */

config.maxNickLen = 12; // limit printed nickname length to this
config.separatorColor = 239; // color for separator between nick - msg
config.myNickColor = 1; // color of your nick and lines by you
config.hilightColor = 3; // color of hilights
config.actionColor = 10; // color of /me nonsense
config.nickSeparator = ' : ';
config.joinMsg = ' > joined.'
config.joinColor = 10;
config.partMsg = ' < left.';
config.partColor = 1;

/*
 * Prompt
 */

config.getPrompt = function(chanShortName, chanNumber) {
    var i;

    var chanNumberString = '';
    if(chanNumber === 0 || chanNumber) {
        chanNumberString = chanNumber + ' ';
    }

    // my prompt looks like: "42 #channame > here goes text"
    var normalPrompt = chanNumberString + chanShortName + ' > ';
    var insertPrompt = chanNumberString + chanShortName + ' > ';

    // config.*PromptColors are arrays containing for each character in
    // config.*Prompt which ANSI color code should be printed before that
    // character. This hack was needed because we may need to split the
    // prompt if a chat message is longer than our terminal is wide.
    //
    // In my case, i want the '>' character to change colors, depending on
    // which vi-mode we are in, here's how to do that:

    var normalPromptColors = [];
    var insertPromptColors = [];

    // fill arrays with empty strings
    for (i = 0; i < normalPrompt.length; i++) {
        normalPromptColors[i] = '';
    }
    for (i = 0; i < insertPrompt.length; i++) {
        insertPromptColors[i] = '';
    }

    // 2nd last char should be grey
    normalPromptColors[normalPrompt.length - 2] = '\033[38;5;242m';
    // 2nd last char should be white
    insertPromptColors[insertPrompt.length - 2] = '\033[38;5;252m';

    return {
        normalPrompt: normalPrompt,
        normalPromptColors: normalPromptColors,
        insertPrompt: insertPrompt,
        insertPromptColors: insertPromptColors
    };
};

module.exports = config;
