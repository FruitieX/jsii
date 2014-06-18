#!/bin/bash

# this script makes it a little more convenient to launch jsii by searching for
# an irc channel from the first argument passed to the script

# i recommend that you symlink this to your $PATH with a short name such as 'i'

# - the script first searches $CHANS and then $IRCPATH
# - you can symlink your favorite irc channels to $CHANS
# - symlink them like so to number them: $CHANS/42_#channelname, starting from 1
#   (you might want to use the included irc_symlink.sh script for this)
# - this allows you to browse through channels with Alt+(h/l) and Alt+(1-9)

# i foobar # launch jsii with channel in $CHANS or $IRCPATH containing "foobar"
# i 42 # launch jsii with channel in $CHANS that looks like "42_#channelname"

# if you pass more arguments to the script they will be sent to the irc channel
# matching the first argument according to the rules above eg:

# i foochan "$(uptime)" # brag with your uptime to others

IRCPATH=$HOME/irc
CHANS=$IRCPATH/chans # "favorite" channels

MAXCHAN=$(find $CHANS/* | sed -e 's#.*/##' -e 's/_.*//' | sort -n | tail -n1)

num_regex='^[0-9]+$'
# no arguments?
if [[ $1 == "" ]]; then
	num=1
else
	num=$(echo $1 | grep -o -E $num_regex)
fi

# search by number in $CHANS
if [[ $num != "" ]]; then
	CHANNEL=$(find $CHANS -type l -iregex ".*/${num}_.*" | head -n1)
# search by name in $CHANS
else
	CHANNEL=$(find $CHANS -type l -iregex ".*${1}.*" | head -n1)
fi

# search in $IRCPATH
if [[ $CHANNEL == "" || $CHANNEL == $(echo $CHANS) ]]; then
	CHANNEL=$(find $IRCPATH -type l -iregex ".*${1}.*" | head -n1)
	# if still not found
	if [[ $CHANNEL == "" || $CHANNEL == $(echo $CHANS) ]]; then
		echo "Channel matching search criteria not found!"
		exit 1
	fi
fi

if [[ -z "$2" ]]; then
	# no additional args passed, launch ui
	# parse number from $CHANNEL, we might not have it yet
	num=$(echo $CHANNEL | sed -e 's#.*/##' -e 's/_.*//')
	if [[ $num == "" ]]; then
		num=0
	fi
	retval=-1
	while [[ $retval != 0 ]]; do
		# first run
		if [[ $retval == -1 ]]; then
			node ~/src/jsii/jsii.js $CHANNEL
			retval=$?
		# channel--
		elif [[ $retval == 10 ]]; then
			num=$(($num - 1))
			if [[ $num == 0 ]]; then
				num=$MAXCHAN
			fi
			CHANNEL=$(find $CHANS -type l -iregex ".*/${num}_.*" | head -n1)
			node ~/src/jsii/jsii.js $CHANNEL
			retval=$?
		# channel++
		elif [[ $retval == 11 ]]; then
			num=$(($num + 1))
			if [[ $num > $MAXCHAN ]]; then
				num=1
			fi
			CHANNEL=$(find $CHANS -type l -iregex ".*/${num}_.*" | head -n1)
			node ~/src/jsii/jsii.js $CHANNEL
			retval=$?
		else
			num=$retval
			CHANNEL=$(find $CHANS -type l -iregex ".*/${num}_.*" | head -n1)
			node ~/src/jsii/jsii.js $CHANNEL
			retval=$?
		fi
	done
else
	# multiple args passed, send rest of args ($2 ->) to channel
	shift; echo "$@" >> $CHANNEL/in
fi
