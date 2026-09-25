import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, LogIn, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import heroArt from "@/assets/spaces-character.jpg";
import { useAuth } from "@/hooks/useAuth";
import {
  KIND_LABEL,
  ROLE_LABEL,
  SPACE_COLORS,
  createSpace,
  spaceTone,
  useMySpaces,
  type SpaceKind,
} from "@/lib/spaces";

export const Route = createFileRoute("/spaces/")({
  head: () => ({
    meta: [
      { title: "Classrooms & study groups | RitaJet" },
      {
        name: "description",
        content:
          "Join classrooms and study groups, share flashcard decks with your classmates and keep everything organised in folders.",
      },
      { property: "og:title", content: "Classrooms & study groups on RitaJet" },
      {
        property: "og:description",
        content: "Study together: shared decks, members, announcements and optional chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpacesPage,
});

const EMOJIS = ["🎓", "🫀", "🧠", "💊", "📚", "🔬", "🦴", "🇩🇪", "⚡️", "🌿"];
const HERO = heroArt;

function JoinBox() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function go() {
    const raw = value.trim();
    const code = (raw.split(/[?#]/)[0] ?? "").split("/").filter(Boolean).pop() ?? "";
    if (!code) {
      toast.error("Paste the code or the invite link first.");
      return;
    }
    navigate({ to: "/join/$code", params: { code } });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="abc123  or  ritajet.app/join/abc123"
        className="h-14 flex-1 rounded-2xl border border-black/10 bg-white px-5 font-mono text-[18px] font-black tracking-[0.12em] text-[#23201d] placeholder:font-sans placeholder:text-[14px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-[#a89e90] focus:outline-none focus:ring-2 focus:ring-[#8ec63f]"
        aria-label="Invite code or link"
      />
      <button
        onClick={go}
        className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#23201d] px-7 text-[15px] font-black text-white transition hover:brightness-125"
      >
        <LogIn size={17} /> Join
      </button>
    </div>
  );
}

function SpacesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const spaces = useMySpaces();
  const [open, setOpen] = useState<SpaceKind | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const classrooms = (spaces.data ?? []).filter((s) => s.kind === "classroom");
  const groups = (spaces.data ?? []).filter((s) => s.kind === "group");

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white shadow-[0_30px_70px_-50px_rgba(0,0,0,0.6)]">
          <div className="grid lg:grid-cols-[1.05fr_1fr]">
            <div className="p-7 md:p-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#fbf8f2] px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
                Classrooms & study groups
              </span>
              <h1
                className="mt-4 font-display font-black leading-[1.06] tracking-tight"
                style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)" }}
              >
                Study together, in one room.
              </h1>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[#4a453d]">
                A classroom is the whole course. A group is a few classmates. Each one keeps its own
                decks, members and announcements.
              </p>

              <div data-tour="spaces-join" className="mt-7 rounded-[24px] border border-black/[0.08] bg-[#fbf5e9] p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
                  Have a code? Enter it here
                </p>
                <JoinBox />
              </div>
            </div>

            <div className="relative min-h-[260px] bg-[#efe7d8]">
              <img
                src={HERO}
                alt="Students studying together around a laptop showing RitaJet"
                width={1600}
                height={1000}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </section>


        <Section
          dataTour="spaces-classrooms"
          icon={<GraduationCap size={16} />}
          title="Classrooms"
          note="A whole class sharing one organised deck library."
          onCreate={() => setOpen("classroom")}
          items={classrooms}
          loading={spaces.isLoading}
        />
        <Section
          dataTour="spaces-groups"
          icon={<Users size={16} />}
          title="Study groups"
          note="A small circle where everyone adds decks."
          onCreate={() => setOpen("group")}
          items={groups}
          loading={spaces.isLoading}
        />

        <div className="mt-14 rounded-[26px] border border-dashed border-black/15 bg-white/60 px-6 py-6 text-[15px] font-semibold text-[#4a453d]">
          Got an invite link? Just open it — it looks like
          <span className="mx-1 rounded-lg bg-black/[0.06] px-2 py-0.5 font-black">/join/abc123</span>
          and adds you straight away.
        </div>
      </main>

      {open && (
        <CreateDialog
          kind={open}
          onClose={() => setOpen(null)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ["my-spaces"] });
            navigate({ to: "/spaces/$spaceId", params: { spaceId: id } });
          }}
        />
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  note,
  onCreate,
  items,
  loading,
  dataTour,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  onCreate: () => void;
  items: ReturnType<typeof useMySpaces>["data"];
  loading: boolean;
  dataTour?: string;
}) {
  return (
    <section className="mt-12" data-tour={dataTour}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
            {icon} {title}
          </span>
          <p className="mt-2 text-[15px] text-[#6b655c]">{note}</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
        >
          <Plus size={16} /> New {title.toLowerCase().replace(/s$/, "")}
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-[#6b655c]">Loading…</p>
      ) : (items?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-2xl border border-black/[0.06] bg-white px-5 py-5 text-[15px] text-[#6b655c]">
          Nothing here yet — create one and share its invite link.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items!.map((s) => (
            <Link
              key={s.id}
              to="/spaces/$spaceId"
              params={{ spaceId: s.id }}
              className="group overflow-hidden rounded-[26px] border border-black/[0.07] bg-white transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-30px_rgba(0,0,0,0.5)]"
            >
              <div className="grid h-24 place-items-center" style={{ background: spaceTone(s.color) }}>
                <span className="text-4xl">{s.emoji || "🎓"}</span>
              </div>
              <div className="p-5">
                <p className="truncate font-display text-[17px] font-black">{s.name}</p>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] text-[#6b655c]">
                  {s.description || "No description yet."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-black/[0.06] px-2.5 py-1">{KIND_LABEL[s.kind]}</span>
                  <span className="rounded-full bg-[#e6f4d8] px-2.5 py-1 text-[#3d5c14]">
                    {ROLE_LABEL[s.role]}
                  </span>
                  <span className="text-[#6b655c]">
                    {s.members} members · {s.decks} decks
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function CreateDialog({
  kind,
  onClose,
  onCreated,
}: {
  kind: SpaceKind;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState(kind === "classroom" ? "🎓" : "🫀");
  const [color, setColor] = useState("apricot");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Give it a name");
    setSaving(true);
    try {
      const id = await createSpace({ kind, name, description, emoji, color });
      toast.success(`${KIND_LABEL[kind]} created`);
      onCreated(id);
    } catch (e: any) {
      toast.error(e?.message || "Could not create it");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[26px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-black">New {KIND_LABEL[kind].toLowerCase()}</h2>
        <div className="mt-5 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "classroom" ? "Year 3 — Cardiology" : "Heart failure squad"}
            className="w-full rounded-xl border border-black/[0.1] px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this space for?"
            className="min-h-[80px] w-full rounded-xl border border-black/[0.1] px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]"
          />
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-9 w-9 rounded-xl text-lg ${emoji === e ? "bg-black/[0.08]" : "hover:bg-black/[0.05]"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(SPACE_COLORS).map((key) => (
              <button
                key={key}
                onClick={() => setColor(key)}
                aria-label={key}
                className={`h-9 w-9 rounded-full ${color === key ? "ring-2 ring-[#23201d] ring-offset-2" : ""}`}
                style={{ background: spaceTone(key) }}
              />
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-black text-[#6b655c]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}
