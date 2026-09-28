import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  MessageSquare,
  Play,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import type { DemoKind, ToolDef } from "@/lib/site-tools";
import type { TutorialLang } from "./ToolTutorial";

/**
 * High-fidelity, authentic interactive mock of the real RitaJet site pages.
 * Displays the exact interfaces, real medical study content, SM-2 buttons,
 * question bank stems, and explanation drawers with live auto-play and clickability.
 */
export function ToolDemo({
  tool,
  lang = "en",
}: {
  tool: ToolDef;
  lang?: TutorialLang;
}) {
  const kind: DemoKind = tool.demo;
  const isAr = lang === "ar";

  return (
    <div className="w-full select-none" dir={isAr ? "rtl" : "ltr"}>
      {renderToolDemo(kind, tool, isAr)}
    </div>
  );
}

function renderToolDemo(kind: DemoKind, tool: ToolDef, isAr: boolean) {
  switch (kind) {
    case "cards":
      return <CardsSessionMock isAr={isAr} tool={tool} />;
    case "qbank":
      return <QBankRunnerMock isAr={isAr} tool={tool} />;
    case "match":
      return <MemoryLabMock isAr={isAr} tool={tool} />;
    case "summary":
      return <PdfSummaryMock isAr={isAr} tool={tool} />;
    case "allinone":
      return <AllInOneMock isAr={isAr} tool={tool} />;
    case "todo":
      return <TodoListMock isAr={isAr} tool={tool} />;
    case "calendar":
      return <ExamScheduleMock isAr={isAr} tool={tool} />;
    case "lecture":
      return <LectureLabMock isAr={isAr} tool={tool} />;
    case "share":
      return <SharedDecksMock isAr={isAr} tool={tool} />;
    case "spaces":
      return <SpacesMock isAr={isAr} tool={tool} />;
    case "german":
      return <GermanLabMock isAr={isAr} tool={tool} />;
    case "timer":
      return <TimerMock isAr={isAr} tool={tool} />;
    default:
      return null;
  }
}

/* =========================================================================
   1. FLASHCARDS: Authentic /study/session with SM-2 Buttons & Flip
   ========================================================================= */
function CardsSessionMock({ isAr, tool }: { isAr: boolean; tool: ToolDef }) {
  const [flipped, setFlipped] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [scheduledToast, setScheduledToast] = useState<string | null>(null);

  // Automatic demo loop
  useEffect(() => {
    let t1: any, t2: any, t3: any;

    const runLoop = () => {
      setFlipped(false);
      setSelectedGrade(null);
      setScheduledToast(null);

      t1 = setTimeout(() => {
        setFlipped(true);
      }, 2200);

      t2 = setTimeout(() => {
        setSelectedGrade(3); // Grade: Good (6 d)
        setScheduledToast(
          isAr
            ? "✓ تمت الجدولة بعد 6 أيام (الفاصل: 6d • السهولة: 2.50)"
            : "✓ Scheduled in 6 days (Interval: 6d • Ease: 2.50)"
        );
      }, 4200);

      t3 = setTimeout(() => {
        runLoop();
      }, 8000);
    };

    runLoop();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isAr]);

  const handleGradeClick = (grade: number, label: string) => {
    setSelectedGrade(grade);
    setScheduledToast(
      isAr
        ? `✓ تمت الجدولة بنجاح: ${label}`
        : `✓ Scheduled successfully: ${label}`
    );
  };

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-[#fbf5e9] p-4 sm:p-5 shadow-inner">
      {/* Session Topbar */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#7a4b16]">
            {isAr ? "أمراض القلب • بطاقات مركزة" : "Cardiology • High Yield"}
          </span>
          <span className="rounded-full bg-[#fbe3c8] px-2 py-0.5 text-[10px] font-black text-[#7a4b16]">
            {isAr ? "بطاقة 1 من 15" : "Card 1 of 15"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#7a4b16] shadow-sm">
            <Flame size={12} className="text-orange-500 fill-orange-500" />
            5 {isAr ? "يوم" : "streak"}
          </span>
        </div>
      </div>

      {/* Retention / Stability Bar */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[#6b655c]">
        <span className="font-bold uppercase tracking-wider text-[10px]">
          {isAr ? "قوة الذاكرة" : "Memory"}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.08]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: "76%", background: "var(--rita-green, #2f7d55)" }}
          />
        </div>
        <span className="font-semibold">{isAr ? "صمود 6 أيام" : "holds 6d"}</span>
      </div>

      {/* The Flashcard */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="group relative mt-3.5 min-h-[170px] cursor-pointer rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.99]"
      >
        <div className="flex items-center justify-between text-[11px]">
          <span
            className="rounded-md px-2 py-0.5 font-black uppercase tracking-wider"
            style={{ background: tool.soft, color: tool.ink }}
          >
            {isAr ? "استرجاع نشط" : "Active Recall"}
          </span>
          <span className="text-[#a1957f] flex items-center gap-1">
            <RotateCcw size={11} className="transition-transform group-hover:rotate-180 duration-500" />
            {flipped ? (isAr ? "انقر للوجه" : "tap for front") : (isAr ? "انقر للجواب" : "tap to flip")}
          </span>
        </div>

        {/* Card Content (Front vs Back) */}
        {!flipped ? (
          <div className="mt-4">
            <h4 className="font-display text-[16px] sm:text-[17px] font-black leading-snug text-[#23201d]">
              {isAr
                ? "ما هو الصوت السريري المميز لـ تضيق الصمام الأبهري (Aortic Stenosis)؟"
                : "What is the classic murmur of Aortic Stenosis?"}
            </h4>
            <p className="mt-3 text-[12px] text-[#8a8070] italic">
              {isAr ? "انقر على البطاقة لإظهار الجواب وخيارات SM-2" : "Tap card to reveal answer and SM-2 grades"}
            </p>
          </div>
        ) : (
          <div className="mt-4 animate-in fade-in duration-200">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#2f7d55]">
              {isAr ? "الجواب الصحيح:" : "Answer:"}
            </div>
            <p className="mt-1 text-[15px] sm:text-[16px] font-bold leading-snug text-[#23201d]">
              {isAr
                ? "نفخة قذفية انقباضية متصاعدة متناقصة تنتشر إلى الشريانين السباتيين."
                : "Crescendo-decrescendo systolic ejection murmur radiating to the carotids."}
            </p>
            <div className="mt-2.5 inline-block rounded-md bg-[#eef6ea] px-2.5 py-1 text-[11.5px] font-bold text-[#3d5c14]">
              💡 {isAr ? "تُسمع بأفضل شكل في الورب الثاني الأيمن (2nd right ICS)" : "Best heard at 2nd right ICS"}
            </div>
          </div>
        )}
      </div>

      {/* SM-2 Scheduled Toast */}
      {scheduledToast && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#d8ecdd] py-1.5 text-xs font-black text-[#215237] animate-in zoom-in-95 duration-200">
          <Sparkles size={13} />
          {scheduledToast}
        </div>
      )}

      {/* SM-2 The 4 Algorithm Buttons */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => handleGradeClick(1, isAr ? "أعد (10 دقائق)" : "Again (10 min)")}
          className={`rounded-xl p-2 text-center transition-all ${
            selectedGrade === 1 ? "ring-2 ring-[#b91c1c] scale-105" : "hover:opacity-90"
          }`}
          style={{ background: "#fee2e2", color: "#991b1b" }}
        >
          <span className="block text-[12px] sm:text-[13px] font-black">
            {isAr ? "أعد" : "Again"}
          </span>
          <span className="block text-[10px] font-semibold opacity-80">
            {isAr ? "10 د" : "10 min"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleGradeClick(2, isAr ? "صعب (1 يوم)" : "Hard (1 d)")}
          className={`rounded-xl p-2 text-center transition-all ${
            selectedGrade === 2 ? "ring-2 ring-[#b45309] scale-105" : "hover:opacity-90"
          }`}
          style={{ background: "#fef3c7", color: "#92400e" }}
        >
          <span className="block text-[12px] sm:text-[13px] font-black">
            {isAr ? "صعب" : "Hard"}
          </span>
          <span className="block text-[10px] font-semibold opacity-80">
            {isAr ? "1 يوم" : "1 d"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleGradeClick(3, isAr ? "جيد (6 أيام)" : "Good (6 d)")}
          className={`rounded-xl p-2 text-center transition-all ${
            selectedGrade === 3 ? "ring-2 ring-[#047857] scale-105 shadow-sm" : "hover:opacity-90"
          }`}
          style={{ background: "#d1fae5", color: "#065f46" }}
        >
          <span className="block text-[12px] sm:text-[13px] font-black">
            {isAr ? "جيد" : "Good"}
          </span>
          <span className="block text-[10px] font-semibold opacity-80">
            {isAr ? "6 أيام" : "6 d"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleGradeClick(4, isAr ? "سهل (8 أيام)" : "Easy (8 d)")}
          className={`rounded-xl p-2 text-center transition-all ${
            selectedGrade === 4 ? "ring-2 ring-[#0369a1] scale-105" : "hover:opacity-90"
          }`}
          style={{ background: "#e0f2fe", color: "#075985" }}
        >
          <span className="block text-[12px] sm:text-[13px] font-black">
            {isAr ? "سهل" : "Easy"}
          </span>
          <span className="block text-[10px] font-semibold opacity-80">
            {isAr ? "8 أيام" : "8 d"}
          </span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   2. QUESTION BANK: Authentic Runner with Question Card & Explanation Drawer
   ========================================================================= */
function QBankRunnerMock({ isAr, tool }: { isAr: boolean; tool: ToolDef }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Automatic looping animation
  useEffect(() => {
    let t1: any, t2: any, t3: any;

    const runLoop = () => {
      setSelected(null);
      setSubmitted(false);

      t1 = setTimeout(() => {
        setSelected("A");
      }, 1800);

      t2 = setTimeout(() => {
        setSubmitted(true);
      }, 3400);

      t3 = setTimeout(() => {
        runLoop();
      }, 9000);
    };

    runLoop();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isAr]);

  const options = [
    {
      label: "A",
      text: isAr ? "رقص سيدنهام (Sydenham chorea)" : "Sydenham chorea",
      isCorrect: true,
    },
    {
      label: "B",
      text: isAr ? "ألم المفاصل (Arthralgia)" : "Arthralgia (joint pain)",
      isCorrect: false,
    },
    {
      label: "C",
      text: isAr ? "ارتفاع سرعة التثفل (ESR) أو CRP" : "Elevated ESR or CRP level",
      isCorrect: false,
    },
    {
      label: "D",
      text: isAr ? "تطاول زمن PR في تخطيط القلب (ECG)" : "Prolonged PR interval on ECG",
      isCorrect: false,
    },
  ];

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      {/* Question Runner Topbar */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#d9ecf7] px-2 py-0.5 text-[11px] font-black text-[#1d4d6b]">
            {isAr ? "وضع الدراسة" : "Study Mode"}
          </span>
          <span className="font-bold text-[#6b655c]">
            {isAr ? "السؤال 1 من 25" : "Question 1 of 25"}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#1d4d6b] flex items-center gap-1">
          <CheckCircle2 size={13} className="text-emerald-600" />
          {isAr ? "تصحيح فوري وشرح" : "Instant explanation"}
        </span>
      </div>

      {/* Clinical Stem */}
      <div className="mt-3.5">
        <h4 className="font-sans text-[14px] sm:text-[15px] font-bold leading-relaxed text-[#23201d]">
          {isAr
            ? "طفل يبلغ 12 عاماً يعاني من التهاب مفاصل مهاجر وعقيدات تحت الجلد وحركات رقصية غير إرادية بعد 3 أسابيع من التهاب الحلق. أي مما يلي يُعتبر معياراً رئيسياً (MAJOR criterion) وفق معايير جونز المعدلة؟"
            : "A 12-year-old boy presents with migratory polyarthritis, subcutaneous nodules, and choreiform movements 3 weeks after an untreated sore throat. Which of the following is considered a MAJOR criterion in the revised Jones criteria?"}
        </h4>
      </div>

      {/* Answer Options */}
      <div className="mt-3.5 space-y-2">
        {options.map((opt) => {
          const isChosen = selected === opt.label;
          const isRight = submitted && opt.isCorrect;
          const isWrong = submitted && isChosen && !opt.isCorrect;

          let btnClass = "border-black/[0.08] bg-white hover:border-[#1d4d6b]/40 text-[#3a352e]";
          let pillClass = "bg-black/[0.05] text-[#6b655c]";

          if (isRight) {
            btnClass = "border-emerald-300 bg-emerald-50 text-emerald-900";
            pillClass = "bg-emerald-600 text-white";
          } else if (isWrong) {
            btnClass = "border-rose-300 bg-rose-50 text-rose-900";
            pillClass = "bg-rose-600 text-white";
          } else if (isChosen) {
            btnClass = "border-[#1d4d6b] bg-[#d9ecf7]/40 text-[#1d4d6b]";
            pillClass = "bg-[#1d4d6b] text-white";
          }

          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setSelected(opt.label);
                setSubmitted(true);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all text-[13px] font-bold ${btnClass}`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${pillClass}`}>
                {opt.label}
              </span>
              <span className="flex-1 leading-tight">{opt.text}</span>
              {isRight && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {isWrong && <XCircle size={16} className="text-rose-600 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Submit / Next Action */}
      {!submitted ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="w-full rounded-xl bg-[#1d4d6b] py-2 text-center text-xs font-black text-white transition-opacity hover:opacity-90"
          >
            {isAr ? "تأكيد الإجابة وإظهار الشرح" : "Submit Answer & View Explanation"}
          </button>
        </div>
      ) : null}

      {/* Authentic Green Slide-down Explanation Drawer */}
      {submitted && (
        <div className="mt-3.5 rounded-xl border border-emerald-200 bg-[#f0fdf4] p-3.5 text-xs animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 font-black text-emerald-900">
            <Lightbulb size={14} className="text-emerald-600" />
            <span>{isAr ? "الشرح السريري المعتمد:" : "Clinical Explanation & Concept:"}</span>
          </div>
          <p className="mt-1.5 leading-relaxed text-emerald-950 font-medium">
            {isAr ? (
              <>
                <strong className="font-black text-emerald-900">رقص سيدنهام (Sydenham chorea)</strong> هو أحد المعايير الخمسة الرئيسية في معايير جونز (مجموعة في كلمة <strong>JONES</strong>: Joints, ♥ Carditis, Nodules, Erythema marginatum, Sydenham chorea). أما ألم المفاصل وارتفاع ESR/CRP وتطاول PR في تخطيط القلب فهي معايير <strong>فرعية (Minor)</strong> وليست رئيسية.
              </>
            ) : (
              <>
                <strong className="font-black text-emerald-900">Sydenham chorea</strong> is one of the 5 Major Jones criteria (Mnemonic <strong>JONES</strong>: <strong>J</strong>oints polyarthritis, <strong>♥</strong> Carditis, <strong>N</strong>odules subcutaneous, <strong>E</strong>rythema marginatum, <strong>S</strong>ydenham chorea). Arthralgia, elevated ESR/CRP, and prolonged PR interval are <strong>MINOR</strong> criteria.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   3. MEMORY LAB: Authentic Matching Game with Real Medical Pairs
   ========================================================================= */
function MemoryLabMock({ isAr, tool }: { isAr: boolean; tool: ToolDef }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [score, setScore] = useState(200);
  const [justMatched, setJustMatched] = useState(false);

  // Pairs: Drug <-> Indication
  const cards = [
    { id: "1a", pair: "1", text: isAr ? "أتروبين (Atropine)" : "Atropine", type: "drug" },
    { id: "1b", pair: "1", text: isAr ? "بطء القلب العرضي" : "Symptomatic Bradycardia", type: "indication" },
    { id: "2a", pair: "2", text: isAr ? "إبينفرين (Epi)" : "Epinephrine IM", type: "drug" },
    { id: "2b", pair: "2", text: isAr ? "صدمة التأق (Anaphylaxis)" : "Anaphylaxis", type: "indication" },
    { id: "3a", pair: "3", text: isAr ? "ديجوكسين (Digoxin)" : "Digoxin", type: "drug" },
    { id: "3b", pair: "3", text: isAr ? "قصور القلب والرجفان" : "Heart Failure & AFib", type: "indication" },
  ];

  // Auto-matching simulation loop
  useEffect(() => {
    let t1: any, t2: any, t3: any;

    const runLoop = () => {
      setMatchedIds([]);
      setSelectedId(null);
      setJustMatched(false);
      setScore(200);

      t1 = setTimeout(() => {
        setSelectedId("1a"); // Atropine
      }, 1600);

      t2 = setTimeout(() => {
        setSelectedId(null);
        setMatchedIds(["1a", "1b"]);
        setJustMatched(true);
        setScore((s) => s + 100);
      }, 3000);

      t3 = setTimeout(() => {
        runLoop();
      }, 7500);
    };

    runLoop();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isAr]);

  const handleTileClick = (item: (typeof cards)[0]) => {
    if (matchedIds.includes(item.id)) return;
    if (!selectedId) {
      setSelectedId(item.id);
    } else if (selectedId === item.id) {
      setSelectedId(null);
    } else {
      const first = cards.find((c) => c.id === selectedId);
      if (first && first.pair === item.pair) {
        setMatchedIds([...matchedIds, first.id, item.id]);
        setSelectedId(null);
        setJustMatched(true);
        setScore((s) => s + 100);
      } else {
        setSelectedId(item.id);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-[#f6ddd5]/50 p-4 sm:p-5 shadow-inner">
      {/* Game Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-black text-[#7d3421]">
            {isAr ? "مختبر المطابقة السريعة" : "Memory Lab • Match Pairs"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-[#7d3421] shadow-sm">
            <Trophy size={12} className="text-amber-500" />
            {score} {isAr ? "نقطة" : "pts"}
          </span>
          {justMatched && (
            <span className="rounded-full bg-[#d8ecdd] px-2 py-0.5 text-[10px] font-black text-[#215237] animate-in zoom-in duration-150">
              🔥 2x Combo
            </span>
          )}
        </div>
      </div>

      {/* Grid of 6 Match Tiles */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {cards.map((card) => {
          const isSelected = selectedId === card.id;
          const isMatched = matchedIds.includes(card.id);

          let tileStyle = "bg-white border-black/[0.08] text-[#23201d] hover:border-[#7d3421]/50";
          if (isMatched) {
            tileStyle = "bg-[#d8ecdd] border-emerald-300 text-[#215237] opacity-80";
          } else if (isSelected) {
            tileStyle = "bg-[#7d3421] text-white border-[#7d3421] shadow-md scale-105";
          }

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleTileClick(card)}
              className={`flex h-16 sm:h-20 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all duration-200 active:scale-95 ${tileStyle}`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider opacity-70">
                {card.type === "drug"
                  ? isAr ? "دواء" : "Drug"
                  : isAr ? "استطباب" : "Indication"}
              </span>
              <span className="mt-1 text-[12px] sm:text-[13px] font-black leading-tight">
                {card.text}
              </span>
              {isMatched && (
                <span className="mt-0.5 text-[10px] font-bold text-[#215237]">✓ {isAr ? "متطابق" : "Matched"}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-center text-[11px] text-[#7d3421]/80 font-medium">
        {isAr ? "انقر على الدواء ثم استطبابه للمطابقة الفورية" : "Tap a drug and then its matching indication"}
      </div>
    </div>
  );
}

/* =========================================================================
   4. PDF SUMMARY: Authentic Cream Paper Document with Highlighters
   ========================================================================= */
function PdfSummaryMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      {/* Document Top Bar */}
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-[#4a3877]" />
          <span className="font-bold text-[#23201d]">
            Cardiology_Valvular_Disease.pdf
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-[#e4dcf3] px-2 py-0.5 text-[10px] font-black text-[#4a3877]">
            {isAr ? "ورقة واحدة مركزة" : "1-Page Summary"}
          </span>
        </div>
      </div>

      {/* Cream Paper Note Sheet */}
      <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#fbf5e9] p-4 text-[#23201d]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#4a3877]">
            {isAr ? "أهم النقاط السريرية" : "Key Takeaways & Pathologies"}
          </span>
          <span className="text-[10px] font-bold text-[#8a8070]">Page 1 / 1</span>
        </div>

        <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-[#4a3877] font-black">•</span>
            <span>
              <strong className="bg-[#bbf7d0]/60 px-1 rounded">
                {isAr ? "تضيق الصمام الأبهري (AS):" : "Aortic Stenosis (AS):"}
              </strong>{" "}
              {isAr
                ? "السبب الأشيع عند كبار السن هو التكلس التنكسي، وعند الشباب الصمام ثنائي الشرف. يتظاهر بأعراض SAD (غشي، ذبحة، ضيق نفس)."
                : "Most common cause in elderly is calcific degeneration. Presenting triad is SAD (Syncope, Angina, Dyspnea)."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#4a3877] font-black">•</span>
            <span>
              <strong className="bg-[#fed7aa]/60 px-1 rounded">
                {isAr ? "قصور التاجي (MR):" : "Mitral Regurgitation (MR):"}
              </strong>{" "}
              {isAr
                ? "نفخة شاملة للانقباض عند قمة القلب تنتشر للإبط الأيسر، تشاهد بكثرة بعد احتشاء العضلة القلبية أو تدلي الصمام."
                : "Holosystolic blowing murmur at apex radiating to axilla, common post-MI or MVP."}
            </span>
          </li>
        </ul>

        {/* Clinical Pearl Box */}
        <div className="mt-3 rounded-lg border border-amber-300/80 bg-amber-50/70 p-2.5 text-[11.5px] text-amber-950 font-medium">
          <span className="font-black text-amber-900">⚡ {isAr ? "درّة سريرية:" : "Clinical Pearl:"}</span>{" "}
          {isAr
            ? "نبض النبضان المتأخر والضعيف (Pulsus parvus et tardus) هو العلامة الفارقة لتضيق الأبهر الشديد."
            : "Pulsus parvus et tardus (weak & delayed carotid pulse) is pathognomonic for severe aortic stenosis."}
        </div>
      </div>

      {/* Action Pills */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-bold text-[#4a3877]">
          <FileDown size={13} /> {isAr ? "تصدير إلى PDF" : "Export to PDF"}
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-[#2f7d55]">
          <Sparkles size={13} /> {isAr ? "استخراج 18 بطاقة فلاش" : "Extract 18 Flashcards"}
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   5. ALL-IN-ONE RITA AI: Studio with 3 Pipeline Stages
   ========================================================================= */
function AllInOneMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      {/* File Upload Box */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#3f2c73]/30 bg-[#f7f2fb] p-3 text-xs">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#3f2c73] text-white font-black text-[10px]">
          PDF
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-[#23201d]">
            Cardiology_Lecture_04.pdf
          </div>
          <div className="text-[10px] text-[#6b655c]">4.2 MB • {isAr ? "اكتمل الرفع" : "Upload complete"}</div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          ✓ {isAr ? "جاهز للتحليل" : "Ready"}
        </span>
      </div>

      {/* 3 Pipeline Stages */}
      <div className="mt-3.5 space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-[#fbf5e9] p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
              ✓
            </span>
            <span className="font-bold text-[#23201d]">
              {isAr ? "1. الملخص المركز (ورقة واحدة)" : "1. High-Yield Summary (1 Page)"}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700">
            {isAr ? "تم الإنشاء" : "Generated"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-[#fbf5e9] p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
              ✓
            </span>
            <span className="font-bold text-[#23201d]">
              {isAr ? "2. بطاقات الفلاش كارد (خوارزمية SM-2)" : "2. Spaced Repetition Cards (SM-2)"}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700">
            24 {isAr ? "بطاقة" : "cards"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-[#fbf5e9] p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
              ✓
            </span>
            <span className="font-bold text-[#23201d]">
              {isAr ? "3. أسئلة بنك الأسئلة مع الشرح" : "3. Question Bank MCQs + Explanations"}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700">
            12 {isAr ? "سؤالاً" : "MCQs"}
          </span>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="w-full rounded-xl bg-[#3f2c73] py-2 text-center text-xs font-black text-white shadow-sm flex items-center justify-center gap-1.5">
          <Sparkles size={13} />
          {isAr ? "كل المواد محفوظة في مساحتك الدراسية" : "Saved directly to your Study Space"}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. TO-DO LIST: Revision Planner with Streak & Checkboxes
   ========================================================================= */
function TodoListMock({ isAr }: { isAr: boolean }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: isAr ? "مراجعة 20 بطاقة قلبية (الموعد اليوم)" : "Review 20 Cardiology Flashcards", done: true, priority: "high" },
    { id: 2, text: isAr ? "حل 10 أسئلة في بنك الأسئلة" : "Solve 10 questions in Question Bank", done: true, priority: "normal" },
    { id: 3, text: isAr ? "قراءة ملخص أمراض الصمامات PDF" : "Read Valvular Disease Summary PDF", done: false, priority: "high" },
  ]);

  const toggle = (id: number) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <span className="font-black text-[#215237]">
          {isAr ? "خطة المراجعة اليومية" : "Today's Study Plan"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#d8ecdd] px-2.5 py-0.5 text-[11px] font-black text-[#215237]">
          <Flame size={12} className="text-orange-500 fill-orange-500" />
          5 {isAr ? "أيام متتالية" : "Day Streak"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] bg-[#fbf5e9] p-2.5 text-left transition-colors hover:bg-white"
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-black transition-colors ${
                t.done ? "bg-[#215237] text-white" : "border border-black/20 bg-white"
              }`}
            >
              {t.done ? "✓" : ""}
            </span>
            <span
              className={`flex-1 text-[13px] font-bold transition-opacity ${
                t.done ? "line-through opacity-50 text-[#23201d]" : "text-[#23201d]"
              }`}
            >
              {t.text}
            </span>
            {t.priority === "high" && !t.done && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                {isAr ? "أولوية" : "High"}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 text-center text-[10.5px] text-[#6b655c]">
        {isAr ? "انقر لتحديد المهام المنجزة وتحديث جدولك" : "Click to mark tasks completed and boost your streak"}
      </div>
    </div>
  );
}

/* =========================================================================
   7. EXAM SCHEDULE: Calendar & Countdown
   ========================================================================= */
function ExamScheduleMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      {/* Hero Exam Countdown Card */}
      <div className="rounded-xl border border-[#2f6318]/20 bg-[#e6f0d8]/50 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black text-[#2f6318]">
            {isAr ? "الامتحان القادم" : "Next Exam Countdown"}
          </span>
          <span className="rounded-full bg-[#2f6318] px-2.5 py-0.5 text-[10px] font-black text-white animate-pulse">
            ⏳ {isAr ? "باقي 4 أيام" : "In 4 days"}
          </span>
        </div>
        <h4 className="mt-1.5 font-display text-[15px] font-black text-[#23201d]">
          {isAr ? "امتحان الباطنة النهائي (Internal Medicine)" : "Internal Medicine Final Examination"}
        </h4>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#4a453d]">
          <span>{isAr ? "18 سبتمبر 2026" : "18 Sep 2026"}</span>
          <span className="font-bold text-[#2f6318]">
            85% {isAr ? "من المنهاج تمت مراجعته" : "syllabus reviewed"}
          </span>
        </div>
      </div>

      {/* Mini Month Matrix Preview */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
        {Array.from({ length: 14 }).map((_, i) => {
          const day = i + 10;
          const isExam = day === 18;
          return (
            <div
              key={i}
              className={`rounded-lg py-1.5 font-bold transition-all ${
                isExam
                  ? "bg-[#2f6318] text-white shadow-sm font-black scale-105"
                  : "bg-black/[0.03] text-[#4a453d]"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   8. LECTURE LAB: Audio/Video Player with Synced Questions
   ========================================================================= */
function LectureLabMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-[#2f6318]" />
          <span className="font-bold text-[#23201d]">
            {isAr ? "محاضرة 4 — الدورة القلبية والأصوات" : "Lecture 04 — Cardiac Cycle & Murmurs"}
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#2f6318]">14:20 / 45:00</span>
      </div>

      {/* Progress Track */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-black/[0.07]">
        <div className="h-full w-[35%] rounded-full bg-[#2f6318]" />
      </div>

      {/* Synced Quiz Popup */}
      <div className="mt-3 rounded-xl border border-[#2f6318]/20 bg-[#f7faf4] p-3 text-xs">
        <div className="flex items-center gap-1.5 font-black text-[#2f6318]">
          <HelpCircle size={13} />
          {isAr ? "سؤال لحظي من المحاضرة (14:20):" : "Checkpoint Question from Lecture (14:20):"}
        </div>
        <p className="mt-1 font-bold text-[#23201d]">
          {isAr ? "أي الصمامات ينغلق تزامناً مع سماع الصوت الأول S1؟" : "Which valves close to produce the S1 heart sound?"}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <span className="rounded-lg bg-emerald-100 p-1.5 text-center font-bold text-emerald-900 border border-emerald-300">
            ✓ {isAr ? "التاجي وثلاثي الشرف" : "Mitral & Tricuspid"}
          </span>
          <span className="rounded-lg bg-white p-1.5 text-center font-bold text-[#6b655c] border border-black/[0.08]">
            {isAr ? "الأبهري والرئوي" : "Aortic & Pulmonic"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   9. SHARED DECKS: Community Deck Preview
   ========================================================================= */
function SharedDecksMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <span className="font-black text-[#3d5c14]">
          {isAr ? "المجموعات المشتركة في ريتاجت" : "RitaJet Community Decks"}
        </span>
        <span className="rounded-full bg-[#e6f4d8] px-2 py-0.5 text-[10px] font-black text-[#3d5c14]">
          {isAr ? "مشاركة عامة" : "Public Sharing"}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#fbf5e9] p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#23201d]">
            {isAr ? "فارماكولوجي الباطنة المركزة (USMLE)" : "High-Yield Pharmacology (USMLE Step 1)"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-[#6b655c]">
          140 {isAr ? "بطاقة • د. سارة (مساهم مميز)" : "cards • By Dr. Sarah (Top Contributor)"}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-black text-amber-600">⭐ 4.9 (420 {isAr ? "تقييم" : "reviews"})</span>
          <button
            type="button"
            className="rounded-lg bg-[#3d5c14] px-2.5 py-1 text-[11px] font-black text-white"
          >
            + {isAr ? "إضافة لبطاقاتي" : "Save to my decks"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   10. SPACES & CLASSROOMS: Study Group & Deck Folders
   ========================================================================= */
function SpacesMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
        <span className="font-black text-[#4a3877]">
          {isAr ? "دفعة الطب البشري 2027" : "Clinical Medicine Class 2027"}
        </span>
        <span className="text-[11px] font-bold text-[#6b655c]">142 {isAr ? "طالب" : "students"}</span>
      </div>

      <div className="mt-3 space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-[#f3e8ff]/50 p-2.5 border border-[#4a3877]/15">
          <span className="font-bold text-[#23201d]">📁 {isAr ? "مجلد أمراض القلب (4 مجموعات)" : "Cardiology Decks (4 sets)"}</span>
          <span className="text-[10px] text-[#4a3877] font-bold">{isAr ? "متاح للجميع" : "Shared"}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[#f3e8ff]/50 p-2.5 border border-[#4a3877]/15">
          <span className="font-bold text-[#23201d]">📁 {isAr ? "مجلد علم الأمراض (6 مجموعات)" : "Pathology Decks (6 sets)"}</span>
          <span className="text-[10px] text-[#4a3877] font-bold">{isAr ? "محدث أمس" : "Updated"}</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   11. GERMAN LAB: der / die / das Word Trainer
   ========================================================================= */
function GermanLabMock({ isAr }: { isAr: boolean }) {
  const [selectedArticle, setSelectedArticle] = useState<string>("die");

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-[#dceafb]/40 p-4 sm:p-5 shadow-inner">
      <div className="rounded-xl border border-black/[0.06] bg-white p-4 text-center shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#12315e]">
          {isAr ? "مختبر الكلمات الألمانية" : "German Article Trainer"}
        </span>
        <h4 className="mt-1 font-display text-[22px] font-black text-[#23201d]">
          <span className="text-emerald-700">{selectedArticle}</span> Nacht
        </h4>
        <div className="text-[11.5px] text-[#6b655c]">{isAr ? "المعنى: الليل" : "Meaning: The Night"}</div>
        <p className="mt-2 text-[12px] italic text-[#4a453d]">
          "Gute Nacht, bis morgen!"
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {["der", "die", "das"].map((art) => {
          const isRight = art === "die";
          const isChosen = selectedArticle === art;
          return (
            <button
              key={art}
              type="button"
              onClick={() => setSelectedArticle(art)}
              className={`rounded-xl py-2 font-black transition-all ${
                isChosen
                  ? isRight
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-rose-500 text-white"
                  : "bg-white text-[#23201d] border border-black/[0.08]"
              }`}
            >
              {art}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   12. TIMER: Focus Timer
   ========================================================================= */
function TimerMock({ isAr }: { isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5 text-center shadow-sm">
      <div className="text-xs font-bold text-[#6b655c]">
        {isAr ? "مؤقت التركيز الدراسي" : "Study Focus Timer"}
      </div>
      <div className="mt-3 inline-grid h-28 w-28 place-items-center rounded-full border-4 border-emerald-600 bg-[#f0fdf4]">
        <span className="font-display text-[26px] font-black tabular-nums text-[#23201d]">
          25:00
        </span>
      </div>
      <div className="mt-2 text-[11px] font-bold text-emerald-800">
        {isAr ? "استراحة بعد 25 دقيقة" : "Break in 25 minutes"}
      </div>
    </div>
  );
}
