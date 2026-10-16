import type { CSSProperties } from "react";

const d = (ms: number) => ({ "--rh-d": `${ms}ms` }) as CSSProperties;

/**
 * A phone showing a real moment from a Rita call: the learner asks what a word means,
 * Rita answers in Arabic, the word lands in "My words". Drawn in code so it stays sharp
 * and never waits for an image. The sequence plays once; at rest everything is visible.
 */
export function LiveCallPhone() {
  return (
    <div
      role="img"
      aria-label="A Rita call on a phone. The learner asks in Arabic what Guten Morgen means, Rita answers, and the word is added to the learner's list."
      className="relative mx-auto w-[min(100%,300px)]"
    >
      <div
        className="rounded-[46px] p-[9px]"
        style={{
          background:
            "linear-gradient(145deg,#9ca2a8 0%,#3f4449 10%,#17191c 30%,#111315 72%,#4d5257 94%,#a8adb2 100%)",
          boxShadow: "0 1px 0 rgba(255,255,255,.22) inset, 0 40px 70px -40px rgba(18,17,23,.55)",
        }}
      >
        <div
          className="relative flex aspect-[9/18.4] flex-col overflow-hidden rounded-[38px]"
          style={{ background: "#ffffff" }}
          aria-hidden="true"
        >
          <span
            className="absolute left-1/2 top-[9px] h-[20px] w-[70px] -translate-x-1/2 rounded-full"
            style={{ background: "#05070b" }}
          />

          <div className="flex items-center gap-2 px-4 pb-2 pt-[42px]">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold"
              style={{
                background: "var(--pp-pink)",
                color: "var(--pp-ink)",
                border: "2px solid var(--pp-ink)",
              }}
            >
              R
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-bold" style={{ color: "var(--pp-ink)" }}>
                Rita
              </p>
              <p className="text-[11px] font-semibold" style={{ color: "var(--pp-muted)" }}>
                Listening
              </p>
            </div>
            <span className="ms-auto flex h-5 items-center gap-[3px]">
              {[0, 140, 280, 120, 240].map((delay, i) => (
                <span
                  key={i}
                  className="rh-wave block h-5 w-[3px] rounded-full"
                  style={{ ...d(delay), background: "var(--pp-pink)" }}
                />
              ))}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-2.5 px-3.5 pb-3">
            <div
              className="rh-pop max-w-[88%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] font-semibold"
              style={{ ...d(500), background: "var(--pp-ink)", color: "#ffffff" }}
            >
              <span dir="rtl" lang="ar">
                شو معنى Guten Morgen؟
              </span>
            </div>

            <div
              className="rh-pop max-w-[92%] self-start rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13.5px] leading-6"
              style={{ ...d(1700), background: "var(--pp-grey)", color: "var(--pp-ink)" }}
            >
              <span dir="rtl" lang="ar">
                يعني{" "}
                <span
                  dir="ltr"
                  className="rh-mark mx-0.5 inline-block rounded-md px-1.5 font-bold"
                  style={{ ...d(3000), background: "var(--pp-pink-soft)" }}
                >
                  Guten Morgen
                </span>{" "}
                صباح الخير. بنقولها الصبح.
              </span>
            </div>

            <div
              className="rh-pop flex items-center justify-between gap-2 rounded-xl px-3 py-2"
              style={{ ...d(3900), background: "#ffffff", border: "1px solid var(--pp-line)" }}
            >
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--pp-muted)" }}>
                Added to My words
              </span>
              <span className="text-[12.5px] font-bold" style={{ color: "var(--pp-ink)" }}>
                Guten Morgen
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-3.5 pb-4">
            <span
              className="rounded-lg px-3 py-1.5 text-[11.5px] font-bold"
              style={{ border: "1.5px solid var(--pp-ink)", color: "var(--pp-ink)" }}
            >
              My words (1)
            </span>
            <span
              className="rounded-lg px-3 py-1.5 text-[11.5px] font-bold"
              style={{
                background: "var(--pp-pink)",
                border: "1.5px solid var(--pp-ink)",
                color: "var(--pp-ink)",
              }}
            >
              End
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
