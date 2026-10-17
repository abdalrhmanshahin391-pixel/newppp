import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { parseTask, parsedChips, type Parsed } from "@/lib/todo-nlp";

/** Quick add with local natural-language parsing: type the date, don't pick it. */
export function QuickAdd({
  onAdd,
  id,
  autoOpen,
  placeholder = "Task name — try “revise anatomy tomorrow 6pm !!”",
}: {
  onAdd: (parsed: Parsed) => void;
  id?: string;
  autoOpen?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(!!autoOpen);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const parsed = value.trim() ? parseTask(value) : null;
  const chips = parsed ? parsedChips(parsed) : [];

  const submit = () => {
    if (!value.trim()) return;
    onAdd(parseTask(value));
    setValue("");
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-2 rounded-xl py-2 text-left text-[14px] font-bold text-[#9a9aab] transition-colors hover:text-[#2b6df0]"
      >
        <Plus size={16} /> Add task
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-black/[0.1] bg-white p-3">
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] font-bold text-[#121117] outline-none placeholder:text-[#9a9aab]"
      />

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Sparkles size={13} className="text-[#2b6df0]" />
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-[#f4f4f8] px-2.5 py-1 text-[12px] font-extrabold text-[#1d5fd0]"
            >
              {c}
            </span>
          ))}
          <span className="text-[12px] font-bold text-[#9a9aab]">read from what you typed</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="rita-pill rounded-xl px-4 py-2 text-[13px] font-extrabold disabled:opacity-40"
        >
          Add task
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-bold text-[#54546a] hover:bg-black/[0.04]"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
