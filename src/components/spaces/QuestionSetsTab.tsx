// Question sets shared inside a classroom or group: practice and exam questions from the Question
// Bank, the exam archive or Lecture Lab. Whoever may add decks can share a set; owners remove them.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ListChecks, Plus, Star, Trash2 } from "lucide-react";
import {
  SOURCE_TYPE_META,
  coverOf,
  fetchSpaceQuestionSets,
  removeQuestionSetFromSpace,
} from "@/lib/share-questions";
import { plural } from "./SpaceCard";
import { Mark, Spin, errorText, type ConfirmFn } from "./shared";

export function QuestionSetsTab({
  spaceId,
  canAdd,
  canManage,
  onChanged,
  confirm,
}: {
  spaceId: string;
  canAdd: boolean;
  canManage: boolean;
  onChanged: () => Promise<void>;
  confirm: ConfirmFn;
}) {
  const query = useQuery({
    queryKey: ["space-question-sets", spaceId],
    queryFn: () => fetchSpaceQuestionSets(spaceId),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const sets = query.data ?? [];

  const share = canAdd && (
    <Link
      to="/share/questions/new"
      search={{ space: spaceId, source: "lecture" }}
      className="sp-btn sp-btn-dark"
    >
      <Plus size={16} aria-hidden="true" />
      Share questions
    </Link>
  );

  return (
    <div className="sp-stack-lg">
      <div className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h2 className="sp-h3">Question sets</h2>
          {!query.isLoading && <span className="sp-chip">{plural(sets.length, "set")}</span>}
        </div>
        <div className="sp-toolbar-actions">{sets.length > 0 && share}</div>
      </div>

      {query.isLoading ? (
        <div className="sp-decks" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sp-deck sp-deck-skel">
              <span className="sp-bone sp-bone-mark" />
              <span className="sp-bone sp-bone-line" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p className="sp-state-text" role="alert">
          The question sets could not be loaded. Refresh the page to try again.
        </p>
      ) : sets.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon" aria-hidden="true">
            <ListChecks size={22} />
          </span>
          <h3 className="sp-empty-title">No question sets yet</h3>
          <p className="sp-empty-text">
            Share questions from the Question Bank, the exam archive or Lecture Lab, and everyone
            here can practise them.
          </p>
          {share}
        </div>
      ) : (
        <div className="sp-decks">
          {sets.map((set) => {
            const cover = coverOf(set.cover);
            const source = SOURCE_TYPE_META[set.source_type || "lecture"];
            const rated = (set.rating_count ?? 0) > 0;
            return (
              <article key={set.id} className="sp-deck">
                <div className="sp-deck-top">
                  <Mark from={cover.from} to={cover.to} emoji={set.emoji || "❓"} size={46} />
                  <div className="sp-deck-copy">
                    <h4 className="sp-deck-title" dir="auto">
                      <Link to="/share/questions/$setId" params={{ setId: set.id }}>
                        {set.title}
                      </Link>
                    </h4>
                    <p className="sp-deck-meta">
                      {plural(set.question_count ?? 0, "question")}
                      <span aria-hidden="true"> · </span>
                      {source?.label ?? "Questions"}
                    </p>
                  </div>
                </div>
                {set.description?.trim() && (
                  <p className="sp-deck-desc" dir="auto">
                    {set.description}
                  </p>
                )}
                <div className="sp-deck-foot">
                  <Link
                    to="/share/questions/$setId"
                    params={{ setId: set.id }}
                    className="sp-btn sp-btn-dark sp-btn-sm"
                    aria-label={`Practise ${set.title}`}
                  >
                    Practise
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                  {rated && (
                    <span className="sp-rating" title={`${set.rating_count} ratings`}>
                      <Star size={14} aria-hidden="true" />
                      {Number(set.rating_avg ?? 0).toFixed(1)}
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm sp-text-danger sp-push-end"
                      aria-label={`Remove ${set.title} from here`}
                      title="Remove from here"
                      disabled={busy === set.id}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove “${set.title}”?`,
                          text: "It leaves this space only. The question set itself is not deleted.",
                          confirm: "Remove",
                          danger: true,
                        });
                        if (!ok) return;
                        setBusy(set.id);
                        try {
                          await removeQuestionSetFromSpace(spaceId, set.id);
                          await onChanged();
                          toast.success("Question set removed from here");
                        } catch (error) {
                          toast.error(errorText(error, "Could not remove the question set."));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === set.id ? <Spin /> : <Trash2 size={15} aria-hidden="true" />}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
