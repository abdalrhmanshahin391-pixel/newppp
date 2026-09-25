import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  alreadySeen,
  isScheduledNow,
  markSeen,
  matchesPage,
  themeOf,
  trackRitaX,
  useLiveRitaX,
  type RitaX,
} from "@/lib/ritax";

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  const target = iso ? new Date(iso).getTime() : null;
  const live = target !== null && target > now;
  useEffect(() => {
    // Only tick while a countdown is actually on screen and still running.
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  if (target === null) return null;
  const ms = target - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}


function Confetti({ accent }: { accent: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 5.4 + (i % 3) * 3) % 100,
        delay: (i % 6) * 0.35,
        size: 6 + (i % 4) * 3,
        rot: (i * 37) % 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute block ritax-fall"
          style={{
            left: `${b.left}%`,
            top: "-12%",
            width: b.size,
            height: b.size * 0.5,
            background: i % 3 === 0 ? accent : i % 3 === 1 ? "#8ec63f" : "#f7c26b",
            borderRadius: 2,
            transform: `rotate(${b.rot}deg)`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function RitaXCard({
  a,
  preview = false,
  onClose,
}: {
  a: RitaX;
  preview?: boolean;
  onClose?: () => void;
}) {
  const t = themeOf(a);
  const cd = useCountdown(a.countdown_to);

  const inner = (
    <div
      className="relative w-full overflow-hidden rounded-[28px] p-7 text-center shadow-[0_30px_80px_-30px_rgba(20,16,10,0.45)]"
      style={{ background: t.bg, color: t.ink }}
    >
      {a.confetti && <Confetti accent={t.accent} />}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-2 opacity-60 transition hover:opacity-100"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <X size={16} strokeWidth={3} />
        </button>
      )}
      {a.image_url ? (
        <img
          src={a.image_url}
          alt=""
          className="mx-auto mb-4 h-40 w-auto max-w-full rounded-2xl object-contain"
          loading="lazy"
        />
      ) : a.emoji ? (
        <div className="mb-3 text-5xl">{a.emoji}</div>
      ) : null}
      {a.eyebrow && (
        <p
          className="mb-2 text-xs font-black uppercase tracking-[0.22em]"
          style={{ color: t.accent }}
        >
          {a.eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-black leading-tight md:text-3xl">{a.title}</h2>
      {a.body && <p className="mx-auto mt-3 max-w-md text-sm opacity-80">{a.body}</p>}
      {cd && (
        <div className="mt-4 flex justify-center gap-2">
          {[
            { v: cd.d, l: "days" },
            { v: cd.h, l: "hrs" },
            { v: cd.m, l: "min" },
            { v: cd.s, l: "sec" },
          ].map((x) => (
            <div
              key={x.l}
              className="min-w-[58px] rounded-2xl px-3 py-2"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              <div className="text-lg font-black">{String(x.v).padStart(2, "0")}</div>
              <div className="text-[10px] uppercase tracking-widest opacity-60">{x.l}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-col items-center gap-2">
        {a.primary_label && (
          <a
            href={a.primary_href || "#"}
            onClick={() => {
              if (!preview) void trackRitaX(a.id, "click");
            }}
            className="w-full max-w-xs rounded-full px-6 py-3 text-sm font-black text-white transition hover:brightness-105"
            style={{ background: t.accent }}
          >
            {a.primary_label}
          </a>
        )}
        {a.secondary_label && (
          <a
            href={a.secondary_href || "#"}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            {a.secondary_label}
          </a>
        )}
      </div>
    </div>
  );

  if (a.layout === "bar") {
    return (
      <div
        className="flex w-full flex-wrap items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold"
        style={{ background: t.bg, color: t.ink }}
      >
        <span>
          {a.emoji} {a.title}
        </span>
        {a.primary_label && (
          <a
            href={a.primary_href || "#"}
            onClick={() => {
              if (!preview) void trackRitaX(a.id, "click");
            }}
            className="rounded-full px-4 py-1.5 text-xs font-black text-white"
            style={{ background: t.accent }}
          >
            {a.primary_label}
          </a>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="opacity-60 hover:opacity-100">
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    );
  }

  return inner;
}

function Shell({ a, onClose }: { a: RitaX; onClose: () => void }) {
  if (a.layout === "bar") {
    return (
      <div className="fixed inset-x-0 top-0 z-[70]">
        <RitaXCard a={a} onClose={onClose} />
      </div>
    );
  }
  if (a.layout === "corner") {
    return (
      <div className="fixed bottom-5 right-5 z-[70] w-[min(340px,calc(100vw-2.5rem))] ritax-in">
        <RitaXCard a={a} onClose={onClose} />
      </div>
    );
  }
  if (a.layout === "sheet") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3">
        <div className="w-full max-w-lg ritax-up">
          <RitaXCard a={a} onClose={onClose} />
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg ritax-in">
        <RitaXCard a={a} onClose={onClose} />
      </div>
    </div>
  );
}

export function RitaXAnnouncements() {
  const { data } = useLiveRitaX();
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [closed, setClosed] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = useMemo(() => {
    if (!mounted || loading) return null;
    if (pathname.startsWith("/admin")) return null;
    return (
      (data ?? []).find((a) => {
        if (!isScheduledNow(a)) return false;
        if (!matchesPage(a, pathname)) return false;
        if (a.audience === "signed_in" && !user) return false;
        if (a.audience === "signed_out" && user) return false;
        if (closed.includes(a.id)) return false;
        return !alreadySeen(a);
      }) ?? null
    );
  }, [data, mounted, loading, pathname, user, closed]);

  useEffect(() => {
    if (current) void trackRitaX(current.id, "view");
  }, [current]);

  useEffect(() => {
    if (current?.layout === "bar") {
      const prev = document.body.style.paddingTop;
      document.body.style.paddingTop = "44px";
      return () => {
        document.body.style.paddingTop = prev;
      };
    }
  }, [current?.id, current?.layout]);

  if (!mounted || !current) return null;

  const close = () => {
    markSeen(current);
    void trackRitaX(current.id, "dismiss");
    setClosed((c) => [...c, current.id]);
  };

  return createPortal(<Shell a={current} onClose={close} />, document.body);
}
