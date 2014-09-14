jsii
====

node.js based terminal user interface for the `jsiid` irc client with vim-like
keybindings. Takes as first argument either servername:channelname, channel id
or search string.

![Screenshot](/screenshot.png "Yep, it's an irc client.")

Setup
-----

1. Install and configure [jsiid](http://github.com/FruitieX/jsiid)
2. Fetch dependencies: `$ npm update`
3. `cp jsiiConfig.js.example ~/.jsiiConfig.js`
4. Edit the configuration file
5. Chat on irc by running jsii.js:
   * jsii.js `servername:channelname` - open channelname on servername
   * jsii.js `42` - open favorite channel number 42
   * jsii.js `foo` - search & open channel favorites matching foo, eg. "#foobar"

Tip:
* Symlink `jsii.js` to `$PATH/i`
* Now you can run jsii just by doing eg. `i 42`, `i channame`
* Browsing through favorite channels is possible with `alt + h/l` or
  `alt + 1-9`
