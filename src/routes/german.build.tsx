import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Blocks, Flag, Loader2, Play, Shuffle, Type } from "lucide-react";
import { LabShell } from "@/components/german/LabShell";
import { BuildGame, type BuildLevel } from "@/components/german/BuildGame";
import { useDeItems } from "@/lib/use-de-lab";
import { buildRound } from "@/lib/de-lab";
import { useAuth } from "@/hooks/useAuth";
import { Segmented, ToggleChip } from "@/components/german/LabControls";

const ACCENT = "#7a5cc4";

export const Route = createFileRoute("/german/build")({
  head: () => ({
    meta: [
      { title: "Build Lab — German word & sentence order game | RitaJet" },
      {
        name: "description",
        content:
          "Tap the pieces back into place: order the words of a German sentence or the syllables of a single word, with native audio after every correct build.",
      },
      { property: "og:title", content: "Build Lab — German word order game" },
      {
        property: "og:description",
        content: "Order the words of a sentence or the syllables of a word, straight from your own subjects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildLab,
});

const LEVELS = [
  { key: "mix", label: "Mix", hint: "Sentences and words together", icon: <Shuffle size={14} /> },
  { key: "sentence", label: "Sentence", hint: "Which word comes first", icon: <Blocks size={14} /> },
  { key: "word", label: "Syllables", hint: "Nacht = Na + cht", icon: <Type size={14} /> },
] as const satisfies readonly { key: BuildLevel; label: string; hint: string; icon: React.ReactNode }[];

function BuildLab() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [level, setLevel] = useState<BuildLevel>("mix");
  const [playing, setPlaying] = useState(false);
  const items = useDeItems(selected, flaggedOnly);

  const playable = useMemo(
    () => (items.data ?? []).filter((i) => !!buildRound(i, level)),
    [items.data, level],
  );


  return (
    <LabShell
      mode="build"
      accent={ACCENT}
      title="Build Lab"
      description={
        <>
          Same shelf as every other German mode. Pick a sub-subject and rebuild what you hear — the{" "}
          <b style={{ color: ACCENT }}>word order</b> of a sentence, or the{" "}
          <b style={{ color: ACCENT }}>syllables</b> of a single word.
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
            label="Pieces"
            value={level}
            options={LEVELS}
            accent={ACCENT}
            columns={3}
            onChange={(k) => setLevel(k as BuildLevel)}
          />
          <ToggleChip on={flaggedOnly} icon={<Flag size={14} />} onClick={() => setFlaggedOnly((v) => !v)}>
            Flagged only
          </ToggleChip>

          <button
            disabled={playable.length < 1}
            onClick={() => setPlaying(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, boxShadow: "0 14px 30px -18px rgba(122,92,196,0.9)" }}
          >
            {items.isFetching ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            Start building
          </button>
          <p className="mt-2 text-center text-[12.5px] font-bold text-[#8a8175]">
            {selected.length === 0
              ? "Select at least one sub-subject."
              : `${playable.length} to build · ${LEVELS.find((l) => l.key === level)!.hint}`}
          </p>
        </div>
      }
    >
      {playing && playable.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-8 max-w-3xl">
            <BuildGame items={playable} level={level} onExit={() => setPlaying(false)} />
          </div>
        </div>
      )}
    </LabShell>
  );
}
