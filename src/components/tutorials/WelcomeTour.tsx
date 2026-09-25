import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LangSwitch, useTutorialLang } from "@/components/tutorials/ToolTutorial";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = (uid: string) => `ritajet.tour.seen.${uid}`;

const COPY = {
  en: {
    eyebrow: "Welcome to RitaJet",
    title: "Want a quick look around first?",
    body: "Two minutes and you will know exactly what every tool does — flashcards, one-page summaries, exam-style questions and the study room. You can come back to it any time from the “How it works” button inside each tool.",
    go: "Show me around",
    skip: "Skip for now",
  },
  ar: {
    eyebrow: "أهلًا بك في ريتاجت",
    title: "هل تريد جولة سريعة أولًا؟",
    body: "دقيقتان وستعرف بالضبط ما تفعله كل أداة — البطاقات، الملخّصات، أسئلة الامتحان وغرفة المذاكرة. يمكنك العودة للجولة في أي وقت من زر «كيف تعمل» داخل كل أداة.",
    go: "أرني الجولة",
    skip: "لاحقًا",
  },
} as const;

/** Pages where a brand-new student is likely to land first. */
function isEntryPage(pathname: string) {
  return pathname === "/learn" || pathname === "/" || pathname.startsWith("/learn/");
}

/**
 * A single, skippable welcome card. It shows once per account: the choice is
 * remembered on the profile (and locally, so it never flashes twice).
 */
export function WelcomeTour() {
  const { user, profile, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [lang, setLang] = useTutorialLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || open) return;
    if (!isEntryPage(pathname)) return;
    if (typeof window !== "undefined" && localStorage.getItem(LOCAL_KEY(user.id))) return;
    if ((profile as { tour_seen_at?: string | null } | null)?.tour_seen_at) return;
    // Let the page settle first so the card never fights the first paint.
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [loading, user, profile, pathname, open]);

  const remember = async () => {
    setOpen(false);
    if (!user) return;
    try {
      localStorage.setItem(LOCAL_KEY(user.id), new Date().toISOString());
    } catch {
      /* private mode — the profile flag below still remembers */
    }
    await supabase
      .from("profiles")
      .update({ tour_seen_at: new Date().toISOString() } as never)
      .eq("id", user.id);
  };

  const t = COPY[lang];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : void remember())}>
      <DialogContent
        className="max-w-md overflow-hidden p-0"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <DialogTitle className="sr-only">{t.title}</DialogTitle>
        <div className="bg-[color:var(--band-cream)] px-6 pb-6 pt-7 text-center">
          <div className="mx-auto flex justify-center">
            <span className="block h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[color:var(--rita-green-soft,#e6f4d8)] shadow-sm">
              <img
                src="/brand-rita.png"
                alt="RitaJet"
                width={80}
                height={80}
                className="h-full w-full object-cover object-[50%_30%]"
              />
            </span>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
            <Sparkles size={13} /> {t.eyebrow}
          </div>
          <h2 className="mt-2 font-display text-[22px] font-black leading-tight tracking-tight text-foreground">
            {t.title}
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{t.body}</p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                void remember();
                void navigate({ to: "/tutorial" });
              }}
              className="btn-chunky w-full"
            >
              {t.go}
            </button>
            <button
              type="button"
              onClick={() => void remember()}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-6 text-[14px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} /> {t.skip}
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
