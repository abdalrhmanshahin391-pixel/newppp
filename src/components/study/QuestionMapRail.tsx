import { Flag } from "lucide-react";

/** The numbered question map, mirroring the old solver rail in Rita colours. */
export function QuestionMapRail({
  items,
  activeIndex,
  onJump,
  onExit,
  title,
}: {
  items: { id: string; position: number; flagged: boolean }[];
  activeIndex: number;
  onJump: (index: number) => void;
  onExit?: () => void;
  title: string;
}) {
  return (
    <aside className="rounded-3xl border border-black/[0.06] bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">Question map</p>
      <p className="mt-1 text-[15px] font-black text-[#23201d]">{title}</p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(i)}
            className={`relative grid h-10 place-items-center rounded-xl text-[13px] font-black transition-colors ${
              i === activeIndex
                ? "bg-[#6ab887] text-white"
                : "bg-[#faf6ee] text-[#57524a] hover:bg-[#f1ead9]"
            }`}
          >
            {item.position}
            {item.flagged && (
              <Flag
                size={9}
                className={`absolute right-1 top-1 ${i === activeIndex ? "text-white" : "text-[#d1795e]"}`}
              />
            )}
          </button>
        ))}
      </div>

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="mt-5 h-11 w-full rounded-xl border border-black/10 text-[13.5px] font-extrabold text-[#57524a] transition-colors hover:bg-black/[0.04]"
        >
          Exit reader
        </button>
      )}
    </aside>
  );
}
