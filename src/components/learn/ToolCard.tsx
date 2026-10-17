import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ToolDef } from "@/lib/site-tools";

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
      <div className="flex items-start justify-between gap-3">
        <Icon size={26} strokeWidth={2} aria-hidden="true" />
        <span className="flex flex-wrap justify-end gap-1.5">
          {badge ? <span className="rh-flag">{badge}</span> : null}
          {tool.sample && !locked ? (
            <span className="rh-flag rh-flag-soft">Sample ready</span>
          ) : null}
        </span>
      </div>
      <h3 className="mt-5 text-[21px] font-bold leading-[1.15] tracking-[-0.02em]">
        {tool.name[lang]}
      </h3>
      <p className="mt-2 flex-1 text-[15px] leading-[1.55] text-[var(--pp-muted)]">
        {tool.line[lang]}
      </p>
      <span className="rh-tool-cta mt-5">
        {locked ? (lang === "ar" ? "قريبًا" : "Coming soon") : tool.cta[lang]}
        {!locked && <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />}
      </span>
    </>
  );

  if (locked) {
    return <div className="rh-tool rh-tool-locked">{body}</div>;
  }

  return (
    <Link to={tool.to} params={tool.params as never} className="rh-tool">
      {body}
    </Link>
  );
}
