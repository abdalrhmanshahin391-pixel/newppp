// The shared library of a classroom or group: folders, each with its decks. Owners make, rename
// and delete folders and move or remove decks; whoever may add decks adds them into a folder.
import { useMemo, useState, type FormEvent } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  Check,
  FolderOpen,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  addFolder,
  deleteFolder,
  moveDeck,
  removeDeckFromSpace,
  renameFolder,
  useSpaceDecks,
  useSpaceFolders,
  type SpaceDeck,
  type SpaceFolder,
  type SpaceMember,
} from "@/lib/spaces";
import { DeckTile } from "./DeckTile";
import { plural } from "./SpaceCard";
import { Spin, errorText, type ConfirmFn } from "./shared";

const UNSORTED = "none";

export function DecksTab({
  spaceId,
  members,
  canAdd,
  canManage,
  onChanged,
  onAdd,
  confirm,
}: {
  spaceId: string;
  members: SpaceMember[];
  canAdd: boolean;
  canManage: boolean;
  onChanged: () => Promise<void>;
  /** Opens the deck picker for a folder (`null` = unsorted). */
  onAdd: (folderId: string | null, folderName: string | null) => void;
  confirm: ConfirmFn;
}) {
  const folders = useSpaceFolders(spaceId);
  const decks = useSpaceDecks(spaceId);
  const myId = useAuth().user?.id ?? null;
  const [query, setQuery] = useState("");
  const [making, setMaking] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.username ?? null;

  const q = query.trim().toLowerCase();
  const grouped = useMemo(() => {
    const map = new Map<string, SpaceDeck[]>();
    for (const row of decks.data ?? []) {
      if (q && !row.deck.title.toLowerCase().includes(q)) continue;
      const key = row.folder_id ?? UNSORTED;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [decks.data, q]);

  const folderList = folders.data ?? [];
  const total = decks.data?.length ?? 0;
  const buckets = [
    ...folderList.map((f) => ({ id: f.id, name: f.name })),
    { id: UNSORTED, name: "Unsorted" },
  ];

  async function makeFolder(event: FormEvent) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await addFolder(spaceId, name, folderList.length);
      await onChanged();
      setFolderName("");
      setMaking(false);
      toast.success(`Folder “${name}” added`);
    } catch (error) {
      toast.error(errorText(error, "Could not add the folder."));
    } finally {
      setSaving(false);
    }
  }

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      await renameFolder(renaming.id, name);
      await onChanged();
      setRenaming(null);
    } catch (error) {
      toast.error(errorText(error, "Could not rename the folder."));
    } finally {
      setSaving(false);
    }
  }

  async function move(row: SpaceDeck, folderId: string | null) {
    setBusyRow(row.id);
    try {
      await moveDeck(row.id, folderId);
      await onChanged();
      const target = folderId ? folderList.find((f) => f.id === folderId)?.name : "Unsorted";
      toast.success(`Moved to ${target ?? "the folder"}`);
    } catch (error) {
      toast.error(errorText(error, "Could not move the deck."));
    } finally {
      setBusyRow(null);
    }
  }

  async function remove(row: SpaceDeck) {
    const ok = await confirm({
      title: `Remove “${row.deck.title}”?`,
      text: "It leaves this space only. The deck itself is not deleted.",
      confirm: "Remove",
      danger: true,
    });
    if (!ok) return;
    setBusyRow(row.id);
    try {
      await removeDeckFromSpace(row.id);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error, "Could not remove this deck."));
    } finally {
      setBusyRow(null);
    }
  }

  if (decks.isLoading || folders.isLoading) {
    return (
      <div className="sp-decks" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sp-deck sp-deck-skel">
            <span className="sp-bone sp-bone-mark" />
            <span className="sp-bone sp-bone-line" />
            <span className="sp-bone sp-bone-line sp-bone-short" />
          </div>
        ))}
      </div>
    );
  }

  if (decks.isError || folders.isError) {
    return (
      <p className="sp-state-text" role="alert">
        The decks could not be loaded. Refresh the page to try again.
      </p>
    );
  }

  const nothingYet = total === 0 && folderList.length === 0;

  return (
    <div className="sp-stack-lg">
      <div className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h2 className="sp-h3">Decks</h2>
          <span className="sp-chip">{plural(total, "deck")}</span>
        </div>
        <div className="sp-toolbar-actions">
          {total > 8 && (
            <label className="sp-search">
              <Search size={16} aria-hidden="true" />
              <span className="sp-sr">Search decks</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search decks"
              />
            </label>
          )}
          {canManage && !making && (
            <button type="button" className="sp-btn sp-btn-light" onClick={() => setMaking(true)}>
              <FolderPlus size={16} aria-hidden="true" />
              New folder
            </button>
          )}
          {canAdd && (
            <button type="button" className="sp-btn sp-btn-dark" onClick={() => onAdd(null, null)}>
              <Plus size={16} aria-hidden="true" />
              Add deck
            </button>
          )}
        </div>
      </div>

      {making && (
        <form className="sp-inline-form" onSubmit={makeFolder}>
          <FolderOpen size={18} aria-hidden="true" className="sp-inline-icon" />
          <label className="sp-sr" htmlFor="sp-new-folder">
            Folder name
          </label>
          <input
            id="sp-new-folder"
            className="sp-input"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Week 1 · Heart sounds"
            maxLength={60}
            autoFocus
            dir="auto"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMaking(false);
                setFolderName("");
              }
            }}
          />
          <button
            type="submit"
            className="sp-btn sp-btn-dark"
            disabled={saving || !folderName.trim()}
          >
            {saving && <Spin />}
            Add folder
          </button>
          <button
            type="button"
            className="sp-btn sp-btn-ghost"
            onClick={() => {
              setMaking(false);
              setFolderName("");
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {nothingYet ? (
        <div className="sp-empty">
          <span className="sp-empty-icon" aria-hidden="true">
            <Inbox size={22} />
          </span>
          <h3 className="sp-empty-title">No decks here yet</h3>
          <p className="sp-empty-text">
            {canAdd
              ? "Add one of your shared decks and everyone in here can study it."
              : "When the owners add decks, they show up here, sorted into folders."}
          </p>
          {canAdd && (
            <button type="button" className="sp-btn sp-btn-dark" onClick={() => onAdd(null, null)}>
              <Plus size={16} aria-hidden="true" />
              Add the first deck
            </button>
          )}
        </div>
      ) : q && grouped.size === 0 ? (
        <p className="sp-state-text">No deck matches “{query.trim()}”.</p>
      ) : (
        buckets.map((bucket) => {
          const items = grouped.get(bucket.id) ?? [];
          const unsorted = bucket.id === UNSORTED;
          // Unsorted only shows when it holds something (or when there are no folders at all).
          if (unsorted && items.length === 0 && folderList.length > 0) return null;
          if (q && items.length === 0) return null;
          const editing = renaming?.id === bucket.id;
          return (
            <section key={bucket.id} className="sp-folder" aria-label={bucket.name}>
              <div className="sp-folder-head">
                {editing ? (
                  <form className="sp-folder-rename" onSubmit={saveRename}>
                    <label className="sp-sr" htmlFor={`sp-rename-${bucket.id}`}>
                      Folder name
                    </label>
                    <input
                      id={`sp-rename-${bucket.id}`}
                      className="sp-input sp-input-sm"
                      value={renaming?.name ?? ""}
                      maxLength={60}
                      autoFocus
                      dir="auto"
                      onChange={(event) => setRenaming({ id: bucket.id, name: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setRenaming(null);
                      }}
                    />
                    <button
                      type="submit"
                      className="sp-btn sp-btn-dark sp-btn-sm"
                      disabled={saving || !renaming?.name.trim()}
                    >
                      {saving && <Spin />}
                      Save
                    </button>
                    <button
                      type="button"
                      className="sp-btn sp-btn-ghost sp-btn-sm"
                      onClick={() => setRenaming(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <FolderOpen size={18} aria-hidden="true" className="sp-folder-icon" />
                    <h3 className="sp-folder-name" dir="auto">
                      {bucket.name}
                    </h3>
                    <span className="sp-folder-count">{items.length}</span>
                    <div className="sp-folder-tools">
                      {canAdd && (
                        <button
                          type="button"
                          className="sp-btn sp-btn-ghost sp-btn-sm"
                          onClick={() =>
                            onAdd(unsorted ? null : bucket.id, unsorted ? null : bucket.name)
                          }
                        >
                          <Plus size={15} aria-hidden="true" />
                          Add here
                        </button>
                      )}
                      {canManage && !unsorted && (
                        <>
                          <button
                            type="button"
                            className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm"
                            aria-label={`Rename ${bucket.name}`}
                            title="Rename"
                            onClick={() => setRenaming({ id: bucket.id, name: bucket.name })}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm sp-text-danger"
                            aria-label={`Delete ${bucket.name}`}
                            title="Delete folder"
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete “${bucket.name}”?`,
                                text: "The folder goes away. Its decks stay here and move to Unsorted.",
                                confirm: "Delete folder",
                                danger: true,
                              });
                              if (!ok) return;
                              try {
                                await deleteFolder(bucket.id);
                                await onChanged();
                              } catch (error) {
                                toast.error(errorText(error, "Could not delete the folder."));
                              }
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {items.length === 0 ? (
                canAdd ? (
                  <button
                    type="button"
                    className="sp-drop"
                    onClick={() =>
                      onAdd(unsorted ? null : bucket.id, unsorted ? null : bucket.name)
                    }
                  >
                    <Plus size={18} aria-hidden="true" />
                    Add the first deck to {unsorted ? "this space" : bucket.name}
                  </button>
                ) : (
                  <p className="sp-state-text sp-state-quiet">No decks in this folder yet.</p>
                )
              ) : (
                <div className="sp-decks">
                  {items.map((row) => {
                    const mine = row.added_by === myId;
                    const tools =
                      canManage || mine ? (
                        <DeckMenu
                          title={row.deck.title}
                          folderId={row.folder_id}
                          folders={canManage ? folderList : null}
                          busy={busyRow === row.id}
                          onMove={(folderId) => void move(row, folderId)}
                          onRemove={() => void remove(row)}
                        />
                      ) : null;
                    return (
                      <DeckTile
                        key={row.id}
                        row={row}
                        spaceId={spaceId}
                        addedBy={nameOf(row.added_by)}
                        tools={tools}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

/** «⋯» on a deck: move it to another folder (owners) or take it out of this space. */
function DeckMenu({
  title,
  folderId,
  folders,
  busy,
  onMove,
  onRemove,
}: {
  title: string;
  folderId: string | null;
  folders: SpaceFolder[] | null;
  busy: boolean;
  onMove: (folderId: string | null) => void;
  onRemove: () => void;
}) {
  const targets: { id: string | null; name: string }[] = folders
    ? [{ id: null, name: "Unsorted" }, ...folders.map((f) => ({ id: f.id, name: f.name }))]
    : [];
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button
          type="button"
          className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm sp-push-end"
          aria-label={`Options for ${title}`}
          disabled={busy}
        >
          {busy ? <Spin /> : <MoreHorizontal size={17} aria-hidden="true" />}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="sp sp-menu">
          {targets.length > 0 && (
            <>
              <Menu.Label className="sp-menu-label">Move to</Menu.Label>
              {targets.map((target) => {
                const here = (folderId ?? null) === target.id;
                return (
                  <Menu.Item
                    key={target.id ?? "unsorted"}
                    className="sp-menu-item"
                    disabled={here}
                    onSelect={() => onMove(target.id)}
                  >
                    {here ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <FolderOpen size={16} aria-hidden="true" />
                    )}
                    <span className="sp-menu-text" dir="auto">
                      {target.name}
                    </span>
                  </Menu.Item>
                );
              })}
              <Menu.Separator className="sp-menu-sep" />
            </>
          )}
          <Menu.Item className="sp-menu-item sp-menu-danger" onSelect={onRemove}>
            <Trash2 size={16} aria-hidden="true" />
            Remove from here
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
