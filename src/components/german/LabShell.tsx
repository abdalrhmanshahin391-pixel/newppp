import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeBoard, playableCount } from "@/components/german/DeBoard";
import { useDeTree } from "@/lib/use-de-lab";
import type { LabMode } from "@/lib/de-lab";
import { WorkspaceHeader } from "@/components/common/LaunchPanel";

type Props = {
  mode: LabMode;
  accent: string;
  title: string;
  description: ReactNode;
  signedIn: boolean;
  loading: boolean;
  signedOutHint: string;
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** Modes, toggles and the start button — rendered inside the sticky panel. */
  panel: ReactNode;
  children?: ReactNode;
};

/**
 * Shared two-column workspace for the German labs: subjects scroll on the left,
 * the session panel stays pinned on the right (a bottom sheet on mobile), so the
 * Start button never sinks below a long subject list.
 */
export function LabShell({
  mode,
  accent,
  title,
  description,
  signedIn,
  loading,
  signedOutHint,
  selected,
  onSelect,
  panel,
  children,
}: Props) {
  const tree = useDeTree(mode);
  const chips = tree.subjects
    .flatMap((s) => s.subtopics)
    .filter((t) => selected.includes(t.id))
    .map((t) => ({ ...t, playable: playableCount(t, mode) }));
  const playable = chips.reduce((n, t) => n + t.playable, 0);
  const skipped = chips.reduce((n, t) => n + Math.max(0, (t.items ?? 0) - t.playable), 0);

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-[86rem] px-4 py-8 md:px-8 md:py-10">
        <WorkspaceHeader
          back={
            <Link to="/german" className="text-[13px] font-extrabold text-[#6b645b] hover:text-[#23201d]">
              ← German Lab
            </Link>
          }
          eyebrow={mode === "articles" ? "German · der die das" : mode === "build" ? "German · build it" : "German · speaking"}
          title={title}
          description={description}
          stats={[
            { label: "Subjects", value: tree.subjects.length },
            {
              label: "Items",
              value: tree.subjects.reduce((n, s) => n + (s.items ?? 0), 0),
            },
            { label: "Selected", value: selected.length },
          ]}
        />

        {loading ? null : !signedIn ? (
          <p className="mt-8 rounded-2xl bg-white p-6 text-[15px] font-bold">
            <Link to="/login" className="underline">
              Sign in
            </Link>{" "}
            {signedOutHint}
          </p>
        ) : (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <DeBoard mode={mode} accent={accent} selected={selected} onSelect={onSelect} />

            <aside className="lg:sticky lg:top-6">
              <div className="rounded-[26px] border border-black/[0.07] bg-white p-5 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.4)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
                  This round
                </p>
                {chips.length === 0 ? (
                  <p className="mt-2 text-[13.5px] font-bold text-[#8a8175]">
                    Nothing selected yet — tick a sub-subject on the left.
                  </p>
                ) : (
                  <>
                    <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                      {chips.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onSelect(selected.filter((x) => x !== t.id))}
                          className="inline-flex items-center gap-1 rounded-full bg-[#f3ece0] px-2.5 py-1 text-[12px] font-extrabold text-[#5a4a2e] hover:bg-[#e9dfcd]"
                        >
                          {t.name} · {t.playable} <X size={12} />
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px] font-bold text-[#8a8175]">
                      {playable} item{playable === 1 ? "" : "s"} to practise here
                      {skipped > 0 && (
                        <span className="text-[#b0a696]"> · {skipped} not for this lab</span>
                      )}
                    </p>
                    <button
                      onClick={() => onSelect([])}
                      className="mt-2 text-[12px] font-extrabold text-[#a89e90] hover:text-[#b13636]"
                    >
                      Clear selection
                    </button>
                  </>
                )}

                <div className="mt-4 border-t border-black/[0.06] pt-4">{panel}</div>
              </div>
            </aside>
          </div>
        )}
      </main>
      {children}
    </div>
  );
}
