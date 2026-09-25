import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ToolDef } from "@/lib/site-tools";

function SampleChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4e2] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#3d5c14]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6ab887]" />
      Sample ready
    </span>
  );
}

export function ToolCard({
  tool,
  lang = "en",
  badge,
  locked,
}: {
  tool: ToolDef;
  lang?: "en" | "ar";
  badge?: string | null;
  locked?: boolean;
}) {
  const Icon = tool.icon;

  const body = (
    <>
      <div className="h-1.5 w-full" style={{ background: tool.ink }} />
      {tool.image ? (
        <div className="relative h-32 w-full max-w-full overflow-hidden" style={{ background: tool.soft }}>
          <img
            src={tool.image}
            alt=""
            width={900}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      ) : null}

      <div className="flex w-full min-w-0 flex-1 flex-col p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: tool.soft, color: tool.ink }}
          >
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <div
              className="text-[10px] font-black uppercase tracking-[0.14em]"
              style={{ color: tool.ink }}
            >
              {tool.tag[lang]}
            </div>
            <h3 className="truncate font-display text-[18px] font-black tracking-tight text-[#23201d]">
              {tool.name[lang]}
            </h3>
          </div>
          {badge ? (
            <span className="ml-auto shrink-0 rounded-full bg-[#23201d] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
              {badge}
            </span>
          ) : null}
        </div>

        <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-[#4a453d]">{tool.line[lang]}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13.5px] font-extrabold text-[#23201d]">
            {locked ? (lang === "ar" ? "قريبًا" : "Coming soon") : tool.cta[lang]}
            {!locked && (
              <ArrowRight
                size={15}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            )}
          </span>
          {tool.sample && !locked && <SampleChip />}
        </div>
      </div>
    </>
  );

  const shell =
    "group flex w-full max-w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-black/[0.07] bg-white transition-all duration-300";

  if (locked) {
    return <div className={`${shell} opacity-60`}>{body}</div>;
  }

  return (
    <Link
      to={tool.to}
      params={tool.params as never}
      className={`${shell} hover:-translate-y-1.5 hover:shadow-[0_22px_44px_-24px_rgba(0,0,0,0.24)]`}
    >
      {body}
    </Link>
  );
}
