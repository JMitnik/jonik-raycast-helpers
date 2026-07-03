import { Form, ActionPanel, Action, showToast, Toast, getPreferenceValues, popToRoot, LaunchProps } from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";

interface Preferences {
  vaultPath: string;
  dailyNotesFolder: string;
  notesHeading: string;
}

interface NoteEntry {
  display: string;
  lineIndex: number;
  latestTimestamp?: string;
}

function getDailyNotePath(vaultPath: string, dailyNotesFolder: string): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return path.join(vaultPath, dailyNotesFolder, `${yyyy}-${mm}-${dd}.md`);
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function isBoldHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5 || !trimmed.startsWith("**") || !trimmed.endsWith("**")) return false;
  const inner = trimmed.slice(2, -2);
  return inner.length > 0 && !inner.includes("**");
}

function getDisplayName(line: string): string {
  const inner = line.trim().slice(2, -2);
  const backlinkMatch = inner.match(/^\[\[(.+?)\]\]$/);
  if (backlinkMatch) {
    const content = backlinkMatch[1];
    const pipeIdx = content.lastIndexOf("|");
    return pipeIdx >= 0 ? content.slice(pipeIdx + 1) : content;
  }
  return inner;
}

function findSectionRange(lines: string[], notesHeading: string): [number, number] | null {
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) && lines[i].includes(notesHeading)) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) return null;

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }
  return [sectionStart, sectionEnd];
}

function findBlockEnd(lines: string[], blockStart: number, sectionEnd: number): number {
  for (let i = blockStart + 1; i < sectionEnd; i++) {
    if (isBoldHeaderLine(lines[i])) return i;
  }
  return sectionEnd;
}

function findLatestTimestamp(lines: string[], blockStart: number, blockEnd: number): string | undefined {
  let latest: string | undefined;
  for (let i = blockStart + 1; i < blockEnd; i++) {
    const line = lines[i].trim();
    // Match both the legacy bullet form (`- [ ] 14:33 - ...`) and the inline
    // italic form (`_🟢 14:33_ - text`).
    const match = line.match(/^-\s+(?:\[[ xX]\]\s+)?(\d{2}:\d{2})\b/) ?? line.match(/^_[^_]*(\d{2}:\d{2})[^_]*_/);
    if (match && (!latest || match[1] > latest)) latest = match[1];
  }
  return latest;
}

function parseNotesEntries(content: string, notesHeading: string): NoteEntry[] {
  const lines = content.split("\n");
  const range = findSectionRange(lines, notesHeading);
  if (!range) return [];
  const [sectionStart, sectionEnd] = range;

  const entries: NoteEntry[] = [];
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    if (!isBoldHeaderLine(lines[i])) continue;
    const blockEnd = findBlockEnd(lines, i, sectionEnd);
    entries.push({
      display: getDisplayName(lines[i]),
      lineIndex: i,
      latestTimestamp: findLatestTimestamp(lines, i, blockEnd),
    });
  }

  return entries;
}

function pickDefaultEntry(entries: NoteEntry[]): NoteEntry | undefined {
  if (entries.length === 0) return undefined;
  let best: NoteEntry | undefined;
  for (const entry of entries) {
    if (!entry.latestTimestamp) continue;
    if (!best || !best.latestTimestamp || entry.latestTimestamp >= best.latestTimestamp) {
      best = entry;
    }
  }
  return best ?? entries[entries.length - 1];
}

function findInsertionLine(lines: string[], entryLineIndex: number, sectionEnd: number): number {
  const blockEnd = findBlockEnd(lines, entryLineIndex, sectionEnd);
  let lastNonEmpty = entryLineIndex;
  for (let i = entryLineIndex + 1; i < blockEnd; i++) {
    if (lines[i].trim()) lastNonEmpty = i;
  }
  return lastNonEmpty;
}

interface QuicknoteValues {
  entry: string;
  mood: string;
  todo: boolean;
  note: string;
}

export default function Command(props: LaunchProps<{ draftValues: QuicknoteValues }>) {
  const { draftValues } = props;

  const preferences = getPreferenceValues<Preferences>();
  const dailyNotePath = getDailyNotePath(preferences.vaultPath, preferences.dailyNotesFolder);

  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [defaultEntry, setDefaultEntry] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    try {
      if (!fs.existsSync(dailyNotePath)) {
        setError(`Daily note not found: ${dailyNotePath}`);
        setIsLoading(false);
        return;
      }

      const content = fs.readFileSync(dailyNotePath, "utf-8");
      const parsed = parseNotesEntries(content, preferences.notesHeading);

      if (parsed.length === 0) {
        setError(`No entries found under "${preferences.notesHeading}" heading`);
        setIsLoading(false);
        return;
      }

      const def = pickDefaultEntry(parsed);
      setEntries(parsed);
      setDefaultEntry(def ? String(def.lineIndex) : undefined);
      setIsLoading(false);
    } catch (e) {
      setError(`Failed to read daily note: ${e}`);
      setIsLoading(false);
    }
  }, []);

  async function handleSubmit(values: { entry: string; mood: string; todo: boolean; note: string }) {
    const text = values.note?.trim();
    if (!text) {
      await showToast({ style: Toast.Style.Failure, title: "Note cannot be empty" });
      return;
    }

    try {
      // Re-read file at submission time in case it changed
      const content = fs.readFileSync(dailyNotePath, "utf-8");
      const lines = content.split("\n");
      const range = findSectionRange(lines, preferences.notesHeading);
      if (!range) {
        await showToast({ style: Toast.Style.Failure, title: "Section heading not found" });
        return;
      }
      const [, sectionEnd] = range;

      const entryLineIndex = parseInt(values.entry, 10);
      const insertAfter = findInsertionLine(lines, entryLineIndex, sectionEnd);

      const moodPrefix = values.mood ? `${values.mood} ` : "";
      const time = getCurrentTime();

      // Todos keep the legacy bullet form so they stay tickable in Obsidian;
      // everything else is a single inline line: `_🟢 13:32_ - text`.
      const newLine = values.todo ? `- [ ] ${time} - ${moodPrefix}${text}` : `_${moodPrefix}${time}_ - ${text}`;

      lines.splice(insertAfter + 1, 0, newLine);

      fs.writeFileSync(dailyNotePath, lines.join("\n"), "utf-8");

      await showToast({ style: Toast.Style.Success, title: "Note added!" });
      await popToRoot();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to save note", message: String(e) });
    }
  }

  return (
    <Form
      isLoading={isLoading}
      enableDrafts={true}
      actions={
        !error ? (
          <ActionPanel>
            <Action.SubmitForm title="Add Note" onSubmit={handleSubmit} />
          </ActionPanel>
        ) : undefined
      }
    >
      {error ? (
        <Form.Description text={error} />
      ) : (
        <>
          <Form.Dropdown id="entry" title="Topic" defaultValue={draftValues?.entry ?? defaultEntry}>
            {entries.map((entry) => (
              <Form.Dropdown.Item key={entry.lineIndex} value={String(entry.lineIndex)} title={entry.display} />
            ))}
          </Form.Dropdown>
          <Form.Dropdown id="mood" title="Reflection" defaultValue={draftValues?.mood ?? ""} autoFocus>
            <Form.Dropdown.Item value="" title="None" />
            <Form.Dropdown.Item value="🏁" title="🏁 Start" />
            <Form.Dropdown.Item value="🟢" title="🟢 Good Progress" />
            <Form.Dropdown.Item value="🔴" title="🔴 Something Is Off" />
            <Form.Dropdown.Item value="🧠" title="🧠 Thinking" />
            <Form.Dropdown.Item value="🤔" title="🤔 Doubt" />
            <Form.Dropdown.Item value="✅" title="✅ Completed" />
            <Form.Dropdown.Item value="💪" title="💪 Things Are Looking Great!" />
          </Form.Dropdown>
          <Form.Checkbox id="todo" label="Todo" defaultValue={draftValues?.todo ?? false} />
          <Form.TextArea
            id="note"
            title="Note"
            placeholder="Write your reflection..."
            defaultValue={draftValues?.note ?? ""}
          />
        </>
      )}
    </Form>
  );
}
