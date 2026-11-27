// Shown when a call stops because the learner's voice time ran out (or a call cannot start because
// there is none left). The call is already over; this says why, when the time comes back, and
// offers the plans. Closing it takes the learner out of a free conversation.
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useVoiceTime } from "@/hooks/useVoiceTime";

export function VoiceTimeOver({
  open,
  arabic,
  onDone,
  onPlans,
}: {
  open: boolean;
  arabic: boolean;
  /** «تمام» or closing: leave the conversation (or just close, in a lesson). */
  onDone: () => void;
  /** «شوف الخطط»: close without leaving; the link opens the plans. */
  onPlans: () => void;
}) {
  const period = useVoiceTime().data?.period ?? "";
  // "YYYY-MM-DD" renews at midnight in Amman, "YYYY-MM" on the 1st; "lifetime" does not renew.
  const when =
    period.length === 10
      ? arabic
        ? "بيرجعلك وقت جديد الساعة 12 بالليل بتوقيت عمّان."
        : "New time comes back at midnight (Amman time)."
      : period.length === 7
        ? arabic
          ? "بيرجعلك وقت جديد أول الشهر."
          : "New time comes back on the 1st of the month."
        : arabic
          ? "عشان تكمّل، اختار خطة فيها وقت مكالمات."
          : "To keep going, choose a plan with call time.";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDone();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          className="edith-premium fixed left-1/2 top-1/2 z-[91] w-[min(100vw-32px,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white p-6 text-[var(--pp-ink)] shadow-2xl focus:outline-none"
          dir={arabic ? "rtl" : "ltr"}
          role="alertdialog"
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--pp-grey)]"
            aria-hidden="true"
          >
            <Clock3 size={22} />
          </span>
          <Dialog.Title className="mt-4 text-[22px] font-semibold leading-tight">
            {arabic ? "خلص وقتك" : "Your time is up"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-[var(--pp-muted)]">
            {arabic
              ? "انتهى وقت المكالمات تبعك، فسكّرنا المكالمة."
              : "Your call time has run out, so the call has ended."}{" "}
            {when}
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/pricing" className="rita-btn rita-btn-primary" onClick={onPlans}>
              {arabic ? "شوف الخطط" : "See plans"}
            </Link>
            <button type="button" className="rita-btn rita-btn-secondary" onClick={onDone}>
              {arabic ? "تمام" : "OK"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
