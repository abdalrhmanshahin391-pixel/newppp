import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { ReviewSwitch } from "@/components/rita/ReviewSwitch";
import { AdminGuide, GuideButton } from "@/components/rita-quality/AdminGuide";
import { useGuideOpen } from "@/hooks/useGuideOpen";
import { BuildTable } from "@/components/rita-quality/BuildTable";
import { CriteriaBars } from "@/components/rita-quality/CriteriaBars";
import { HealthStrip } from "@/components/rita-quality/HealthStrip";
import { IssueList } from "@/components/rita-quality/IssueList";
import { NextStepCard } from "@/components/rita-quality/NextStepCard";
import { ReviewerCheckSection } from "@/components/rita-quality/ReviewerCheckSection";
import { useAuth } from "@/hooks/useAuth";
import { useRitaQuality } from "@/hooks/useRitaQuality";
import { supabase } from "@/integrations/supabase/client";
import { guardRedirect } from "@/lib/guard-redirect";
import { agreementRate, buildIssueRows, healthByBuild } from "@/lib/rita-quality";
import { FILTERS, matchesFilter, nextStep, type IssueFilter } from "@/lib/rita-quality-next";
import { latestRuns } from "@/lib/rita-replay";
import { RUBRIC_VERSION } from "@/lib/rita-tutor-contract";

export const Route = createFileRoute("/admin/rita-quality/")({
  head: () => ({
    meta: [{ title: "Rita quality — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaQualityPage,
});

type Tab = "overview" | "problems" | "trust";

function RitaQualityPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const data = useRitaQuality(Boolean(user) && isAdmin);
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<IssueFilter>("open");
  const [guide, setGuide] = useGuideOpen();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  async function runCheck() {
    setChecking(true);
    setCheckError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/rita-v3/reviewer-check", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        setCheckError(result.error ?? "The check could not run. Try again in a minute.");
      }
      await data.reload();
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : "The check could not run.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) guardRedirect(navigate);
  }, [isAdmin, loading, navigate, user]);

  const builds = useMemo(() => healthByBuild(data.reviews), [data.reviews]);
  const replays = useMemo(() => latestRuns(data.runs), [data.runs]);
  const rows = useMemo(
    () => buildIssueRows(data.issues, data.reviews, Date.now(), replays),
    [data.issues, data.reviews, replays],
  );
  const agreement = useMemo(() => agreementRate(data.feedback), [data.feedback]);
  const checkedCurrent = data.checks.some(
    (check) =>
      check.rubric_version === RUBRIC_VERSION && ["done", "partial"].includes(check.status),
  );
  const step = nextStep({
    enabled: true,
    reviewed: builds.reduce((sum, build) => sum + build.reviewed, 0),
    rows,
    checkedCurrent,
  });
  const openCount = rows.filter((row) => matchesFilter(row, "open")).length;
  const filtered = rows.filter((row) => matchesFilter(row, filter));
  const hasData = builds.length > 0 || rows.length > 0;

  return (
    <main className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>
      <section className="mx-auto w-full max-w-4xl px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
        <Link
          to="/admin"
          className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-[var(--pp-muted)] hover:text-[var(--pp-ink)]"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Admin
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="rh-app-title">Rita quality</h1>
            <p className="mt-1 text-[16px] text-[var(--pp-muted)]">
              What to fix next, and whether the last fix worked.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <ReviewSwitch compact />
            <GuideButton open={guide} onToggle={() => setGuide(!guide)} />
          </div>
        </div>
        <AdminGuide open={guide} scope="quality" />

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

        {data.state === "ready" && !hasData ? (
          <div className="mt-8 rounded-2xl bg-[var(--pp-grey)] p-6 sm:p-8">
            <h2 className="text-[20px] font-semibold">No reviewed replies yet</h2>
            <ol className="mt-3 grid gap-2 text-[16px] leading-[1.5]">
              <li>1. Talk to Rita and end the conversation.</li>
              <li>2. Wait a few minutes. Her replies are reviewed after the call.</li>
              <li>
                3. The first numbers and problems appear here. Check that AI analysis (top right) is
                on.
              </li>
            </ol>
          </div>
        ) : null}

        {data.state === "ready" && hasData ? (
          <Tabs.Root
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            className="mt-6 min-w-0"
          >
            <Tabs.List aria-label="Rita quality sections" className="rita-tabs-list">
              <Tabs.Trigger value="overview" className="rita-tab">
                Overview
              </Tabs.Trigger>
              <Tabs.Trigger value="problems" className="rita-tab">
                Problems{openCount ? ` (${openCount})` : ""}
              </Tabs.Trigger>
              <Tabs.Trigger value="trust" className="rita-tab">
                Trust
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content
              value="overview"
              className="rita-tab-panel mt-6 grid grid-cols-[minmax(0,1fr)] gap-8"
            >
              <NextStepCard step={step} onTrust={() => setTab("trust")} />
              <HealthStrip builds={builds} />
              <section aria-labelledby="top-problems">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="top-problems" className="text-[20px] font-semibold">
                    Biggest problems
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab("problems")}
                    className="min-h-[44px] text-[15px] font-semibold text-[var(--pp-accent-text)]"
                  >
                    See all
                  </button>
                </div>
                <div className="mt-3">
                  <IssueList
                    rows={rows.filter((row) => matchesFilter(row, "open")).slice(0, 3)}
                    allRows={rows}
                    limit={3}
                    emptyText="No open problems. Reviews of new conversations will add cards here."
                  />
                </div>
              </section>
              {builds.at(-1) ? (
                <CriteriaBars health={builds.at(-1) as (typeof builds)[number]} />
              ) : null}
              {builds.length > 1 ? (
                <details>
                  <summary className="min-h-[44px] cursor-pointer py-2 text-[16px] font-semibold">
                    Compare versions
                  </summary>
                  <BuildTable builds={builds} />
                </details>
              ) : null}
            </Tabs.Content>

            <Tabs.Content value="problems" className="rita-tab-panel mt-6">
              <div role="radiogroup" aria-label="Show problems" className="rita-choice max-w-md">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={filter === item.id}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <IssueList
                  key={filter}
                  rows={filtered}
                  allRows={rows}
                  emptyText={
                    filter === "open"
                      ? "No open problems. Reviews of new conversations will add cards here."
                      : "Nothing here yet."
                  }
                />
              </div>
            </Tabs.Content>

            <Tabs.Content value="trust" className="rita-tab-panel mt-6">
              <ReviewerCheckSection
                checks={data.checks}
                agreement={agreement}
                busy={checking}
                error={checkError}
                onRun={() => void runCheck()}
              />
            </Tabs.Content>
          </Tabs.Root>
        ) : null}
      </section>
    </main>
  );
}
