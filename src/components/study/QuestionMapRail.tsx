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
    <aside className="rounded-[20px] border-2 border-[#121117] bg-white p-5">
      <p className="text-[14px] font-semibold text-[#6a697c]">Question map</p>
      <p className="mt-1 text-[17px] font-bold text-[#121117]">{title}</p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(i)}
            className={`relative grid h-10 place-items-center rounded-lg border-2 border-[#121117] text-[14px] font-semibold transition-colors ${
              i === activeIndex
                ? "bg-[#2b6df0] text-white"
                : "bg-white text-[#121117] hover:bg-[#e7eefd]"
            }`}
          >
            {item.position}
            {item.flagged && (
              <Flag
                size={9}
                className={`absolute right-1 top-1 ${i === activeIndex ? "text-[#121117]" : "text-[#b3213f]"}`}
              />
            )}
          </button>
        ))}
      </div>

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="mt-5 h-11 w-full rounded-lg border-2 border-[#121117] text-[15px] font-semibold text-[#121117] transition-colors hover:bg-[#f4f4f8]"
        >
          Exit reader
        </button>
      )}
    </aside>
  );
}
