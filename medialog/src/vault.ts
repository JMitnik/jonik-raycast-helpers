import * as fs from "fs";
import * as path from "path";

// The three media collections this extension tracks. Folders and tags are
// hardcoded to match the `medialog` skill conventions in the vault. Only the
// vault root is configurable (via preferences).
export interface Collection {
  key: string;
  title: string;
  /** A note belongs to the collection when it carries any of these tags. */
  tags: string[];
  folder: string;
}

export const COLLECTIONS: Collection[] = [
  {
    key: "books",
    title: "Read List",
    tags: [
      "collection/books",
      "collection/manga",
      "collection/manhwa",
      "collection/comic",
    ],
    folder: "3. Common/Areas/Personal/Entertainment/Books",
  },
  {
    key: "games",
    title: "Games List",
    tags: ["collection/games"],
    folder: "3. Common/Areas/Personal/Entertainment/Games",
  },
  {
    key: "watch",
    title: "Watch List",
    tags: ["collection/watch"],
    folder: "3. Common/Areas/Personal/Entertainment/Watch",
  },
];

// Where `[[banner-x.jpg]]` wikilink embeds resolve to (from the vault's
// Obsidian attachment config).
export const ATTACHMENTS_FOLDER = "4. Meta/__ Assets/Attachments";

// Status vocabulary shared by all lists (matches the vault's medialog skill).
export const STATUSES = [
  "in progress",
  "next up",
  "upcoming",
  "backlog",
  "to buy",
  "finished",
  "dropped",
] as const;
export type Status = (typeof STATUSES)[number];

// `upcoming` is a games-only tier (a curated cut above `backlog`).
export function statusesForCollection(collectionKey: string): Status[] {
  return collectionKey === "games"
    ? [...STATUSES]
    : STATUSES.filter((s) => s !== "upcoming");
}

// The default grid filter.
export const IN_PROGRESS = "in progress";

export interface MediaItem {
  title: string;
  filePath: string;
  collectionKey: string;
  collectionTitle: string;
  status: string;
  medium?: string;
  /** Resolved banner: a remote URL or an absolute local file path. */
  banner?: string;
}

interface Frontmatter {
  tags: string[];
  status?: string;
  banner?: string;
  medium?: string;
}

// Minimal frontmatter reader. Handles both flow style (`status: in progress`)
// and list style (`status:\n  - in progress`) for the few fields we care about,
// since the vault mixes both conventions.
export function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;

  const block = content.slice(3, end).split("\n");
  const fm: Frontmatter = { tags: [] };
  let currentListKey: string | null = null;

  for (const raw of block) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const value = stripQuotes(listMatch[1].trim());
      if (currentListKey === "tags") fm.tags.push(value);
      else if (currentListKey === "status" && !fm.status) fm.status = value;
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z][\w ]*):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1].trim().toLowerCase();
    const value = stripQuotes(kvMatch[2].trim());

    if (value === "") {
      currentListKey = key; // list values follow on subsequent lines
      continue;
    }
    currentListKey = null;

    switch (key) {
      case "tags":
        fm.tags.push(...value.split(/[,\s]+/).filter(Boolean));
        break;
      case "status":
        fm.status = value;
        break;
      case "banner":
        fm.banner = value;
        break;
      case "medium":
        fm.medium = value;
        break;
    }
  }

  return fm;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

// `#collection/games` and `collection/games` both count as a match.
function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").toLowerCase();
}

function resolveBanner(vaultPath: string, banner?: string): string | undefined {
  if (!banner) return undefined;
  if (/^https?:\/\//i.test(banner)) return banner;
  const wikilink = banner.match(/^\[\[(.+?)\]\]$/);
  if (wikilink) {
    const file = wikilink[1].split("|")[0].trim();
    return path.join(vaultPath, ATTACHMENTS_FOLDER, file);
  }
  return undefined;
}

function walkMarkdown(dir: string): string[] {
  let results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// Scan every collection folder and return all entries that carry a status,
// tagged with the collection they belong to. Filtering happens in the UI.
export function loadItems(vaultPath: string): MediaItem[] {
  const items: MediaItem[] = [];

  for (const collection of COLLECTIONS) {
    const folder = path.join(vaultPath, collection.folder);
    for (const filePath of walkMarkdown(folder)) {
      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        continue;
      }

      const fm = parseFrontmatter(content);
      if (!fm) continue;

      const tags = fm.tags.map(normalizeTag);
      if (!collection.tags.some((t) => tags.includes(t))) continue;
      const status = (fm.status ?? "").toLowerCase();
      if (!status) continue;

      items.push({
        title: path.basename(filePath, ".md"),
        filePath,
        collectionKey: collection.key,
        collectionTitle: collection.title,
        status,
        medium: fm.medium,
        banner: resolveBanner(vaultPath, fm.banner),
      });
    }
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// Rewrite the `status` frontmatter value in place, preserving whichever YAML
// style (flow or list) the note already uses. When the new status is
// `finished`, also stamp `finish date` (added only if not already present).
export function updateStatusInContent(
  content: string,
  newStatus: Status,
  finishDate?: string,
): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;

  let block = content.slice(3, end);
  const listStyle = /^status:\s*\r?\n(\s*-\s+.*(\r?\n|$))+/m;
  const flowStyle = /^status:.*$/m;

  if (listStyle.test(block)) {
    block = block.replace(listStyle, `status:\n  - ${newStatus}\n`);
  } else if (flowStyle.test(block)) {
    block = block.replace(flowStyle, `status: ${newStatus}`);
  } else {
    block = `${block.replace(/\n*$/, "")}\nstatus: ${newStatus}\n`;
  }

  if (newStatus === "finished" && finishDate) {
    if (/^finish date:/m.test(block)) {
      block = block.replace(/^finish date:.*$/m, `finish date: ${finishDate}`);
    } else {
      block = `${block.replace(/\n*$/, "")}\nfinish date: ${finishDate}\n`;
    }
  }

  if (!block.endsWith("\n")) block += "\n";
  return `---${block}${content.slice(end + 1)}`;
}

export function updateStatus(filePath: string, newStatus: Status): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const now = new Date();
  const finishDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const updated = updateStatusInContent(content, newStatus, finishDate);
  fs.writeFileSync(filePath, updated, "utf-8");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// `22 June 2026 15:30` — the timestamp format used in the vault's media notes.
export function formatTimestamp(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Build a quicknote-style callout block:
//   > 🟢 22 June 2026 15:30 **Optional title**
//   > note line(s)
export function buildCallout(opts: {
  mood?: string;
  title?: string;
  note: string;
  timestamp: string;
}): string[] {
  const moodPrefix = opts.mood ? `${opts.mood} ` : "";
  const title = opts.title?.trim();
  const header = title
    ? `> ${moodPrefix}${opts.timestamp} **${title}**`
    : `> ${moodPrefix}${opts.timestamp}`;
  const body = opts.note.split("\n").map((line) => `> ${line}`);
  return [header, ...body];
}

// Insert a callout under the `## Thoughts` section, appending at the bottom so
// prior entries are never touched. Creates the section if it's missing.
export function insertThought(content: string, callout: string[]): string {
  const lines = content.split("\n");
  const headingIdx = lines.findIndex((l) => /^##\s+Thoughts\s*$/i.test(l));

  if (headingIdx === -1) {
    const trimmed = content.replace(/\n*$/, "");
    return `${trimmed}\n\n## Thoughts\n\n${callout.join("\n")}\n`;
  }

  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  let lastNonEmpty = headingIdx;
  for (let i = headingIdx + 1; i < sectionEnd; i++) {
    if (lines[i].trim()) lastNonEmpty = i;
  }

  lines.splice(lastNonEmpty + 1, 0, "", ...callout);
  return lines.join("\n");
}
