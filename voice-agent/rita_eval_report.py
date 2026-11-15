"""A readable report of a talk-eval run, and a turn-by-turn comparison of two runs.

    python rita_eval_report.py talk-eval.json                 # report (Markdown) to stdout
    python rita_eval_report.py before.json after.json         # compare two runs (A → B)

The workflow writes the report into the run's summary page, so it can be read on a phone.
Two runs to compare come from two workflow runs: two branches (two prompt versions), two models
or two thinking levels on the same lines.
"""

from __future__ import annotations

import json
import sys
from typing import Any

WORST = 10


def _cut(text: str, limit: int = 220) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _cell(text: str, limit: int = 160) -> str:
    return _cut(text, limit).replace("|", "\\|")


def _pct(value: float) -> str:
    return f"{value:.0%}"


def _severity(row: dict[str, Any]) -> tuple[int, int]:
    """Worst first: a wrong fact or a missed correction before a long reply; then by judge score."""

    weight = {"content": 5, "correction": 5, "forbidden": 4, "router": 3, "off-topic question": 3, "language": 3}
    score = sum(weight.get(c, 1) for c in row.get("categories", []))
    if row.get("layer") == "router":
        score += 3
    judged = row.get("judge") or {}
    low = 10 - min((judged.get(k, 5) for k in ("correct", "helpful")), default=5) if judged else 0
    return (score, low)


def report(result: dict[str, Any]) -> str:
    lines: list[str] = []
    ref = result.get("reference")
    title = f"Talk eval: {result.get('model')} (thinking {result.get('effort') or '-'})"
    lines += [f"# {title}", ""]
    if ref:
        lines += [f"Reference: **{ref['name']}** {('- ' + ref['source']) if ref.get('source') else ''}", ""]
        if ref.get("notes"):
            lines += [f"> {ref['notes']}", ""]
    lines += ["## Score", "", "| Part | Passed | Runs | First word (median / p90) | Words (mean) |", "| --- | --- | --- | --- | --- |"]
    for name, s in result.get("by_split", {}).items():
        sp = result.get("spread", {}).get(name, {})
        runs = ", ".join(_pct(r) for r in sp.get("runs", [])) or "-"
        lines.append(
            f"| {name} | {s['passed']}/{s['total']} ({_pct(s['pass_rate'])}) | {runs} |"
            f" {s['first_word_ms_median']} / {s['first_word_ms_p90']} ms | {s['words_mean']} |"
        )
    if any(len(sp.get("runs", [])) > 1 for sp in result.get("spread", {}).values()):
        lines += ["", "Runs of the same lines differ by the range shown; compare means, not one run."]

    b = result.get("breakdown", {})
    if b.get("categories"):
        lines += ["", "## Where it goes wrong", "", "| Problem | Replies |", "| --- | --- |"]
        lines += [f"| {k} | {v} |" for k, v in b["categories"].items()]
        if b.get("layers"):
            lines += ["", "Layer: " + ", ".join(f"**{k}** {v}" for k, v in b["layers"].items())]
            lines += [
                "",
                "- *router*: the turn was given the wrong reply type (fix the router, not the prompt).",
                "- *model*: the prompt fit the turn and the model did not follow it (fix the prompt or the model).",
                "- *service*: the request failed.",
            ]
        if b.get("router"):
            lines += ["", "Router chose: " + ", ".join(f"{k} {v}" for k, v in b["router"].items())]
    if b.get("kinds"):
        lines += ["", "| Kind of turn | Passed |", "| --- | --- |"]
        lines += [f"| {k} | {v['passed']}/{v['turns']} ({_pct(v['pass_rate'])}) |" for k, v in b["kinds"].items()]

    style = result.get("style", {})
    if style.get("reference"):
        u, r = style["uzyra"], style["reference"]
        lines += ["", "## Style against the reference", "", "| | Uzyra | Reference |", "| --- | --- | --- |"]
        for key, label in (
            ("words_mean", "words per reply (mean)"),
            ("words_p90", "words, long replies (p90)"),
            ("question_rate", "asks a question"),
            ("phrase_rate", "gives a phrase in quotes"),
            ("correction_rate", "correction line"),
            ("sheet_rate", "table or sheet"),
            ("list_rate", "list"),
            ("emoji_rate", "emoji"),
            ("arabic_share", "Arabic in the explanation"),
        ):
            a, c = u.get(key, 0), r.get(key, 0)
            show = (lambda v: _pct(v)) if key.endswith(("rate", "share")) else (lambda v: str(v))
            lines.append(f"| {label} | {show(a)} | {show(c)} |")
        if style.get("gaps"):
            lines += ["", "Biggest gaps:"] + [f"- {g}" for g in style["gaps"]]
        if style.get("max_words"):
            lines += ["", f"Length limit taken from the reference: {style['max_words']} words."]

    judge = result.get("judge") or {}
    if judge:
        lines += ["", f"## Judge ({result.get('judge_model')}, {judge['graded']} replies)", ""]
        lines.append(
            " · ".join(f"{k} {judge[k]}" for k in ("correct", "dialect", "helpful", "fit") if judge.get(k) is not None)
            + " (1-5)"
        )
        if judge.get("better"):
            bt = judge["better"]
            lines.append(f"\nAgainst the reference: Uzyra better {bt['uzyra']}, tie {bt['tie']}, reference better {bt['reference']}")
        lines.append("\nThe judge is a model of the same family: read the replies before trusting a score.")

    rows = [r for r in result.get("rows", []) if r.get("problems") or (r.get("judge") or {}).get("better") == "reference"]
    rows.sort(key=_severity, reverse=True)
    if rows:
        lines += ["", f"## Worst {min(WORST, len(rows))} replies", ""]
        for row in rows[:WORST]:
            run = f" run {row['run']}" if result.get("runs", 1) > 1 else ""
            lines.append(
                f"**{row['talk']}#{row['turn']}{run}** ({row.get('kind')}, reply type {row.get('type')}):"
                f" {_cut(row['text'], 120)}"
            )
            lines.append(f"- Uzyra: {_cut(row.get('spoken', ''))}")
            if row.get("sheet"):
                lines.append(f"- Sheet: {_cut(row['sheet'], 140)}")
            if row.get("reference"):
                lines.append(f"- Reference: {_cut(row['reference'])}")
            for problem in row.get("problems", []):
                lines.append(f"- ✗ {problem}")
            if row.get("layer"):
                lines.append(f"- Layer: {row['layer']}")
            j = row.get("judge") or {}
            if j.get("why"):
                lines.append(f"- Judge: {_cut(j['why'], 160)}")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _key(row: dict[str, Any]) -> tuple[str, int]:
    return (row["talk"], row["turn"])


def compare(a: dict[str, Any], b: dict[str, Any]) -> str:
    """A → B: totals, problem counts and every turn that changed from pass to fail or back."""

    lines = [f"# Compare: A {a.get('model')} ({a.get('effort') or '-'}) → B {b.get('model')} ({b.get('effort') or '-'})", ""]
    lines += ["| Part | A | B |", "| --- | --- | --- |"]
    for name in sorted(set(a.get("by_split", {})) | set(b.get("by_split", {}))):
        sa, sb = a.get("by_split", {}).get(name), b.get("by_split", {}).get(name)
        fa = f"{_pct(sa['pass_rate'])} ({sa['first_word_ms_median']} ms)" if sa else "-"
        fb = f"{_pct(sb['pass_rate'])} ({sb['first_word_ms_median']} ms)" if sb else "-"
        lines.append(f"| {name} | {fa} | {fb} |")
    ca = a.get("breakdown", {}).get("categories", {})
    cb = b.get("breakdown", {}).get("categories", {})
    if ca or cb:
        lines += ["", "| Problem | A | B |", "| --- | --- | --- |"]
        for name in sorted(set(ca) | set(cb), key=lambda n: -(ca.get(n, 0) + cb.get(n, 0))):
            lines.append(f"| {name} | {ca.get(name, 0)} | {cb.get(name, 0)} |")
    ja, jb = a.get("judge") or {}, b.get("judge") or {}
    if ja and jb:
        lines += ["", "Judge: " + ", ".join(f"{k} {ja.get(k)} → {jb.get(k)}" for k in ("correct", "dialect", "helpful", "fit"))]

    first_a = {_key(r): r for r in a.get("rows", []) if r.get("run", 1) == 1}
    first_b = {_key(r): r for r in b.get("rows", []) if r.get("run", 1) == 1}
    fixed = [k for k in first_a if k in first_b and first_a[k]["problems"] and not first_b[k]["problems"]]
    broke = [k for k in first_a if k in first_b and not first_a[k]["problems"] and first_b[k]["problems"]]
    lines += ["", f"First run of each: {len(fixed)} turns fixed, {len(broke)} turns broken."]
    for title, keys in (("Broken in B", broke), ("Fixed in B", fixed)):
        if not keys:
            continue
        lines += ["", f"## {title}", "", "| Turn | Learner | A | B |", "| --- | --- | --- | --- |"]
        for k in keys:
            ra, rb = first_a[k], first_b[k]
            note = "; ".join(rb["problems"] or ra["problems"])
            lines.append(
                f"| {k[0]}#{k[1]} | {_cell(ra['text'], 60)} | {_cell(ra.get('spoken', ''))} | {_cell(rb.get('spoken', ''))}"
                f" ({_cell(note, 80)}) |"
            )
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 3):
        print(__doc__)
        return 2
    results = []
    for path in argv[1:]:
        with open(path, encoding="utf-8") as handle:
            results.append(json.load(handle))
    print(report(results[0]) if len(results) == 1 else compare(*results))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
