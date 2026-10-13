import { Check } from "lucide-react";
import { goalProgress, type LessonGoal } from "@/lib/rita-goals";

/** Today's goal, three small tasks, and real progress. */
export function LessonGoalPanel({ goal }: { goal: LessonGoal }) {
  const progress = goalProgress(goal);
  return (
    <div className="rl-goal">
      <h2>{goal.title}</h2>
      <p>{goal.goal}</p>
      <div
        className="rl-progress"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={`${progress.done} of ${progress.total} tasks done`}
      >
        <i style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </div>
      <ul className="rl-tasks">
        {goal.tasks.map((task) => (
          <li key={task.id} data-done={task.done}>
            <span className="rl-tick" aria-hidden="true">
              {task.done && <Check size={13} strokeWidth={3} />}
            </span>
            <span>
              {task.label}
              <span className="rl-sr">{task.done ? " (done)" : " (to do)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
