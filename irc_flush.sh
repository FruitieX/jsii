#!/bin/bash

IRCPATH=$HOME/irc

find $IRCPATH -wholename '*/out' -exec bash -c 'x=$(tail "$0"); echo "$x" > "$0"' {} \;
