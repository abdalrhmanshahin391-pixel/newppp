// The library's numbers for the admin (phase 3): the last 7 or 30 days next to the days before
// them, what is trending, what is rated highest, how the stars spread, and published books nobody
// opened. Only signed-in readers are counted, once a day per book.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { ADMIN_LIBRARY_QUERY_KEY, loadAnalytics, type Analytics } from "@/lib/books-data";
import { Choice, muted, Notice, sectionTitle } from "./admin-ui";

type Key = keyof Analytics["now"];

const CARDS: [Key, string, string][] = [
  ["views", "مشاهدات", "فتح بطاقة الكتاب"],
  ["reads", "قراءات", "ضغط «ابدأ القراءة»"],
  ["favorites", "مفضلة", "انضاف للمفضلة"],
  ["ratings", "تقييمات", "تقييمات جديدة"],
];

export function StatsTab() {
  const [days, setDays] = useState<"7" | "30">("7");
  const stats = useQuery({
    queryKey: [...ADMIN_LIBRARY_QUERY_KEY, "analytics", days],
    queryFn: () => loadAnalytics(days === "30" ? 30 : 7),
    staleTime: 60_000,
  });

  if (stats.isLoading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (stats.isError)
    return (
      <p className="rounded-xl bg-[#fbe9ed] p-4 text-[15px] font-semibold text-[#8c1a31]">
        ما انفتحت الإحصائيات: {(stats.error as Error).message}
      </p>
    );
  const data = stats.data;
  if (!data)
    return (
      <Notice tone="info">
        الإحصائيات بتشتغل بعد تحديث قاعدة البيانات ‏20261111120000 (‏books_popularity).
      </Notice>
    );

  const totalStars = Object.values(data.stars).reduce((a, b) => a + Number(b), 0);
  const change = (key: Key) => {
    const now = Number(data.now[key]);
    const before = Number(data.before[key]);
    if (now === before) return "نفس الفترة اللي قبلها";
    const diff = Math.abs(now - before);
    return now > before
      ? `أكثر بـ ${diff} من الفترة اللي قبلها`
      : `أقل بـ ${diff} من الفترة اللي قبلها`;
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>الإحصائيات</h2>
          <p className={muted}>
            بتنحسب للقرّاء المسجّلين بس، مرة باليوم لكل كتاب. الزوار بدون حساب ما بينحسبوا.
          </p>
        </div>
        <Choice
          name="الفترة"
          value={days}
          onChange={setDays}
          options={[
            ["7", "آخر 7 أيام"],
            ["30", "آخر 30 يوم"],
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map(([key, label, note]) => (
          <div key={key} className="rounded-2xl bg-[var(--pp-grey)] p-4">
            <p className="text-[14px] font-semibold">{label}</p>
            <p className="mt-1 text-[34px] font-semibold leading-none">{Number(data.now[key])}</p>
            <p className="mt-2 text-[12.5px] text-[var(--pp-muted)]">{note}</p>
            <p className="mt-1 text-[12.5px] font-semibold">{change(key)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-[17px] font-semibold">الرائج هالأسبوع</h3>
          <p className={muted}>
            المشاهدة بنقطة، القراءة بـ 3، والمفضلة بـ 2. وزن الحدث بينزل للنص كل 3 أيام.
          </p>
          {data.trending.length ? (
            <ol className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
              {data.trending.map((row, i) => (
                <li key={row.id} className="flex items-center gap-3 p-3 text-[14px]">
                  <span className="w-5 text-center text-[var(--pp-muted)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
                    {row.title}
                  </span>
                  <span className="text-[13px] text-[var(--pp-muted)]">
                    {row.views} مشاهدة · {row.reads} قراءة
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[14px]">
              لسا ما في نشاط هالأسبوع.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-[17px] font-semibold">الأعلى تقييماً</h3>
          <p className={muted}>
            متوسط موزون (بيحتاج 3 تقييمات على الأقل)، فكتاب بتقييمات كثيرة منيحة بيسبق كتاب بتقييمين
            ممتازين.
          </p>
          {data.top_rated.length ? (
            <ol className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
              {data.top_rated.map((row, i) => (
                <li key={row.id} className="flex items-center gap-3 p-3 text-[14px]">
                  <span className="w-5 text-center text-[var(--pp-muted)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
                    {row.title}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13px]">
                    <Star
                      size={13}
                      className="text-[#c98a00]"
                      fill="currentColor"
                      aria-hidden="true"
                    />
                    {Number(row.average).toFixed(1)}
                    <span className="text-[var(--pp-muted)]">({row.count})</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[14px]">
              ولا كتاب عليه 3 تقييمات لهلأ، فالرف ما بيطلع بالمكتبة.
            </p>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="text-[17px] font-semibold">توزيع النجوم ({totalStars} تقييم)</h3>
        <ul className="grid max-w-xl gap-2">
          {(["5", "4", "3", "2", "1"] as const).map((star) => {
            const n = Number(data.stars[star]);
            const share = totalStars ? Math.round((n / totalStars) * 100) : 0;
            return (
              <li
                key={star}
                className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-[14px]"
              >
                <span className="inline-flex items-center gap-1 font-semibold">
                  {star}{" "}
                  <Star
                    size={13}
                    className="text-[#c98a00]"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                </span>
                <span
                  className="h-2.5 overflow-hidden rounded-full bg-[var(--pp-grey)]"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-[#c98a00]"
                    style={{ width: `${share}%` }}
                  />
                </span>
                <span className="text-[var(--pp-muted)]">
                  {n} · {share}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-[17px] font-semibold">
          كتب منشورة ما انفتحت بالفترة ({Number(data.unopened_count)})
        </h3>
        {data.unopened.length ? (
          <ul className="flex flex-wrap gap-2">
            {data.unopened.map((row) => (
              <li
                key={row.id}
                className="rounded-full border border-[var(--pp-line)] px-3 py-1.5 text-[13.5px] font-semibold"
                dir="auto"
              >
                {row.title}
              </li>
            ))}
            {Number(data.unopened_count) > data.unopened.length && (
              <li className="px-2 py-1.5 text-[13.5px] text-[var(--pp-muted)]">
                و{Number(data.unopened_count) - data.unopened.length} غيرهم
              </li>
            )}
          </ul>
        ) : (
          <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[14px]">
            كل الكتب المنشورة انفتحت. 👏
          </p>
        )}
      </section>
    </div>
  );
}
