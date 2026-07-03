# Jonik's Raycast Helpers

A small collection of [Raycast](https://www.raycast.com/) extensions and script commands I use day to day. Everything writes to my Obsidian vault.

## Contents

### `medialog/`
A Raycast extension for browsing and updating the media lists in my Obsidian vault — the Read List, Games List, and Watch List (mirroring the `.base` kanbans in the vault). A single **Log Media** command shows every entry as a banner-image grid, filterable by status (in progress, next up, backlog, …). From any entry you can:

- **Log Thought** — append a timestamped, mood-tagged callout under the note's `## Thoughts` section. The 🏁 Finished and 🛑 Dropping It moods also update the note's status (finished additionally stamps today's `finish date`).
- **Set Status** — move an entry between statuses (`to buy`, `backlog`, `next up`, `in progress`, `finished`, `dropped`, plus the games-only `upcoming`), rewriting the frontmatter in place.

### `quicknote-run/`
A Raycast extension that appends a timestamped callout under a topic in today's Obsidian daily note. Topics are the H3 headings (`### Topic` or `### [[Note|alias]]`) under the configured notes section, with the bottom-most topic preselected. Entries support a mood emoji and an optional bold title, and the form keeps drafts.

### `raycast-scripts/`
[Raycast script commands](https://manual.raycast.com/script-commands) — single-file shell scripts with Raycast metadata at the top.

- **`Utils/`** — general-purpose utilities (e.g. `youtube-rss-ify.sh` to turn a YouTube channel URL into its RSS feed).

## Using the script commands
Point Raycast at this folder under *Extensions → Script Commands → Add Directories*, then select `raycast-scripts/Utils`.

## Using the extensions
From `medialog/` or `quicknote-run/`:

```sh
npm install
npm run dev
```

Then configure the vault path (and, for quicknote-run, the daily-notes folder and notes heading) in the extension's preferences.
