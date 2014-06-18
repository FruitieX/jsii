#!/bin/bash

# helper script for symlinking favorite irc channels with automatically
# incrementing num_ prefix. channels symlinked from $IRCPATH to $CHANS.
# WARNING: old $CHANS directory will be removed without asking!

# easy reordering of the channels:
# just move the symlink lines around in this script!

IRCPATH=$HOME/irc
CHANS=$IRCPATH/chans

rm $CHANS -r
mkdir $CHANS

link() {
	ln -s $IRCPATH/$2 $CHANS/$1_$3
}
id=0 # indexing starts at 1 (let id++; ran before first symlink)

# favorite channels, in the order specified here:
let id++; link "$id" "qnet/servername.org/#xonotic"					"#xonotic"
let id++; link "$id" "hut/servername.org/#awesome"					"#awesome"
let id++; link "$id" "freenode/servername.org/#neovim"				"#neovim"
let id++; link "$id" "freenode/servername.org/#truecrypt"			"#truecrypt"
let id++; link "$id" "freenode/servername.org/#btrfs"				"#btrfs"

# server info 'channels'
let id++; link "$id" "qnet/servername.org"							"qnet"
let id++; link "$id" "hut/servername.org"							"hut"
let id++; link "$id" "freenode/servername.org"						"freenode"
