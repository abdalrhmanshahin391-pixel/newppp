// Review and publish, one lesson on a page of its own: whether it is ready, what the learner learns
// in it, and the buttons to see it as a learner and to publish it. The advanced editor (goals and
// plan, slides, resources) opens on a page of its own too, never in a side panel.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  Info,
  Loader2,
  MoreHorizontal,
  Send,
  Undo2,
  X,
} from "lucide-react";
import type { Resource } from "@/lib/rita-resources";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { BidiText } from "../book/BookBits";
import { pagesLabel } from "../book/book-utils";
import { LessonDrawer } from "../book/LessonDrawer";
import type { PublishActions, PublishEntry } from "./usePublishActions";

type Mark = "ok" | "warn" | "no" | "info";

function Check1({ mark, children }: { mark: Mark; children: ReactNode }) {
  const Icon = mark === "ok" ? Check : mark === "warn" ? AlertTriangle : mark === "no" ? X : Info;
  return (
    <li>
      <span className={`la-dot is-${mark}`} aria-hidden="true">
        <Icon size={14} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function PublishLesson({
  entry,
  linked,
  actions,
  onBack,
  onEdit,
}: {
  entry: PublishEntry;
  linked: boolean;
  actions: PublishActions;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { lesson, book } = entry;
  const published = entry.readiness === "published";
  const unfinished = entry.readiness === "no_slides";
  const busy = Boolean(actions.busy);

  return (
    <div>
      <button type="button" className="la-back" onClick={onBack}>
        <ArrowRight size={16} aria-hidden="true" /> كل الدروس
      </button>

      <section className="la-detail-hero">
        <div className="la-detail-cover">
          <LessonImage src={lesson.image_url} alt="" className="h-full w-full !rounded-none" />
        </div>
        <div className="min-w-0">
          <div className="la-chips">
            <span className="la-chip is-ink">{entry.level}</span>
            <span className="la-chip">{book.title_ar || book.title}</span>
            <span className="la-chip">
              {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
            </span>
            {published ? (
              <span className="la-chip is-green">
                <Check size={13} aria-hidden="true" /> منشور
              </span>
            ) : unfinished ? (
              <span className="la-chip is-amber">لسا ما كمل</span>
            ) : entry.notes > 0 ? (
              <span className="la-chip is-amber">جاهز · {entry.notes} ملاحظات</span>
            ) : (
              <span className="la-chip is-blue">جاهز للنشر</span>
            )}
          </div>
          <h1 className="la-detail-title">
            <BidiText text={lesson.title_ar || lesson.title} />
          </h1>
          {lesson.title_ar && (
            <p className="la-sub" dir="ltr" style={{ textAlign: "right" }}>
              {lesson.title}
            </p>
          )}
        </div>
      </section>

      <div className="la-detail">
        <section className="la-card" aria-labelledby="la-ready-title">
          <h2 id="la-ready-title" className="la-section-title">
            جاهزيته
          </h2>
          <ul className="la-checks">
            <Check1 mark={linked ? "ok" : "no"}>
              {linked
                ? "الشرائح جاهزة ومربوطة بالدرس"
                : "الشرائح لسا مش جاهزة. كمّله من مصنع الدروس."}
            </Check1>
            <Check1 mark={lesson.objectives.length ? "ok" : "warn"}>
              {lesson.objectives.length
                ? `يوزرا جاهزة تشرح (${lesson.objectives.length} أهداف)`
                : "ما في أهداف للدرس، فيوزرا ما عندها شو تتأكد منه."}
            </Check1>
            {linked && (
              <Check1 mark={entry.notes > 0 ? "warn" : "ok"}>
                {entry.notes > 0
                  ? `مراجعة الشرائح لقت ${entry.notes} ملاحظات (شي ناقص أو غلط). شوف الدرس كطالب قبل ما تنشره.`
                  : "مراجعة الشرائح ما لقت مشاكل"}
              </Check1>
            )}
            <Check1 mark={book.status === "published" ? "ok" : "info"}>
              {book.status === "published" ? "الكتاب منشور" : "الكتاب لسا مسودة، وبينشر مع الدرس"}
            </Check1>
            <Check1 mark={published ? "ok" : "info"}>
              {published
                ? `الطلاب بيشوفوه بالمسار بمستوى ${entry.level}`
                : `بعد النشر بينزل بالمسار بآخر مستوى ${entry.level}، وبتقدر تحرّكه بالسحب`}
            </Check1>
          </ul>
        </section>

        <section className="la-card" aria-labelledby="la-learn-title">
          <h2 id="la-learn-title" className="la-section-title">
            شو بيتعلّم الطالب
          </h2>
          {lesson.objectives.length ? (
            <ul className="la-goals">
              {lesson.objectives.map((goal) => (
                <li key={goal.id}>
                  <BidiText text={goal.text_ar || goal.text} />
                  {goal.text_ar && <small dir="ltr">{goal.text}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="la-note">ما في أهداف مكتوبة لهالدرس.</p>
          )}
          {lesson.vocabulary.length > 0 && (
            <>
              <h3 className="la-section-title mt-4">الكلمات ({lesson.vocabulary.length})</h3>
              <div className="la-words">
                {lesson.vocabulary.slice(0, 40).map((item, index) => (
                  <span key={`${item.word}-${index}`}>
                    <b dir="ltr">{item.word}</b>
                    {item.meaning_ar ? ` · ${item.meaning_ar}` : ""}
                  </span>
                ))}
              </div>
            </>
          )}
          <h3 className="la-section-title mt-4">من الكتاب</h3>
          <p className="m-0 text-[14.5px]">
            {book.title_ar || book.title} ·{" "}
            {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
          </p>
        </section>
      </div>

      <div className="la-publish-bar">
        {published ? (
          <button
            type="button"
            className="la-btn"
            disabled={busy}
            onClick={() => void actions.unpublish(entry)}
          >
            <Undo2 size={16} aria-hidden="true" /> إلغاء النشر
          </button>
        ) : (
          <button
            type="button"
            className="la-btn is-green"
            disabled={busy || unfinished}
            onClick={() => void actions.publish([entry])}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            انشر للكل
          </button>
        )}
        {linked && (
          <Link to="/rita-study" search={{ lesson: lesson.id, preview: true }} className="la-btn">
            <Eye size={16} aria-hidden="true" /> شوفه كطالب
          </Link>
        )}
        {unfinished && (
          <Link to="/admin/curricula" search={{ book: book.id }} className="la-btn is-ink">
            كمّله بمصنع الدروس
          </Link>
        )}
        <span className="me-auto" />
        <Menu.Root dir="rtl">
          <Menu.Trigger asChild>
            <button type="button" className="la-btn is-quiet" aria-label="خيارات الدرس">
              <MoreHorizontal size={18} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="rita-menu edith-premium">
              <Menu.Item className="rita-menu-item" onSelect={onEdit}>
                تعديل متقدم
                <small>الأهداف والخطة، الشرائح، المراجع</small>
              </Menu.Item>
              <Menu.Item
                className="rita-menu-item rita-menu-item-danger"
                onSelect={() => void actions.archive(entry).then((done) => done && onBack())}
              >
                احذف الدرس
                <small>بيختفي من القوائم ومن مسار الطلاب</small>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}

/** The advanced editor of one lesson, as a page: back, and the full editor under it. */
export function PublishLessonEdit({
  entry,
  linked,
  resources,
  resourcesReady,
  onBack,
  onChanged,
}: {
  entry: PublishEntry;
  linked: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <div>
      <button type="button" className="la-back" onClick={onBack}>
        <ArrowRight size={16} aria-hidden="true" /> رجوع للدرس
      </button>
      <section className="la-card mt-4">
        <LessonDrawer
          embedded
          lesson={entry.lesson}
          initialTab="plan"
          studyLinked={linked}
          readiness={entry.readiness}
          bookPublished={entry.book.status === "published"}
          resources={resources}
          resourcesReady={resourcesReady}
          onClose={onBack}
          onChanged={onChanged}
        />
      </section>
    </div>
  );
}
