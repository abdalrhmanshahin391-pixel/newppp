import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flag, Loader2, Mic } from "lucide-react";
import { LabShell } from "@/components/german/LabShell";
import { SpeakLab } from "@/components/german/SpeakLab";
import { useDeItems } from "@/lib/use-de-lab";
import { shuffle } from "@/lib/de-lab";
import { useAuth } from "@/hooks/useAuth";
import { Segmented, ToggleChip } from "@/components/german/LabControls";

const ACCENT = "#e0774f";

export const Route = createFileRoute("/german/speak")({
  head: () => ({
    meta: [
      { title: "Pronunciation Lab — speak German and get scored | RitaJet" },
      {
        name: "description",
        content:
          "Hear native German audio at full or slow speed, record yourself and get a 0–100 pronunciation score with every word marked green, amber or red.",
      },
      { property: "og:title", content: "Pronunciation Lab — speak German and get scored" },
      {
        property: "og:description",
        content: "Native German audio plus word-by-word pronunciation scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeakPage,
});

const KINDS = [
  { key: "all", label: "Everything" },
  { key: "word", label: "Words" },
  { key: "sentence", label: "Sentences" },
] as const;

function SpeakPage() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [kind, setKind] = useState<"all" | "word" | "sentence">("all");
  const [playing, setPlaying] = useState(false);
  const items = useDeItems(selected, flaggedOnly);

  const pool = useMemo(
    () => (items.data ?? []).filter((i) => (kind === "all" ? true : i.kind === kind)),
    [items.data, kind],
  );

  return (
    <LabShell
      mode="speaking"
      accent={ACCENT}
      title="Pronunciation Lab"
      description="One phrase at a time: listen to a native voice, record yourself, and see exactly which words were off."
      signedIn={!!user}
      loading={loading}
      signedOutHint="to build your speaking subjects."
      selected={selected}
      onSelect={setSelected}
      panel={
        <div>
          <Segmented
            label="Practise"
            value={kind}
            options={KINDS}
            accent={ACCENT}
            columns={3}
            onChange={(k) => setKind(k as "all" | "word" | "sentence")}
          />
          <ToggleChip on={flaggedOnly} icon={<Flag size={14} />} onClick={() => setFlaggedOnly((v) => !v)}>
            Flagged only
          </ToggleChip>

          <button
            disabled={pool.length === 0}
            onClick={() => setPlaying(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, boxShadow: "0 14px 30px -18px rgba(224,119,79,0.9)" }}
          >
            {items.isFetching ? <Loader2 className="animate-spin" size={16} /> : <Mic size={16} />}
            Start speaking
          </button>
          <p className="mt-2 text-center text-[12.5px] font-bold text-[#8a8175]">
            {selected.length === 0 ? "Select at least one sub-subject." : `${pool.length} items ready`}
          </p>
        </div>
      }
    >
      {playing && pool.length > 0 && <SpeakLab items={shuffle(pool)} onClose={() => setPlaying(false)} />}
    </LabShell>
  );
}
