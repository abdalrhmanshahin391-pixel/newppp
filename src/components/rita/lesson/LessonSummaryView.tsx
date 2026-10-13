import { Check, Layers } from "lucide-react";
import { formatMinutes, type LessonSummary } from "@/lib/rita-summary";

type Props = {
  summary: LessonSummary;
  onReview: () => void;
  onNewLesson: () => void;
};

/** What the lesson achieved: time spoken, new words, mistakes worth repeating, and what to do next. */
export function LessonSummaryView({ summary, onReview, onNewLesson }: Props) {
  const { retries } = summary;
  return (
    <section className="rl-summary" aria-labelledby="rl-summary-title">
      <h2 id="rl-summary-title">Lesson complete</h2>
      <dl className="rl-stats">
        <div className="rl-stat">
          <dt>You spoke for</dt>
          <dd>{formatMinutes(summary.speakMs)}</dd>
        </div>
        <div className="rl-stat">
          <dt>Lesson length</dt>
          <dd>{formatMinutes(summary.durationMs)}</dd>
        </div>
        <div className="rl-stat">
          <dt>Your turns</dt>
          <dd>{summary.turns}</dd>
        </div>
        <div className="rl-stat">
          <dt>Corrections fixed</dt>
          <dd>
            {retries.fixed}
            <small style={{ fontSize: "0.8rem", fontWeight: 400 }}>
              {" "}
              / {summary.corrections.length}
            </small>
          </dd>
        </div>
      </dl>

      {summary.newWords.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>New words and phrases</h3>
          <ul className="rl-list">
            {summary.newWords.map((item) => (
              <li key={`${item.language}:${item.term}`}>
                <span dir="auto">
                  <bdi dir="ltr" lang={item.language.split("-")[0]}>
                    {item.article ? `${item.article} ` : ""}
                    {item.term}
                  </bdi>
                  <br />
                  <small dir="auto">{item.meaning}</small>
                </span>
                <small>{item.language}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.corrections.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>Corrections</h3>
          <ul className="rl-list">
            {summary.corrections.map((record) => (
              <li key={record.id}>
                <span>
                  <bdi dir="ltr" lang={record.language}>
                    {record.better}
                  </bdi>
                  <br />
                  <small dir="auto">{record.why || record.said}</small>
                </span>
                <small>
                  {record.fixed ? "✓ fixed" : record.attempts > 0 ? "still tricky" : "not retried"}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.repeated.length > 0 && (
        <p className="rl-callout">
          <b>Worth repeating</b>
          {summary.repeated.map((record) => (
            <span key={record.id} style={{ display: "block" }}>
              <bdi dir="ltr" lang={record.language}>
                {record.better}
              </bdi>
            </span>
          ))}
        </p>
      )}

      <p className="rl-callout">
        <b>Next goal</b>
        {summary.nextGoal}
      </p>

      <div className="rl-controls">
        <button type="button" className="rl-btn rl-btn--primary" onClick={onNewLesson}>
          <Check size={16} aria-hidden="true" /> Start a new lesson
        </button>
        <button
          type="button"
          className="rl-btn"
          onClick={onReview}
          disabled={!summary.newWords.length}
        >
          <Layers size={16} aria-hidden="true" /> Review and save words
        </button>
      </div>
    </section>
  );
}
