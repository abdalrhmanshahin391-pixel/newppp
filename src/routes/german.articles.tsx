import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Flag, GraduationCap, Loader2, Play } from "lucide-react";
import { LabShell } from "@/components/german/LabShell";
import { ArticleGame, type ArticleMode } from "@/components/german/ArticleGame";
import { useDeItems } from "@/lib/use-de-lab";
import { shuffle } from "@/lib/de-lab";
import { useAuth } from "@/hooks/useAuth";
import { Segmented, ToggleChip } from "@/components/german/LabControls";

const ACCENT = "#2f6fd0";

export const Route = createFileRoute("/german/articles")({
  head: () => ({
    meta: [
      { title: "Article Lab — der, die, das trainer | RitaJet" },
      {
        name: "description",
        content:
          "Train German noun genders with a colour-coded der/die/das game: tap mode, beat the clock and an endings coach, all sorted into your own subjects.",
      },
      { property: "og:title", content: "Article Lab — der, die, das trainer" },
      { property: "og:description", content: "Colour-coded German article training with instant audio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticleLab,
});

const MODES = [
  { key: "tap", label: "Tap", hint: "Calm and steady, misses come back", icon: <Play size={14} /> },
  { key: "clock", label: "Clock", hint: "60 seconds, build a streak", icon: <Clock size={14} /> },
  { key: "endings", label: "Endings", hint: "Learn the rule behind each word", icon: <GraduationCap size={14} /> },
] as const satisfies readonly { key: ArticleMode; label: string; hint: string; icon: React.ReactNode }[];

function ArticleLab() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [mode, setMode] = useState<ArticleMode>("tap");
  const [playing, setPlaying] = useState(false);
  const items = useDeItems(selected, flaggedOnly);

  const nouns = useMemo(() => (items.data ?? []).filter((i) => i.article), [items.data]);

  return (
    <LabShell
      mode="articles"
      accent={ACCENT}
      title="Article Lab"
      description={
        <>
          Pick the sub-subjects you want, choose a mode and play. <b style={{ color: "#2f6fd0" }}>der</b> is
          blue, <b style={{ color: "#d94a4a" }}>die</b> is red, <b style={{ color: "#2f9e63" }}>das</b> is
          green — everywhere in the app.
        </>
      }
      signedIn={!!user}
      loading={loading}
      signedOutHint="to build your German subjects."
      selected={selected}
      onSelect={setSelected}
      panel={
        <div>
          <Segmented
            label="Mode"
            value={mode}
            options={MODES}
            accent={ACCENT}
            columns={3}
            onChange={(k) => setMode(k as ArticleMode)}
          />
          <ToggleChip on={flaggedOnly} icon={<Flag size={14} />} onClick={() => setFlaggedOnly((v) => !v)}>
            Flagged only
          </ToggleChip>

          <button
            disabled={nouns.length < 3}
            onClick={() => setPlaying(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, boxShadow: "0 14px 30px -18px rgba(47,111,208,0.9)" }}
          >
            {items.isFetching ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            Start round
          </button>
          <p className="mt-2 text-center text-[12.5px] font-bold text-[#8a8175]">
            {selected.length === 0
              ? "Select at least one sub-subject."
              : `${nouns.length} nouns ready · ${MODES.find((m) => m.key === mode)!.hint}`}
          </p>
        </div>
      }
    >
      {playing && nouns.length >= 3 && (
        <ArticleGame items={shuffle(nouns)} mode={mode} onClose={() => setPlaying(false)} />
      )}
    </LabShell>
  );
}
