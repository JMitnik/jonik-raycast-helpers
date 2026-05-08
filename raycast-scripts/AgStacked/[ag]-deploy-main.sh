#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title [AG] Deploy main
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 🤖
# @raycast.needsConfirmation true

# Documentation:
# @raycast.description Deploy main
# @raycast.author JMitnik
# @raycast.authorURL https://raycast.com/JMitnik

cd /Users/jonathanmitnik/Development/agstacked-dev
source /Users/jonathanmitnik/dev/ai/bin/activate
ag deploy app --prod

