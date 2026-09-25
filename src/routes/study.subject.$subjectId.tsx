import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Plus, Trash2 } from "lucide-react";
import { StudyLayout, StudyHeading } from "@/components/study/StudyLayout";
import { SignedOutPanel } from "@/components/study/SignedOutPanel";
import { useAuth } from "@/hooks/useAuth";
import {
  colorOf,
  createCards,
  deleteCard,
  fetchCards,
  fetchSubjects,
  parseBatch,
} from "@/lib/flashcards";

export const Route = createFileRoute("/study/subject/$subjectId")({
  head: () => ({
    meta: [
      { title: "Subject — RitaJet flashcards" },
      { name: "description", content: "Add and review the flashcards inside one of your subjects." },
      { property: "og:title", content: "Subject — RitaJet flashcards" },
      { property: "og:description", content: "Add cards to a subject and study them straight away." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const subjects = useQuery({ queryKey: ["flash-subjects"], queryFn: fetchSubjects, enabled: !!user });
  const subject = (subjects.data ?? []).find((s) => s.id === subjectId);
  const subs = (subjects.data ?? []).filter((s) => s.parent_id === subjectId);
  const ids = [subjectId, ...subs.map((s) => s.id)];

  const cards = useQuery({
    queryKey: ["flash-cards", ids.join(",")],
    queryFn: () => fetchCards(ids),
    enabled: !!user && subjects.isSuccess,
  });

  const remove = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-cards"] });
      qc.invalidateQueries({ queryKey: ["flash-counts"] });
    },
  });

  const list = cards.data ?? [];
  const c = colorOf(subject?.color ?? "apricot");

  const rail = user
    ? [
        { label: "All subjects", icon: <ArrowLeft size={15} />, to: "/study" },
        { label: "Add cards", icon: <Plus size={15} />, onClick: () => setAdding(true) },
        ...(list.length > 0
          ? [
              {
                label: "Study this subject",
                icon: <Play size={15} />,
                onClick: () => navigate({ to: "/study/session", search: { ids: ids.join(",") } }),
              },
            ]
          : []),
      ]
    : [{ label: "Sign in", to: "/login" }];

  return (
    <StudyLayout rail={rail}>
      {!user ? (
        <SignedOutPanel what="your flashcards" />
      ) : (
        <>
          <StudyHeading
            eyebrow={subs.length > 0 ? `${subs.length} sub-subjects` : "Flashcards"}
            title={subject?.name ?? "Subject"}
            aside={
              list.length > 0 ? (
                <Link
                  to="/study/session"
                  search={{ ids: ids.join(",") }}
                  className="rita-pill hidden h-12 items-center gap-2 rounded-full px-7 text-[15px] font-semibold sm:inline-flex"
                >
                  <Play size={15} /> Study
                </Link>
              ) : undefined
            }
          />

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#6d665c]">
            {list.length} card{list.length === 1 ? "" : "s"} in this subject
            {subs.length > 0 && " and its sub-subjects"}.
          </p>

          {adding && (
            <AddCards
              subjectId={subjectId}
              subs={subs.map((s) => ({ id: s.id, name: s.name }))}
              parentName={subject?.name ?? ""}
              onClose={() => setAdding(false)}
              onSaved={() => {
                setAdding(false);
                qc.invalidateQueries({ queryKey: ["flash-cards"] });
                qc.invalidateQueries({ queryKey: ["flash-counts"] });
              }}
            />
          )}

          <div className="mt-10 grid gap-3 lg:grid-cols-2">
            {list.map((card) => (
              <div key={card.id} className="group relative rounded-2xl bg-white p-5 pr-12">
                <span
                  className="absolute left-0 top-5 h-8 w-1 rounded-r-full"
                  style={{ background: c.dot }}
                />
                <p className="text-[15px] font-bold leading-snug">{card.front}</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#6d665c]">{card.back}</p>
                <button
                  type="button"
                  onClick={() => remove.mutate(card.id)}
                  className="absolute right-3 top-3 hidden rounded-full p-1.5 text-[#c2b9aa] hover:text-[#c4664f] group-hover:block"
                  aria-label="Delete card"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {cards.isSuccess && list.length === 0 && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex min-h-[7rem] flex-col items-start justify-center gap-1.5 rounded-2xl border border-dashed border-black/15 px-6 text-left"
              >
                <span className="text-[15px] font-bold">Add your first cards</span>
                <span className="text-[13.5px] text-[#8b8377]">
                  One per line: question | answer
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </StudyLayout>
  );
}

function AddCards({
  subjectId,
  subs,
  parentName,
  onClose,
  onSaved,
}: {
  subjectId: string;
  subs: { id: string; name: string }[];
  parentName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState(subjectId);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [batch, setBatch] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const rows = batch.trim() ? parseBatch(batch) : [];
      if (front.trim() && back.trim()) rows.unshift({ front: front.trim(), back: back.trim() });
      if (rows.length === 0) throw new Error("Nothing to save");
      await createCards(target, rows);
    },
    onSuccess: onSaved,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="mt-8 max-w-2xl rounded-3xl bg-white p-6 md:p-8"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="text-[17px] font-bold">Add cards</h2>
        {subs.length > 0 && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-11 rounded-2xl bg-[#fbf5e9] px-4 text-[14px] font-semibold outline-none"
          >
            <option value={subjectId}>{parentName}</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <input
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder="Front — the question"
        className="mt-5 h-12 w-full rounded-2xl bg-[#fbf5e9] px-4 text-[15px] outline-none placeholder:text-[#b3aa9c]"
      />
      <input
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder="Back — the answer"
        className="mt-3 h-12 w-full rounded-2xl bg-[#fbf5e9] px-4 text-[15px] outline-none placeholder:text-[#b3aa9c]"
      />

      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.15em] text-[#b3aa9c]">
        Or paste many at once
      </p>
      <textarea
        value={batch}
        onChange={(e) => setBatch(e.target.value)}
        rows={4}
        placeholder={"question | answer\nquestion | answer"}
        className="mt-2 w-full rounded-2xl bg-[#fbf5e9] p-4 text-[14.5px] leading-relaxed outline-none placeholder:text-[#b3aa9c]"
      />

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rita-pill inline-flex h-12 items-center rounded-full px-8 text-[15px] font-semibold disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save cards"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-[#8b8377]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
