import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { useLearningTray } from "./useLearningTray";

type Tray = ReturnType<typeof useLearningTray>;

function WordRow({ tray, entry }: { tray: Tray; entry: Tray["entries"][number] }) {
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(entry.term);
  const [meaning, setMeaning] = useState(entry.meaning);

  if (editing) {
    return (
      <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Word"
          className="w-full min-w-0 rounded-lg border-2 border-[var(--pp-line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={meaning}
          onChange={(event) => setMeaning(event.target.value)}
          aria-label="Meaning"
          className="w-full min-w-0 rounded-lg border-2 border-[var(--pp-line)] bg-white px-3 py-2 text-sm"
          dir="auto"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              tray.edit(entry.id, { term, meaning });
              setEditing(false);
            }}
            className="rita-btn rita-btn-primary rita-btn-sm"
            aria-label="Keep changes"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setTerm(entry.term);
              setMeaning(entry.meaning);
              setEditing(false);
            }}
            className="rita-btn rita-btn-secondary rita-btn-sm"
            aria-label="Cancel"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-center gap-1 py-3 sm:grid-cols-[1fr_1fr_auto]">
      <strong dir="auto">
        {entry.article ? `${entry.article} ` : ""}
        {entry.term}
      </strong>
      <span className="text-[var(--pp-muted)]" dir="auto">
        {entry.meaning}
      </span>
      <span className="flex items-center gap-1">
        <span className="me-2 text-xs font-bold uppercase text-[var(--pp-accent-text)]">
          {entry.language}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1.5 text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          aria-label={`Edit ${entry.term}`}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => tray.remove(entry.id)}
          className="rounded p-1.5 text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          aria-label={`Delete ${entry.term}`}
        >
          <Trash2 size={15} />
        </button>
      </span>
    </div>
  );
}

function CreateRow({
  label,
  placeholder,
  initial,
  disabled,
  onCreate,
}: {
  label: string;
  placeholder: string;
  initial?: string;
  disabled?: boolean;
  onCreate: (name: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(Boolean(initial));
  const [name, setName] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial) {
      setName(initial);
      setOpen(true);
    }
  }, [initial]);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--pp-accent-text)] disabled:opacity-40"
      >
        <Plus size={14} /> {label}
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex w-full gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        const id = await onCreate(name);
        setBusy(false);
        if (id) {
          setName("");
          setOpen(false);
        }
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 rounded-lg border-2 border-[var(--pp-line)] bg-white px-3 py-2 text-sm"
        dir="auto"
      />
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="rita-btn rita-btn-secondary rita-btn-sm disabled:opacity-40"
      >
        {busy ? <Loader2 className="animate-spin" size={15} /> : "Create"}
      </button>
    </form>
  );
}

function Picker({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-3">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rita-select w-full appearance-none !pr-10"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3.5" size={18} />
    </div>
  );
}

/** The learner's list of words they asked about, with the steps that turn it into flashcards. */
export function LearningTray({ tray }: { tray: Tray }) {
  if (!tray.open) return null;
  const { entries, target } = tray;
  const flashSelected = tray.flashOptions.find((option) => option.id === tray.destinationId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[#121117]/40 sm:items-center sm:justify-center"
      onClick={tray.closeTray}
    >
      <section
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 text-[var(--pp-ink)] shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--pp-accent-text)]">Words I asked about</p>
            <h2 className="text-2xl font-extrabold">
              {entries.length} word{entries.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button type="button" onClick={tray.closeTray} aria-label="Close">
            <X />
          </button>
        </div>

        {!entries.length ? (
          <p className="py-10 text-center text-[var(--pp-muted)]">
            Ask Rita what a word or phrase means, or how to say something. It will appear here.
          </p>
        ) : (
          <>
            <div className="mt-4 divide-y divide-[var(--pp-line)]">
              {entries.map((entry) => (
                <WordRow
                  key={`${entry.id}:${entry.term}:${entry.meaning}`}
                  tray={tray}
                  entry={entry}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={tray.clearAll}
              className="mt-2 text-xs font-bold text-[var(--pp-muted)] underline"
            >
              Clear the list
            </button>

            <div className="mt-6 rounded-2xl bg-[var(--pp-grey)] p-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["flashcards", "Flashcards", Layers],
                    ["german_lab", "German Lab", BookOpen],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      tray.setTarget(kind);
                      void tray.loadDestinations().catch(() => undefined);
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${target === kind ? "border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] text-[var(--pp-on-accent)]" : "border-2 border-transparent bg-white"}`}
                  >
                    <Icon className="mr-1 inline" size={15} />
                    {label}
                  </button>
                ))}
              </div>

              {target === "flashcards" ? (
                <>
                  <Picker
                    value={tray.destinationId}
                    onChange={tray.setDestinationId}
                    placeholder="Choose a subject…"
                  >
                    {tray.flashOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {"  ".repeat(option.depth)}
                        {option.label}
                      </option>
                    ))}
                  </Picker>
                  <div className="flex flex-wrap gap-x-5">
                    <CreateRow
                      label="New subject"
                      placeholder="Subject name"
                      initial={tray.suggestedName}
                      onCreate={(name) => tray.create("flash_subject", name, null)}
                    />
                    <CreateRow
                      key={flashSelected?.id ?? "none"}
                      label={
                        flashSelected
                          ? `New sub-subject in “${flashSelected.label}”`
                          : "New sub-subject"
                      }
                      placeholder="Sub-subject name"
                      disabled={!flashSelected}
                      onCreate={(name) => tray.create("flash_subject", name, flashSelected?.id)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Picker
                    value={tray.germanSubjectId}
                    onChange={(value) => {
                      tray.setGermanSubjectId(value);
                      tray.setDestinationId("");
                    }}
                    placeholder="Choose a German subject…"
                  >
                    {tray.destinations.germanSubjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Picker>
                  <CreateRow
                    label="New German subject"
                    placeholder="Subject name"
                    onCreate={(name) => tray.create("german_subject", name)}
                  />
                  <Picker
                    value={tray.destinationId}
                    onChange={tray.setDestinationId}
                    placeholder="Choose a topic…"
                  >
                    {tray.germanSubtopicOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Picker>
                  <CreateRow
                    key={tray.germanSubjectId || "none"}
                    label="New topic"
                    placeholder="Topic name"
                    disabled={!tray.germanSubjectId}
                    onCreate={(name) => tray.create("german_subtopic", name, tray.germanSubjectId)}
                  />
                </>
              )}

              <button
                type="button"
                onClick={() => void tray.save()}
                disabled={!tray.destinationId || tray.saving}
                className="rita-btn rita-btn-primary mt-3 !w-full !self-stretch gap-2 disabled:opacity-40"
              >
                {tray.saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Turn {entries.length} word{entries.length === 1 ? "" : "s"} into{" "}
                {target === "flashcards" ? "flashcards" : "German Lab words"}
              </button>
            </div>
          </>
        )}

        {tray.notice && (
          <p
            role="status"
            className={`mt-3 text-sm font-semibold ${tray.notice.tone === "error" ? "text-red-600" : ""}`}
          >
            {tray.notice.text}
          </p>
        )}
        <p className="mt-5 text-xs text-[var(--pp-muted)]">
          Only words you asked about are added. The list stays on this device until you save or
          delete them.
        </p>
      </section>
    </div>
  );
}
