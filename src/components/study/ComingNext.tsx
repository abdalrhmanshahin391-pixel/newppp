import { Link } from "@tanstack/react-router";

export function ComingNext({ what, lines }: { what: string; lines: string[] }) {
  return (
    <div className="mt-12 max-w-xl">
      <p className="text-[15px] leading-relaxed text-[#6d665c]">
        This is where {what} will live. The workspace around it is already built — here is what
        goes inside it next:
      </p>
      <ol className="mt-8 space-y-5">
        {lines.map((l, i) => (
          <li key={l} className="flex gap-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-[#8b8377]">
              {i + 1}
            </span>
            <span className="pt-0.5 text-[15px] leading-relaxed text-[#3b3730]">{l}</span>
          </li>
        ))}
      </ol>
      <Link
        to="/study"
        className="mt-10 inline-flex items-center rounded-full border border-black/10 bg-white px-7 py-3 text-[14px] font-semibold text-[#23201d]"
      >
        Back to flashcards
      </Link>
    </div>
  );
}
