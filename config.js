// jsii configuration
//
// NOTE that most self.* values are mandatory and jsii won't work if they aren't
// defined!
//
var path = require('path');

module.exports = function(filePath) {
    var config = function() {
        var self = this;
        var basename = path.basename(filePath);

        /*
         * General
         */

        self.fileBufSize = 8192; // how many characters of file to remember at most
        self.myNick = "FruitieX"; // for hilights
        self.hilight_re = new RegExp(".*" + self.myNick + ".*", 'i'); // matches count as hilights
        self.url_re = /(^|\s)((https?:\/\/)[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi; // matches count as urls
        self.url_ignore_nicks = [ 'BoWa' ]; // ignore urls by these nicks
        self.ansi_escape_re = /\x1b[^m]*m/; // remove funky characters

        // full name of current channel, sent over irc with some commands
        self.chanFullName = basename.substring(basename.indexOf('_') + 1, basename.length);

        // find and replace these characters in others' messages
        // you can still send them since you aren't insane :-)
        self.findAndReplace =
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

        self.maxNickLen = 12; // limit printed nickname length to this
        self.separatorColor = 239; // color for separator between nick - msg
        self.myNickColor = 1; // color of your nick and lines by you
        self.hilightColor = 3; // color of hilights
        self.actionColor = 10; // color of /me nonsense

        // paths to out / in files
        self.outFileName = filePath + '/out';
        self.inFileName = filePath + '/in';

        /*
         * Prompt
         */

        // number of current channel, if any, to print in prompt
        var chanNumber = basename.substring(0, basename.indexOf('_'));

        // shorten funny ircnet channel names like !ABCDEchan
        if(self.chanFullName.charAt(0) === '!')
            self.chanShortened = ' !' + self.chanFullName.substring(6, self.chanFullName.length);
        else
            self.chanShortened = ' ' + self.chanFullName;

        var i;

        // my prompt looks like: "42 #channame > here goes text"
        self.normalPrompt = chanNumber + self.chanShortened + ' > ';
        self.insertPrompt = chanNumber + self.chanShortened + ' > ';

        // self.*PromptColors are arrays containing for each character in
        // self.*Prompt which ANSI color code should be printed before that
        // character. This hack was needed because we may need to split the
        // prompt if a chat message is longer than our terminal is wide.
        //
        // In my case, i want the '>' character to change colors, depending on
        // which vi-mode we are in, here's how to do that:

        self.normalPromptColors = [];
        self.insertPromptColors = [];

        // fill arrays with empty strings
        for (i = 0; i < self.normalPrompt.length; i++) {
            self.normalPromptColors[i] = '';
        }
        for (i = 0; i < self.insertPrompt.length; i++) {
            self.insertPromptColors[i] = '';
        }

        // 2nd last char should be grey
        self.normalPromptColors[self.normalPrompt.length - 2] = '\033[38;5;242m';
        // 2nd last char should be white
        self.insertPromptColors[self.insertPrompt.length - 2] = '\033[38;5;252m';
    };

    return new config();
};
