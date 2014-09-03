jsii
====

node.js based user interface for the `jsiid` irc client with vim-like keybindings.
Takes as first argument a server:chan name, channel id or search string.

![Screenshot](/screenshot.png "Yep, it's an irc client.")

Setup (already have ii running / keep it simple)
------------------------------------------------

1. Fetch dependencies: `$ npm update`
2. Run: `$ node jsii.js /path/to/#channel`

Full setup
----------

1. [Install ii](http://tools.suckless.org/ii/)
2. Edit `irc_connect.sh` and run the script. Recommended to autorun it in eg.
   your `.xinitrc` or using a systemd service.
3. When you have `ii` running, edit `irc_symlink.sh` with your favorite
   channels, then run the script.
4. Fetch dependencies: `$ npm update`
5. If you changed any of the default paths, edit `i.sh`. Try running the script
   and see if jsii opens with the first channel visible. If it works you may
   want to symlink the script to eg. `$PATH/i`

Now you can open your favorite irc channel number 42 with `i 42`. Or search and
open a channel with `i channame`. Browsing through irc channels is possible
with `alt + h/l` or `alt + 1-9`
