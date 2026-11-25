import { useWorkspaceTask, useWorkspaceGuard } from "./admin/WorkspaceGuard";
import { toast } from "sonner";
import { Clapperboard, ListChecks, ChevronLeft } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { supabase } from "@/integrations/supabase/legacy-client";
import { lqBoard, type LqOption } from "@/lib/lecture-lab.functions";
import { exerciseMode, stopClipCount, type PathItem } from "@/lib/rita-path-layout";
import "./path-quiz.css";

const FilmEditor = lazy(() => import("./FilmPractice").then((m) => ({ default: m.FilmEditor })));
const FilmStopPlayer = lazy(() =>
  import("./FilmPractice").then((m) => ({ default: m.FilmStopPlayer })),
);
const ClipStopEditor = lazy(() =>
  import("./clips/ClipStopEditor").then((m) => ({ default: m.ClipStopEditor })),
);

type Props = {
  item: PathItem;
  admin: boolean;
  settings?: ReactNode;
  onClose: () => void;
  onChanged: () => Promise<void>;
};
type Draft = { id: string; stem: string; options: LqOption[]; explanation: string | null };
type Published = { version: string; questions: { stem: string; options: string[] }[] };
type Mark = { choice: number; answer: number; explanation: string };
function useCopy() {
  const ar = useUiLanguage() === "ar";
  return (en: string, arabic: string) => (ar ? arabic : en);
}
function message(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error);
}

export function PathQuiz(props: Props) {
  const lang = useUiLanguage();
  const t = useCopy();
  const guard = useWorkspaceGuard();
  const choices = [
    {
      id: "film",
      name: t("Film clips & GIFs", "تمارين المقاطع وGIF"),
      hint: t(
        "Practise each phrase as a film clip or GIF",
        "تدرّب على نفس الجملة كمقطع أو صورة متحرّكة",
      ),
      count: stopClipCount(props.item),
      Icon: Clapperboard,
    },
    {
      id: "quiz",
      name: props.admin ? t("Question bank", "بنك الأسئلة") : t("Quiz", "اختبار"),
      hint: props.admin
        ? t("Choose questions by subject", "اختَر أسئلة من مواد مختبر المحاضرات")
        : t("Answer and check your result", "جاوب وراجع نتيجتك"),
      count: props.item.quiz_count ?? 0,
      Icon: ListChecks,
    },
  ] as const;
  // A quiz stop or a clips stop holds one kind only and opens straight on it. An older stop
  // holding both kinds (or an empty one without a kind) still offers the choice.
  const fixed = exerciseMode(props.item);
  const only = fixed === "quiz" ? "quiz" : fixed === "clips" ? "film" : null;
  const available = choices.filter((option) =>
    only ? option.id === only : props.admin || option.count > 0,
  );
  const [mode, setMode] = useState<(typeof choices)[number]["id"] | null>(null);
  const active =
    mode ?? only ?? (!props.admin && available.length === 1 ? available[0].id : null);
  const back = () => setMode(null);
  const afterSave = () => {
    toast.success(t("Station exercises saved", "انحفظت تمارين المحطة"));
    back();
  };
  return (
    <div className="path-quiz" dir={lang === "ar" ? "rtl" : "ltr"}>
      {active === null ? (
        <>
          <h4>
            {props.admin
              ? t("Choose an exercise type", "اختَر نوع التمرين")
              : t("Choose a practice", "اختَر تدريبك")}
          </h4>
          {available.map(({ id, name, hint, count, Icon }) => (
            <button
              key={id}
              type="button"
              className="pq-option pq-kind"
              onClick={() => (guard ? guard.leave(() => setMode(id)) : setMode(id))}
            >
              <span className="pq-kind-icon">
                <Icon size={23} />
              </span>
              <span>
                <strong>{name}</strong>
                <small>{hint}</small>
              </span>
              <span className="pq-kind-count">{count || "+"}</span>
            </button>
          ))}
          {props.admin && props.settings && (
            <details className="pq-settings">
              <summary>{t("Station settings", "إعدادات المحطة")}</summary>
              {props.settings}
            </details>
          )}
        </>
      ) : (
        <>
          {!only && (props.admin || available.length > 1) && (
            <button className="pq-back" onClick={() => (guard ? guard.leave(back) : back())}>
              <ChevronLeft size={16} />
              {t("Exercise types", "أنواع التمارين")}
            </button>
          )}
          {active === "quiz" ? (
            props.admin ? (
              <Editor {...props} onClose={afterSave} />
            ) : (
              <Player {...props} />
            )
          ) : (
            <Suspense fallback={<p role="status">{t("Loading…", "جارٍ التحميل…")}</p>}>
              {!props.admin ? (
                <FilmStopPlayer item={props.item} onClose={props.onClose} />
              ) : props.item.clip_ids ? (
                <ClipStopEditor
                  stop={{
                    id: props.item.id,
                    title: props.item.title,
                    clip_ids: props.item.clip_ids,
                  }}
                  onSaved={async () => {
                    await props.onChanged();
                    toast.success(t("Station exercises saved", "انحفظت تمارين المحطة"));
                  }}
                  onClose={back}
                />
              ) : (
                // Before the clips library migration a stop still holds Sintel lines.
                <FilmEditor key={active} {...props} onClose={afterSave} />
              )}
            </Suspense>
          )}
          {only && props.admin && props.settings && (
            <details className="pq-settings">
              <summary>{t("Station settings", "إعدادات المحطة")}</summary>
              {props.settings}
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Editor({ item, onChanged, onClose }: Props) {
  const t = useCopy();
  const boardFn = useServerFn(lqBoard);
  const board = useQuery({
    queryKey: ["path-quiz-source", item.id],
    queryFn: () => boardFn(),
    gcTime: 0,
  });
  const [title, setTitle] = useState(item.title);
  const [search, setSearch] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [preview, setPreview] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const finishTask = useWorkspaceTask(busy);
  const guard = useWorkspaceGuard();
  const lectures =
    board.data?.lectures.filter((l) => topics.includes(l.subtopic_id) && l.question_count > 0) ??
    [];
  const available = lectures.reduce((n, l) => n + l.question_count, 0);
  const target = Math.min(available, count, 50);
  const query = search.trim().toLowerCase();
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("preview_path_quiz", { p_topics: topics, p_count: target });
      if (result.error) throw result.error;
      const pool = result.data as Draft[];
      if (pool.length < target)
        throw new Error(
          t(
            "The available questions changed. Refresh your selection.",
            "تغيّر عدد الأسئلة المتاحة. حدّث اختيارك.",
          ),
        );
      setPreview(pool);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("publish_path_quiz", {
        p_item: item.id,
        p_title: title.trim(),
        p_questions: preview,
      });
      if (r.error) throw r.error;
      await onChanged();
      finishTask();
      guard?.saved();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (board.isPending)
    return <p role="status">{t("Loading Lecture Lab…", "عم نحمّل Lecture Lab…")}</p>;
  if (board.isError)
    return (
      <button onClick={() => void board.refetch()}>
        {t("Retry loading subjects", "أعد تحميل المواد")}
      </button>
    );
  return (
    <fieldset disabled={busy}>
      <label>
        {t("Quiz name", "اسم الاختبار")}
        <input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {preview.length ? (
        <>
          <h4>
            {t("Review before publishing", "معاينة قبل النشر")} · {preview.length}
          </h4>
          <ol className="pq-review">
            {preview.map((q) => (
              <li key={q.id}>
                <strong dir="auto">{q.stem}</strong>
                <ul>
                  {q.options.map((o, i) => (
                    <li key={i} dir="auto">
                      {o.is_correct ? "✓ " : ""}
                      {o.body}
                    </li>
                  ))}
                </ul>
                <p dir="auto">{q.explanation}</p>
              </li>
            ))}
          </ol>
          <button onClick={() => setPreview([])}>{t("Change selection", "تعديل الاختيار")}</button>
          <button className="pq-primary" disabled={!title.trim()} onClick={publish}>
            {t("Publish to path", "انشر في المسار")}
          </button>
        </>
      ) : (
        <>
          <label>
            {t("Lecture Lab subjects", "مواد Lecture Lab")}
            <input
              type="search"
              data-workspace-transient
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search subjects and topics", "ابحث عن مادة أو موضوع فرعي")}
            />
          </label>
          <div className="pq-topics">
            {board.data.subjects.map((subject) => {
              const children = board.data.subtopics.filter(
                (s) =>
                  s.subject_id === subject.id &&
                  (subject.name.toLowerCase().includes(query) ||
                    s.name.toLowerCase().includes(query)),
              );
              if (!children.length) return null;
              return (
                <details key={subject.id} open={query ? true : undefined}>
                  <summary>{subject.name}</summary>
                  {children.map((s) => {
                    const n = board.data.lectures
                      .filter((l) => l.subtopic_id === s.id)
                      .reduce((sum, l) => sum + l.question_count, 0);
                    return (
                      <label key={s.id}>
                        <input
                          type="checkbox"
                          checked={topics.includes(s.id)}
                          disabled={!n}
                          onChange={(e) =>
                            setTopics(
                              e.target.checked
                                ? [...topics, s.id]
                                : topics.filter((id) => id !== s.id),
                            )
                          }
                        />
                        <span>{s.name}</span>
                        <small>{n}</small>
                      </label>
                    );
                  })}
                </details>
              );
            })}
          </div>
          {!board.data.subtopics.some(
            (s) =>
              s.name.toLowerCase().includes(query) ||
              board.data.subjects.some(
                (a) => a.id === s.subject_id && a.name.toLowerCase().includes(query),
              ),
          ) && <p>{t("No matching topics", "ما في مواضيع مطابقة")}</p>}
          <label>
            {t("Questions in quiz", "عدد أسئلة الاختبار")} · {t("available", "المتاح")} {available}
            <input
              type="number"
              min={1}
              max={Math.min(50, available) || 1}
              value={available ? target || "" : ""}
              onChange={(e) => setCount(Math.max(0, Math.floor(Number(e.target.value))))}
            />
          </label>
          <button className="pq-primary" disabled={!target || !title.trim()} onClick={prepare}>
            {t("Preview questions", "عاين الأسئلة")} · {target}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}

function Player({ item, onClose }: Props) {
  const t = useCopy();
  const quiz = useQuery({
    queryKey: ["published-path-quiz", item.id],
    queryFn: async () => {
      const r = await supabase.rpc("read_path_quiz", { p_item: item.id });
      if (r.error) throw r.error;
      return r.data as Published | null;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  if (quiz.isPending) return <p role="status">{t("Loading quiz…", "عم نحمّل الاختبار…")}</p>;
  if (quiz.isError)
    return (
      <button onClick={() => void quiz.refetch()}>
        {t("Retry loading quiz", "أعد تحميل الاختبار")}
      </button>
    );
  if (!quiz.data)
    return <p>{t("This quiz has not been published yet.", "لسّا ما نُشر اختبار بهاي المحطة.")}</p>;
  return <Round key={quiz.data.version} item={item} quiz={quiz.data} onClose={onClose} />;
}

function Round({ item, quiz, onClose }: { item: PathItem; quiz: Published; onClose: () => void }) {
  const t = useCopy();
  const [index, setIndex] = useState(0),
    [choice, setChoice] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = quiz.questions[index],
    mark = marks[index];
  async function confirm() {
    if (choice === null || busy || mark) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("answer_path_quiz", {
        p_item: item.id,
        p_version: quiz.version,
        p_index: index,
        p_choice: choice,
      });
      if (r.error) throw r.error;
      setMarks((old) => [...old, { choice, ...r.data }]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!q)
    return (
      <div>
        <h4>
          {t("Your result", "نتيجتك")} · {marks.filter((m) => m.choice === m.answer).length} /{" "}
          {marks.length}
        </h4>
        <ol className="pq-review">
          {marks.map(
            (m, i) =>
              m.choice !== m.answer && (
                <li key={i}>
                  <strong dir="auto">{quiz.questions[i].stem}</strong>
                  <p>
                    {t("Your answer", "إجابتك")}: {quiz.questions[i].options[m.choice]}
                  </p>
                  <p>✓ {quiz.questions[i].options[m.answer]}</p>
                  <p dir="auto">{m.explanation}</p>
                </li>
              ),
          )}
        </ol>
        <button className="pq-primary" onClick={onClose}>
          {t("Back to the path", "ارجع للمسار")}
        </button>
      </div>
    );
  return (
    <div>
      <small>
        {t("Question", "السؤال")} {index + 1} / {quiz.questions.length}
      </small>
      <progress
        aria-label={t("Answered questions", "الأسئلة المجابة")}
        max={quiz.questions.length}
        value={marks.length}
      />
      <h4 dir="auto">{q.stem}</h4>
      {q.options.map((body, i) => (
        <button
          className="pq-option"
          disabled={!!mark || busy}
          aria-pressed={choice === i}
          key={i}
          onClick={() => setChoice(i)}
        >
          <b>{String.fromCharCode(65 + i)}</b>
          <span dir="auto">{body}</span>
          {mark && i === mark.answer && " ✓"}
        </button>
      ))}
      {mark ? (
        <>
          <p role="status">
            <strong>
              {mark.answer === mark.choice
                ? t("Correct", "صحيح")
                : t("Incorrect", "إجابة غير صحيحة")}
            </strong>
            <br />
            <span dir="auto">{mark.explanation}</span>
          </p>
          <button
            className="pq-primary"
            onClick={() => {
              setIndex(index + 1);
              setChoice(null);
            }}
          >
            {index + 1 === quiz.questions.length
              ? t("Show result", "اعرض النتيجة")
              : t("Next question", "السؤال التالي")}
          </button>
        </>
      ) : (
        <button className="pq-primary" disabled={busy || choice === null} onClick={confirm}>
          {t("Check answer", "أكّد الإجابة")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
