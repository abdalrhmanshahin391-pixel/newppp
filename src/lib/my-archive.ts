/**
 * "My own question banks" — sections, sub-subjects and questions a student
 * creates for themselves inside an archive subject. Official rows carry
 * owner_user_id = null; these carry the student's id and are private to them.
 */
import { supabase } from "@/integrations/supabase/legacy-client";

export type ParsedOption = { text: string; correct: boolean };
export type ParsedQuestion = { stem: string; options: ParsedOption[]; explanation: string | null };

const LABELS = "ABCDEFGH";

/**
 * Accepts a friendly paste, one question per block (blank line between):
 *
 *   Which vessel carries deoxygenated blood?
 *   - Aorta
 *   * Pulmonary artery
 *   - Pulmonary vein
 *   > It is the only artery carrying deoxygenated blood.
 *
 * A star (*) — or a trailing (correct) / [x] — marks the right answer.
 * A line starting with > or # is the explanation.
 */
export function parseQuestionBlock(raw: string): ParsedQuestion[] {
  const blocks = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: ParsedQuestion[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let stem = "";
    const options: ParsedOption[] = [];
    let explanation: string | null = null;

    for (const line of lines) {
      if (/^[>#]/.test(line)) {
        const text = line.replace(/^[>#]+\s*/, "").replace(/^explanation:\s*/i, "").trim();
        explanation = explanation ? `${explanation} ${text}` : text;
        continue;
      }
      const opt = line.match(/^([-*•+]|\*{1})\s+(.*)$/) ?? line.match(/^([A-Ha-h])[).]\s+(.*)$/);
      if (opt && stem) {
        let text = opt[2].trim();
        let correct = opt[1] === "*";
        if (/\((correct|right)\)$/i.test(text) || /\[x\]$/i.test(text)) {
          correct = true;
          text = text.replace(/\((correct|right)\)$/i, "").replace(/\[x\]$/i, "").trim();
        }
        if (text) options.push({ text, correct });
        continue;
      }
      if (!stem) {
        stem = line.replace(/^\d+[).]\s*/, "").trim();
        continue;
      }
      // extra prose before options belongs to the stem
      if (options.length === 0) stem += ` ${line}`;
      else explanation = explanation ? `${explanation} ${line}` : line;
    }

    if (!stem || options.length < 2) continue;
    if (!options.some((o) => o.correct)) options[0].correct = true;
    out.push({ stem, options, explanation });
  }
  return out;
}

export async function createMySection(courseId: string, name: string, userId: string) {
  const { data, error } = await (supabase.from as any)("subject_groups")
    .insert({ course_id: courseId, name, owner_user_id: userId, sort_order: 900 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createMySubject(groupId: string, name: string, userId: string, sortOrder = 0) {
  const { data, error } = await (supabase.from as any)("subjects")
    .insert({ group_id: groupId, name, owner_user_id: userId, sort_order: sortOrder, access_level: "paid" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Saves parsed questions with their options in one go. */
export async function saveMyQuestions(subjectId: string, userId: string, questions: ParsedQuestion[]) {
  if (!questions.length) return 0;
  const { data, error } = await (supabase.from as any)("questions")
    .insert(
      questions.map((q, i) => ({
        subject_id: subjectId,
        stem: q.stem,
        explanation: q.explanation,
        sort_order: i,
        owner_user_id: userId,
      })),
    )
    .select("id");
  if (error) throw error;
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);

  const rows = questions.flatMap((q, qi) =>
    q.options.map((o, oi) => ({
      question_id: ids[qi],
      label: LABELS[oi] ?? String(oi + 1),
      text: o.text,
      is_correct: o.correct,
      sort_order: oi,
      owner_user_id: userId,
    })),
  );
  const { error: oErr } = await (supabase.from as any)("question_options").insert(rows);
  if (oErr) throw oErr;
  return ids.length;
}

export async function deleteMyRow(table: "subject_groups" | "subjects", id: string) {
  const { error } = await (supabase.from as any)(table).delete().eq("id", id);
  if (error) throw error;
}
