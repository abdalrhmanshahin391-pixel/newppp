import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Check, ChevronRight, FolderPlus, Languages, Loader2, Plus } from "lucide-react";
import { germanAddPersonalEntry, germanCreateFolder, germanPersonalBoard } from "@/lib/german-content.functions";

type Kind = "words" | "sentences";
type SubjectLite = { id: string; title: string; parent_id: string | null; position: number };
type NewEntry = { id: string; german: string; english: string; subjectId: string; kind: Kind };

export function AddEntryDialog({
  open,
  onOpenChange,
  courseId,
  initialTab = "words",
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  initialTab?: Kind;
  onAdded: (entry: NewEntry) => void;
}) {
  const [tab, setTab] = useState<Kind>(initialTab);
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [german, setGerman] = useState("");
  const [english, setEnglish] = useState("");
  const [saving, setSaving] = useState(false);

  // inline subject creation state
  const [createOpen, setCreateOpen] = useState<"subject" | "subtopic" | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [creating, setCreating] = useState(false);
  const loadBoard = useServerFn(germanPersonalBoard);
  const createFolder = useServerFn(germanCreateFolder);
  const addEntry = useServerFn(germanAddPersonalEntry);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    void loadBoard({ data: { courseId } })
      .then((rows) => {
        const list = rows as SubjectLite[];
        setSubjects(list);
        const firstSubtopic = list.find((row) => row.parent_id);
        setSubjectId((current) => current || firstSubtopic?.id || "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load your German board"));
  }, [open, courseId]);

  const topLevel = useMemo(() => subjects.filter((row) => !row.parent_id), [subjects]);
  const grouped = useMemo(() => topLevel.map((subject) => ({
    ...subject,
    children: subjects.filter((row) => row.parent_id === subject.id),
  })), [subjects, topLevel]);

  const canSave = !!subjectId && german.trim().length > 0 && !saving;

  async function handleCreateSubject() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const isSubtopic = createOpen === "subtopic";
      if (isSubtopic && !parentId) return;
      const created = await createFolder({ data: { courseId, title, parentId: isSubtopic ? parentId : null } });
      const row = created as SubjectLite;
      setSubjects((current) => [...current, row]);
      if (isSubtopic) setSubjectId(row.id);
      else setParentId(row.id);
      setCreateOpen(isSubtopic ? null : "subtopic");
      setNewTitle("");
      toast.success(isSubtopic ? "Sub-subject created" : "Subject created — now add a sub-subject");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create subject");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await addEntry({ data: {
        courseId,
        subtopicId: subjectId,
        kind: tab,
        entries: [{ german: german.trim(), english: english.trim() }],
      } });
      const inserted = result.entries[0];
      if (!inserted) throw new Error("The entry was not saved.");
      onAdded({ id: inserted.id, german: inserted.german, english: inserted.english, subjectId, kind: tab });
      setGerman("");
      setEnglish("");
      toast.success(`Added to ${subjects.find((s) => s.id === subjectId)?.title ?? "subject"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Add German material</DialogTitle>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-2 rounded-2xl bg-muted p-1.5">
          {(["words", "sentences"] as Kind[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`h-12 rounded-xl text-sm font-extrabold transition ${
                tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "words" ? "Words" : "Sentences"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-base font-black">Choose where it belongs</div>
              <div className="text-xs font-semibold text-muted-foreground">Subject → sub-subject, just like Archive Questions</div>
            </div>
            <Button
              type="button"
              onClick={() => setCreateOpen("subject")}
              className="h-11 rounded-2xl px-4 font-extrabold"
            >
              <FolderPlus className="size-4" /> New subject
            </Button>
          </div>

          {createOpen && (
            <div className="mb-4 space-y-3 rounded-2xl border border-border bg-cream p-4">
              <p className="font-extrabold">{createOpen === "subject" ? "Create a subject" : "Create a sub-subject"}</p>
              {createOpen === "subtopic" && (
                <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 font-bold">
                  <option value="">Choose its subject</option>
                  {topLevel.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                </select>
              )}
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={createOpen === "subject" ? "e.g. Daily life" : "e.g. At the supermarket"}
                className="h-12 w-full rounded-xl border border-input bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setCreateOpen(null); setNewTitle(""); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!newTitle.trim() || creating || (createOpen === "subtopic" && !parentId)}
                  onClick={handleCreateSubject}
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  {creating ? "Creating…" : `Create ${createOpen === "subject" ? "subject" : "sub-subject"}`}
                </Button>
              </div>
            </div>
          )}

          {subjects.length === 0 ? (
            <button onClick={() => setCreateOpen("subject")} className="grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-cream text-center">
              <span><Plus className="mx-auto mb-2 size-6 text-primary" /><strong className="block">Create your first subject</strong><small className="text-muted-foreground">Then add a sub-subject inside it</small></span>
            </button>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {grouped.map((subject, subjectIndex) => (
                <section key={subject.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <header className="flex min-h-16 items-center gap-3 bg-cream px-4">
                    <BookOpen className="size-5 text-primary" />
                    <span className="flex-1 text-base font-black">{subject.title}</span>
                    <Button variant="ghost" size="sm" onClick={() => { setParentId(subject.id); setCreateOpen("subtopic"); }}><Plus className="size-4" /> Sub-subject</Button>
                  </header>
                  <div className="space-y-2 p-2">
                    {subject.children.map((child, childIndex) => {
                      const active = child.id === subjectId;
                      return (
                        <button key={child.id} onClick={() => setSubjectId(child.id)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                          <span className="w-7 text-xs font-black text-muted-foreground">{String(subjectIndex + 1).padStart(2, "0")}.{childIndex + 1}</span>
                          <span className={`grid size-7 place-items-center rounded-lg border-2 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{active && <Check className="size-4" />}</span>
                          <span className="flex-1 font-extrabold">{child.title}</span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                    {subject.children.length === 0 && <button onClick={() => { setParentId(subject.id); setCreateOpen("subtopic"); }} className="h-14 w-full rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground">+ Add the first sub-subject</button>}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <input
            value={german}
            onChange={(e) => setGerman(e.target.value)}
            placeholder={tab === "words" ? "German word (e.g. Hund)" : "German sentence"}
            className="h-14 w-full rounded-xl border border-input px-4 text-base font-bold outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={english}
            onChange={(e) => setEnglish(e.target.value)}
            placeholder="Translation (optional)"
            className="h-14 w-full rounded-xl border border-input px-4 text-base font-bold outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="h-12 rounded-2xl px-6 font-extrabold"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
            {saving ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
