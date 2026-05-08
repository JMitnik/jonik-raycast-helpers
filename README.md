# Jonik's Raycast Helpers

A small collection of [Raycast](https://www.raycast.com/) extensions and script commands I use day to day.

## Contents

### `quicknote/`
A Raycast extension that appends a timestamped bullet under a topic in today's Obsidian daily note. Topics are detected as bold-only header lines (e.g. `**Project X**`), and the form supports a mood emoji and an optional Todo checkbox (which inserts `- [ ] HH:MM - …` style items).

### `raycast-scripts/`
[Raycast script commands](https://manual.raycast.com/script-commands) — single-file shell scripts with Raycast metadata at the top.

- **`Utils/`** — general-purpose utilities (e.g. `youtube-rss-ify.sh` to turn a YouTube channel URL into its RSS feed).

## Using the script commands
Point Raycast at this folder under *Extensions → Script Commands → Add Directories*, then select `raycast-scripts/Utils`.

## Using the extension
From `quicknote/`:

```sh
npm install
npm run dev
```

Then configure the vault path, daily-notes folder, and notes heading in the extension's preferences.
