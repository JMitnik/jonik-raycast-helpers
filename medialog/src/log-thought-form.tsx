import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  popToRoot,
} from "@raycast/api";
import { useState } from "react";
import * as fs from "fs";
import {
  MediaItem,
  Status,
  buildCallout,
  insertThought,
  formatTimestamp,
  updateStatus,
} from "./vault";

interface FormValues {
  mood: string;
  title: string;
  note: string;
}

// Moods that also change the entry's status when the thought is logged.
const MOOD_STATUS: Record<string, Status> = {
  "🏁": "finished",
  "🛑": "dropped",
};

const MOOD_HINTS: Record<string, string> = {
  "🏁": "🏁 This will also mark the entry as finished: status → 'finished', finish date → today.",
  "🛑": "🛑 This will also mark the entry as dropped: status → 'dropped'.",
};

export default function LogThoughtForm({
  item,
  onDidLog,
}: {
  item: MediaItem;
  onDidLog?: () => void;
}) {
  const [mood, setMood] = useState("");

  async function handleSubmit(values: FormValues) {
    const note = values.note?.trim();
    if (!note) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Note cannot be empty",
      });
      return;
    }

    try {
      const content = fs.readFileSync(item.filePath, "utf-8");
      const callout = buildCallout({
        mood: values.mood,
        title: values.title,
        note,
        timestamp: formatTimestamp(new Date()),
      });
      const updated = insertThought(content, callout);
      fs.writeFileSync(item.filePath, updated, "utf-8");

      // Some moods also change the entry's status (finished additionally
      // stamps today's finish date in the frontmatter).
      const newStatus = MOOD_STATUS[values.mood];
      if (newStatus) updateStatus(item.filePath, newStatus);

      onDidLog?.();
      await showToast({
        style: Toast.Style.Success,
        title: newStatus
          ? `Logged & ${newStatus} ${item.title}`
          : `Logged to ${item.title}`,
      });
      await popToRoot();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save thought",
        message: String(e),
      });
    }
  }

  return (
    <Form
      navigationTitle={`Log: ${item.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Thought" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={`${item.collectionTitle} · ${item.title}`} />
      <Form.Dropdown
        id="mood"
        title="Reflection"
        value={mood}
        onChange={setMood}
        autoFocus
      >
        <Form.Dropdown.Item value="" title="None" />
        <Form.Dropdown.Item value="🔄" title="🔄 Back at It" />
        <Form.Dropdown.Item value="🟢" title="🟢 Good Progress" />
        <Form.Dropdown.Item value="❤️" title="❤️ Loving It" />
        <Form.Dropdown.Item value="🤯" title="🤯 Mind Blown" />
        <Form.Dropdown.Item value="😭" title="😭 Hit Me in the Feels" />
        <Form.Dropdown.Item value="🤔" title="🤔 Mixed Feelings" />
        <Form.Dropdown.Item value="🔴" title="🔴 Getting Bit Stuck" />
        <Form.Dropdown.Item value="😮‍💨" title="😮‍💨 Getting a Bit Burnt Out" />
        <Form.Dropdown.Item value="⏸️" title="⏸️ Taking a Break" />
        <Form.Dropdown.Item value="🏁" title="🏁 Finished" />
        <Form.Dropdown.Item value="🛑" title="🛑 Dropping It" />
        <Form.Dropdown.Item value="🏃‍♂️‍➡️" title="🏃‍♂️‍➡️ Just Started" />
      </Form.Dropdown>
      {MOOD_HINTS[mood] && <Form.Description text={MOOD_HINTS[mood]} />}
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Optional bold title"
      />
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="Write your reflection..."
      />
    </Form>
  );
}
