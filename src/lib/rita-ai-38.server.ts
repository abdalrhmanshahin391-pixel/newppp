// Rita AI Model 3.8 — server-only helpers.
// The pipeline: 4 pages of text -> Gemini Flash finds question
// borders -> we CUT each question out locally -> the cut questions go to the
// Gemini batch endpoint (50% price) -> answers + long explanations come back
// and are written into the chosen sub-subject.

export const RITA_MODEL = "gemini-2.5-flash";
export const RITA_CHUNK_PAGES = 2;

/** Rita uses the same protected Gemini key as the other study tools. */
export async function resolveRitaKey(supabase: any): Promise<string> {
  void supabase;
  const key = (process.env['GEMINI_API_KEY'] ?? "").trim();
  if (key.length > 10) return key;
  throw new Error("Add Questions is not connected yet. Ask the site owner to add the Gemini key.");
}

export function ritaKeyError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "Rita's Gemini key was rejected (401/403). The saved key looks like a Google OAuth token — it needs replacing with an AI Studio API key that starts with AIza.";
  }
  if (status === 429) return "Gemini is rate limiting right now. Wait a minute and press Resume.";
  return `Gemini error ${status}: ${body.slice(0, 300)}`;
}

export function extractJsonObject(text: string): any | null {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch { /* keep going */ }
  const lb = cleaned.indexOf("{");
  const rb = cleaned.lastIndexOf("}");
  if (lb !== -1 && rb > lb) { try { return JSON.parse(cleaned.slice(lb, rb + 1)); } catch { /* ignore */ } }
  return null;
}

export function extractJsonArray(text: string): any[] | null {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return null;
  try {
    const p = JSON.parse(cleaned);
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.items)) return p.items;
    if (Array.isArray(p?.questions)) return p.questions;
  } catch { /* keep going */ }
  const lb = cleaned.indexOf("[");
  const rb = cleaned.lastIndexOf("]");
  if (lb !== -1 && rb > lb) {
    try { const p = JSON.parse(cleaned.slice(lb, rb + 1)); if (Array.isArray(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

export function normalizeBookends(rows: any[]) {
  const out: Array<{ first_words?: string; last_words?: string; exact_text?: string }> = [];
  for (const row of rows ?? []) {
    const exact = String(row?.exact_text ?? row?.exact ?? row?.text ?? row?.question ?? "").trim();
    const first = String(row?.first_words ?? row?.first_4_words ?? row?.first ?? "").trim();
    const last = String(row?.last_words ?? row?.last_4_words ?? row?.last ?? "").trim();
    if (exact.length >= 5) out.push({ exact_text: exact });
    else if (first && last) out.push({ first_words: first, last_words: last });
  }
  return out;
}

export const BORDERS_SYSTEM = `You mark the BORDERS of every question inside raw exam text.

A "question" means the stem PLUS everything belonging to it (options A/B/C/D, True/False choices, a one-line answer) up until the next question starts.

For every question, in reading order, return ONE object:
- If the whole question block is 8 words or MORE:
  { "first_words": "<the first 4 words of the stem, verbatim>", "last_words": "<the last 4 words of the LAST line belonging to this question, verbatim>" }
- If the whole question block is SHORTER than 8 words:
  { "exact_text": "<the entire block, verbatim>" }

Rules:
- Copy words EXACTLY as they appear, including numbering, punctuation and casing.
- "last_words" must come from the final option / answer line, never from the stem.
- Numbered items ("12." "12)" "Q12") each start a NEW question.
- Ignore headers, footers, page numbers, table of contents and chapter titles.
- Return STRICT JSON: a single JSON array. No markdown, no commentary. Return [] if the text holds no questions.`;

export const OCR_SYSTEM = `You read a photographed or scanned page of an exam paper and type it out exactly.

Rules:
- Return the text EXACTLY as printed, in reading order, top to bottom.
- Keep question numbering ("12.", "Q12"), option letters ("a)", "B."), and any answer line ("Answer : b") exactly as written.
- Put every option on its own line. Put a blank line between questions.
- Do not translate, correct, summarise, answer or comment on anything.
- Skip page headers, footers and page numbers.
- If a word is unreadable, write your best guess — never write a placeholder like [illegible].
- Return PLAIN TEXT only. No markdown fences, no JSON, no commentary. If the page holds no text at all, return an empty response.`;


export const SOLVER_SYSTEM = `You are Rita, a medical exam tutor. The user gives you ONE complete question block. Solve it and explain it in depth.

Return STRICT JSON only, no markdown fences:
{
  "prompt": "the question stem, plain text",
  "options": [{"letter":"A","body":"...","is_correct":true|false}],
  "concept": "≤8 words naming the core concept tested",
  "explanation": "GitHub-flavored Markdown with THREE sections in this exact order, separated by BLANK LINES:\\n\\n**Concept**\\n2-3 sentences explaining the underlying concept and mechanism, not just the fact.\\n\\n**Why the correct answer is right**\\n- 2-3 short bullets covering the mechanism, the key clue, and why this answer fits best.\\n\\n**Why the other options are wrong**\\n- **A.** one clear sentence with the specific reason\\n- **B.** one clear sentence with the specific reason\\n- **C.** one clear sentence with the specific reason\\n- **D.** one clear sentence with the specific reason",
  "summary_table": "A GitHub-flavored Markdown table. Every row on its OWN line separated by a real \\n. Header row: | Option | Verdict | One-line reason |. Separator: |---|---|---|. Then ONE line per option, ✓ in the Verdict cell of the correct row and ✗ on the wrong rows."
}

Rules:
- Output EXACTLY 4 options A, B, C, D with exactly one is_correct=true.
- If the source question has no four choices (open question, True/False, or only the correct answer is shown), INVENT three plausible-but-wrong distractors so there are always four, and mark the true one correct.
- Copy source options verbatim when they exist, in the source order and with their original letters.
- The summary_table MUST render as a real markdown table — never put the whole table on one line.
- Output JSON only.`;

export function getBatchResponses(json: any): any[] {
  const c = [
    json?.response?.output?.inlinedResponses?.inlinedResponses,
    json?.response?.output?.inlinedResponses,
    json?.output?.inlinedResponses?.inlinedResponses,
    json?.output?.inlinedResponses,
    json?.response?.responses, json?.responses,
    json?.response?.inlinedResponses?.inlinedResponses, json?.response?.inlinedResponses,
    json?.inlinedResponses?.inlinedResponses, json?.inlinedResponses,
  ];
  for (const x of c) if (Array.isArray(x)) return x;
  return [];
}

export function getBatchState(json: any): string {
  return json?.metadata?.state || json?.response?.state || json?.state || "BATCH_STATE_UNKNOWN";
}

export function mapBatchStatus(state: string) {
  const s = String(state || "").toUpperCase();
  if (s.endsWith("SUCCEEDED")) return "succeeded";
  if (s.endsWith("FAILED")) return "failed";
  if (s.endsWith("CANCELLED")) return "cancelled";
  if (s.endsWith("EXPIRED")) return "expired";
  if (s.endsWith("RUNNING")) return "running";
  return "pending";
}

function getResponsesFile(json: any): string | undefined {
  return json?.response?.output?.responsesFile || json?.output?.responsesFile
    || json?.response?.responsesFile || json?.responsesFile;
}

export function responseText(item: any): string {
  return item?.response?.candidates?.[0]?.content?.parts?.[0]?.text
    || item?.generateContentResponse?.candidates?.[0]?.content?.parts?.[0]?.text
    || item?.candidates?.[0]?.content?.parts?.[0]?.text
    || item?.response?.text || item?.text || "";
}

export async function fetchBatch(apiKey: string, batchName: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${batchName}`, {
    headers: { "x-goog-api-key": apiKey },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(ritaKeyError(res.status, body));
  try { return JSON.parse(body); } catch { return {}; }
}

export async function downloadResponses(apiKey: string, json: any): Promise<any[]> {
  let inline = getBatchResponses(json);
  const file = getResponsesFile(json);
  if ((!inline || inline.length === 0) && file) {
    const fr = await fetch(
      `https://generativelanguage.googleapis.com/download/v1beta/${file}:download?alt=media`,
      { headers: { "x-goog-api-key": apiKey } },
    );
    const text = await fr.text();
    inline = text.split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean) as any[];
  }
  return inline ?? [];
}
