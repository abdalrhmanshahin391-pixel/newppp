import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { ReviewSwitch } from "@/components/rita/ReviewSwitch";
import { BuildTable } from "@/components/rita-quality/BuildTable";
import { CriteriaBars } from "@/components/rita-quality/CriteriaBars";
import { HealthStrip } from "@/components/rita-quality/HealthStrip";
import { IssueList } from "@/components/rita-quality/IssueList";
import { useAuth } from "@/hooks/useAuth";
import { useRitaQuality } from "@/hooks/useRitaQuality";
import { guardRedirect } from "@/lib/guard-redirect";
import { agreementRate, buildIssueRows, healthByBuild } from "@/lib/rita-quality";

export const Route = createFileRoute("/admin/rita-quality/")({
  head: () => ({
    meta: [{ title: "Rita quality — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaQualityPage,
});

function RitaQualityPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const data = useRitaQuality(Boolean(user) && isAdmin);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) guardRedirect(navigate);
  }, [isAdmin, loading, navigate, user]);

  const builds = useMemo(() => healthByBuild(data.reviews), [data.reviews]);
  const rows = useMemo(
    () => buildIssueRows(data.issues, data.reviews),
    [data.issues, data.reviews],
  );
  const agreement = useMemo(() => agreementRate(data.feedback), [data.feedback]);

  return (
    <main className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>
      <section className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <Link
          to="/admin"
          className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-[var(--pp-muted)] hover:text-[var(--pp-ink)]"
        >
          <ArrowLeft size={17} /> Admin
        </Link>
        <h1 className="mt-2 text-[38px] leading-tight sm:text-[50px]">Rita quality</h1>
        <p className="mt-2 max-w-2xl text-[17px] text-[var(--pp-muted)]">
          What to fix next in Rita&apos;s replies, and whether the last fix worked.
        </p>

        <ReviewSwitch />

        {data.state === "loading" ? (
          <div className="grid min-h-56 place-items-center" role="status" aria-label="Loading">
            <Loader2 className="animate-spin text-[var(--pp-muted)]" />
          </div>
        ) : null}

        {data.state === "missing" ? (
          <p
            role="alert"
            className="mt-8 rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px] leading-[1.5]"
          >
            The database is missing a table for this page. Apply the migrations{" "}
            <span className="font-mono text-[14px]">20261024130000_rita_turn_reviews</span>,{" "}
            <span className="font-mono text-[14px]">20261024140000_rita_review_compare</span> and{" "}
            <span className="font-mono text-[14px]">20261024150000_rita_quality</span> in Lovable
            Cloud, then reload.
          </p>
        ) : null}

        {data.state === "error" ? (
          <p
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-[15px] text-red-700"
          >
            Could not load the reviews: {data.error}
          </p>
        ) : null}

        {data.state === "ready" && builds.length === 0 && rows.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-[var(--pp-grey)] p-6 sm:p-8">
            <h2 className="text-[22px] font-semibold">No reviewed replies yet</h2>
            <p className="mt-2 text-[16px] leading-[1.5] text-[var(--pp-muted)]">
              Talk to Rita and end the conversation. Her replies are reviewed a few minutes later
              and the first numbers and problems appear here. Check that the switch above is on.
            </p>
          </div>
        ) : null}

        {data.state === "ready" && (builds.length > 0 || rows.length > 0) ? (
          <>
            <HealthStrip builds={builds} />
            <IssueList rows={rows} />
            {builds.at(-1) ? (
              <CriteriaBars health={builds.at(-1) as (typeof builds)[number]} />
            ) : null}
            <BuildTable builds={builds} />
            <section aria-labelledby="reviewer-title" className="mt-10">
              <h2 id="reviewer-title" className="text-[22px] font-semibold">
                Is the reviewer right?
              </h2>
              <p className="mt-2 max-w-2xl text-[16px] leading-[1.5] text-[var(--pp-muted)]">
                {agreement
                  ? `You agreed with ${agreement.rate}% of the ${agreement.total} judgements you rated.`
                  : "Open a problem and mark a few of its examples as right or wrong. The share you agree with is shown here, and the ones you disagree with go into the fix file."}
              </p>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
