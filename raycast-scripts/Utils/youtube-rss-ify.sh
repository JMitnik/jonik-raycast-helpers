#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title YouTube RSS-ify
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 🤖

# Documentation:
# @raycast.description Get RSS url
# @raycast.author JMitnik
# @raycast.authorURL https://raycast.com/JMitnik
# @raycast.argument1 { "type": "text", "placeholder": "YouTube channel URL" }

echo "Hello World!"



echo "https://www.youtube.com/feeds/videos.xml?$(curl -s "$1" | grep -o 'channel_id=[^"&]*' | head -1)"