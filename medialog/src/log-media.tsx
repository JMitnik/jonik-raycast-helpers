import {
  Grid,
  ActionPanel,
  Action,
  getPreferenceValues,
  Icon,
  Image,
  showToast,
  Toast,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import * as fs from "fs";
import {
  COLLECTIONS,
  IN_PROGRESS,
  MediaItem,
  STATUSES,
  Status,
  loadItems,
  statusesForCollection,
  updateStatus,
} from "./vault";
import LogThoughtForm from "./log-thought-form";

interface Preferences {
  vaultPath: string;
}

const STATUS_ICONS: Record<Status, Icon> = {
  "in progress": Icon.Play,
  "next up": Icon.ArrowRight,
  upcoming: Icon.Star,
  backlog: Icon.Tray,
  "to buy": Icon.Cart,
  finished: Icon.CheckCircle,
  dropped: Icon.XMarkCircle,
};

function titleCase(status: string): string {
  return status.replace(/\b\w/g, (c) => c.toUpperCase());
}

function bannerContent(item: MediaItem): Image.ImageLike {
  if (!item.banner) return Icon.Image;
  if (/^https?:\/\//i.test(item.banner)) return item.banner;
  // Local attachment path — only use it if it actually exists.
  if (fs.existsSync(item.banner)) return { source: item.banner };
  return Icon.Image;
}

export default function Command() {
  const { vaultPath } = getPreferenceValues<Preferences>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(IN_PROGRESS);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(() => {
    try {
      if (!fs.existsSync(vaultPath)) {
        showToast({
          style: Toast.Style.Failure,
          title: "Vault not found",
          message: vaultPath,
        });
        setIsLoading(false);
        return;
      }
      setItems(loadItems(vaultPath));
    } catch (e) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to read vault",
        message: String(e),
      });
    } finally {
      setIsLoading(false);
    }
  }, [vaultPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleSetStatus(item: MediaItem, status: Status) {
    try {
      updateStatus(item.filePath, status);
      await showToast({
        style: Toast.Style.Success,
        title: `${item.title} → ${titleCase(status)}`,
      });
      reload();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update status",
        message: String(e),
      });
    }
  }

  const visibleItems =
    statusFilter === "all"
      ? items
      : items.filter((i) => i.status === statusFilter);

  return (
    <Grid
      isLoading={isLoading}
      columns={4}
      aspectRatio="16/9"
      fit={Grid.Fit.Fill}
      searchBarPlaceholder="Search media…"
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Filter by Status"
          storeValue
          onChange={setStatusFilter}
        >
          {STATUSES.map((status) => (
            <Grid.Dropdown.Item
              key={status}
              value={status}
              title={titleCase(status)}
              icon={STATUS_ICONS[status]}
            />
          ))}
          <Grid.Dropdown.Item
            value="all"
            title="All Statuses"
            icon={Icon.Tag}
          />
        </Grid.Dropdown>
      }
    >
      {!isLoading && visibleItems.length === 0 && (
        <Grid.EmptyView
          icon={Icon.Tray}
          title={`No ${statusFilter === "all" ? "" : `'${statusFilter}' `}media`}
          description="Nothing in your collections matches this status."
        />
      )}
      {COLLECTIONS.map((collection) => {
        const sectionItems = visibleItems.filter(
          (i) => i.collectionKey === collection.key,
        );
        if (sectionItems.length === 0) return null;
        return (
          <Grid.Section
            key={collection.key}
            title={collection.title}
            subtitle={`${sectionItems.length}`}
          >
            {sectionItems.map((item) => (
              <Grid.Item
                key={item.filePath}
                content={bannerContent(item)}
                title={item.title}
                subtitle={
                  statusFilter === "all"
                    ? [titleCase(item.status), item.medium]
                        .filter(Boolean)
                        .join(" · ")
                    : item.medium
                }
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Log Thought"
                      icon={Icon.Pencil}
                      target={<LogThoughtForm item={item} onDidLog={reload} />}
                    />
                    <ActionPanel.Submenu
                      title="Set Status"
                      icon={Icon.Tag}
                      shortcut={{ modifiers: ["cmd"], key: "s" }}
                    >
                      {statusesForCollection(item.collectionKey)
                        .filter((s) => s !== item.status)
                        .map((status) => (
                          <Action
                            key={status}
                            title={titleCase(status)}
                            icon={STATUS_ICONS[status]}
                            onAction={() => handleSetStatus(item, status)}
                          />
                        ))}
                    </ActionPanel.Submenu>
                    <Action.ShowInFinder path={item.filePath} />
                    <Action.Open
                      title="Open in Obsidian"
                      target={item.filePath}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </Grid.Section>
        );
      })}
    </Grid>
  );
}
