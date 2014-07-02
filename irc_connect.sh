#!/bin/bash

# passwords to irc servers as variables in this file, like so:
# IRCPASS_FREENODE="awesomesauce"
source ~/.ircpw

# irc server and port
# NOTE: I use an irc bouncer, so the server is always the same
# modifying the script for multiple servers should be simple enough though
SERVER=server.org
PORT=6667

RECONNECT_DELAY=3
NICK="JsiiTestUser"

# path to the ii binary
II=$HOME/src/ii/ii
# path where ii should put the irc directory tree
IRCPATH=$HOME/irc

killall irc_connect.sh
killall ii

connect() {
	while true; do
		IRCPASS="$2" $II -i $IRCPATH/$1 -s $SERVER -p $PORT -k "IRCPASS" -n $NICK
		sleep $RECONNECT_DELAY
	done
}

connect qnet $IRCPASS_QNET &
connect freenode $IRCPASS_FREENODE &
connect hut $IRCPASS_HUT &
