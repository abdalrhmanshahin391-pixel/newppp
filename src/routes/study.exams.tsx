import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { ExamCalendar } from "@/components/study/ExamCalendar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/study/exams")({
  head: () => ({
    meta: [
      { title: "Exam schedule — RitaJet study workspace" },
      {
        name: "description",
        content:
          "A month calendar for every exam: add a course with its date and see the whole term at a glance.",
      },
      { property: "og:title", content: "Exam schedule — RitaJet study workspace" },
      {
        property: "og:description",
        content: "Plan exams months ahead on one clean calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamSchedulePage,
});

function ExamSchedulePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />
      <main className="mx-auto max-w-[80rem] px-4 py-10 md:px-8">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#2f6318]">
            Exam schedule
          </span>
          <h1
            className="mt-5 font-display font-black leading-[1.08] tracking-tight"
            style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)" }}
          >
            Every exam on one calendar
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[#4a453d]">
            Add a course with its exam date — next week or three months out — and browse month by
            month.
          </p>
        </div>

        <div className="mt-8" data-tour="exams-container">
          {loading ? (
            <div className="h-[60vh] animate-pulse rounded-[28px] bg-white/70" />
          ) : user ? (
            <ExamCalendar />
          ) : (
            <div className="rounded-[28px] border border-dashed border-black/[0.12] bg-white p-10 text-center">
              <p className="text-[15px] font-extrabold">Sign in to plan your exams</p>
              <p className="mt-1 text-[14px] text-[#6d675e]">
                Your exam schedule is private to your account.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex rounded-xl bg-[#4c9a2a] px-5 py-2.5 text-[14px] font-black text-white"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
