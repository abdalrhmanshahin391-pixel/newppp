import { BookOpen } from "lucide-react";

export function GuideButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="admin-guide"
      className="rita-btn rita-btn-sm rita-btn-quiet gap-2"
    >
      <BookOpen size={16} aria-hidden="true" />
      {open ? "Hide guide" : "Guide"}
    </button>
  );
}

type Item = { name: string; text: string };

const SEND: Item[] = [
  {
    name: "One conversation felt wrong",
    text: "Open it on the conversations page, ⋯ More, then Repair file. Send me that file.",
  },
  {
    name: "The same problem keeps coming back",
    text: "Open the problem on Rita quality and press Download fix file. Send me that file. This is the best one when you want something fixed.",
  },
  {
    name: "A fix is live",
    text: "Press I fixed this on the problem. The page watches the next replies and tells you whether it worked. Test on current version checks it right now.",
  },
];

const CONTROLS: Record<"conversations" | "quality" | "issue", Item[]> = {
  conversations: [
    {
      name: "AI analysis switch",
      text: "On: after each conversation OpenAI reviews every reply. Off: nothing is sent.",
    },
    {
      name: "Repair file (in ⋯ More)",
      text: "One file for one whole conversation: every message, what the voice system recorded, and each reply next to what a good tutor would say.",
    },
    {
      name: "The mark on a card",
      text: "How many replies were reviewed and how many had a problem. Open the ones with problems first.",
    },
    {
      name: "Text for AI, PDF, JSON (in ⋯ More)",
      text: "Older formats. Text for AI is the plain transcript, PDF is for reading or printing, JSON is the raw data.",
    },
  ],
  quality: [
    { name: "Next step", text: "The one thing to do now. Press its button." },
    {
      name: "Overview",
      text: "How Rita is doing on the current version, compared with the version before it, and her weak spots.",
    },
    {
      name: "Problems",
      text: "Every recurring problem the AI found, grouped. Open one to download its fix file.",
    },
    {
      name: "Trust",
      text: "Check the reviewer tests the AI reviewer on 16 replies with known answers. Run it after its rules change; it also runs by itself once.",
    },
  ],
  issue: [
    {
      name: "Download fix file",
      text: "All the examples, the numbers and the replies you marked wrong. Send it to me to get the problem fixed.",
    },
    {
      name: "I fixed this",
      text: "Tell the page the fix is live. From then on, replies on newer versions count as checks of the fix.",
    },
    {
      name: "Test on current version",
      text: "Rita answers this problem's old turns again with the version running now. A turn passes only if both of its answers are good.",
    },
    {
      name: "Reviewer is right / wrong",
      text: "Your thumb on the AI's judgement. The wrong ones are listed in the fix file and lower the reviewer's score.",
    },
    {
      name: "⋯ More",
      text: "Not a problem hides it. Merge into another joins two cards that are the same problem. Reopen takes it back.",
    },
  ],
};

/**
 * What every control does and what to send, in plain words. Only admins ever see this: it is only
 * rendered on admin screens and inside the admin bar.
 */
export function AdminGuide({ open, scope }: { open: boolean; scope: keyof typeof CONTROLS }) {
  if (!open) return null;
  return (
    <section
      id="admin-guide"
      aria-label="Guide for admins"
      className="mt-4 rounded-2xl bg-[var(--pp-accent-soft)] p-4 sm:p-5"
    >
      <h2 className="text-[17px] font-semibold">What do I send you?</h2>
      <dl className="mt-3 grid gap-3 md:grid-cols-3">
        {SEND.map((item) => (
          <div key={item.name}>
            <dt className="text-[15px] font-semibold">{item.name}</dt>
            <dd className="mt-1 text-[14px] leading-[1.45] text-[var(--pp-ink)]">{item.text}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-5 text-[17px] font-semibold">What the buttons do</h2>
      <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
        {CONTROLS[scope].map((item) => (
          <div key={item.name}>
            <dt className="text-[15px] font-semibold">{item.name}</dt>
            <dd className="mt-1 text-[14px] leading-[1.45]">{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
