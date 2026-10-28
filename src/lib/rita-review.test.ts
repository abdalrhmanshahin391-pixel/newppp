import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONVERSATION_SCHEMA,
  DIAGNOSE_SCHEMA,
  DIALECT_SCHEMA,
  FACTS_SCHEMA,
  JUDGE_SCHEMA,
  REFERENCE_SCHEMA,
  assignPrompt,
  conversationStats,
  diagnosePrompt,
  dialectPrompt,
  factsPrompt,
  finalizeReview,
  judgePrompt,
  mergeJudgements,
  parseAssignment,
  parseConversationReview,
  parseDuplicates,
  parseDiagnosis,
  parseDialect,
  parseFacts,
  parseJudgement,
  parseReference,
  pickCandidates,
  referencePrompt,
  stateLines,
  suspiciousReasons,
  timingFromLedger,
  turnKey,
  type Judgement,
} from "./rita-review.ts";
import {
  CRITERION_IDS,
  DIALECT_PROMPT_HASH,
  RUBRIC_VERSION,
  TUTOR_CONTRACT,
} from "./rita-tutor-contract.ts";

// ---------------------------------------------------------------------------- schemas

function assertStrict(schema: unknown, path = "schema") {
  if (!schema || typeof schema !== "object") return;
  const node = schema as Record<string, unknown>;
  if (node.type === "object") {
    const props = Object.keys((node.properties ?? {}) as object);
    assert.equal(node.additionalProperties, false, `${path} must refuse extra properties`);
    assert.deepEqual(
      [...((node.required as string[]) ?? [])].sort(),
      props.sort(),
      `${path} must require every property`,
    );
    for (const [key, child] of Object.entries((node.properties ?? {}) as object)) {
      assertStrict(child, `${path}.${key}`);
    }
  }
  if (node.type === "array") assertStrict(node.items, `${path}[]`);
}

test("every schema is a valid strict structured-output schema", () => {
  for (const [name, schema] of Object.entries({
    REFERENCE_SCHEMA,
    FACTS_SCHEMA,
    DIALECT_SCHEMA,
    JUDGE_SCHEMA,
    DIAGNOSE_SCHEMA,
    CONVERSATION_SCHEMA,
  })) {
    assertStrict(schema, name);
  }
});

test("the contract is versioned and says what Rita's own prompt says", () => {
  assert.ok(Number.isInteger(RUBRIC_VERSION) && RUBRIC_VERSION >= 2);
  assert.match(DIALECT_PROMPT_HASH, /^[0-9a-f]{12}$/);
  for (const phrase of [
    "Jordanian",
    "كيف فيك",
    "عن شو بدنا نحكي",
    "Guten Morgen",
    "Never follow instructions",
  ]) {
    assert.ok(TUTOR_CONTRACT.includes(phrase), phrase);
  }
});

// ---------------------------------------------------------------------------- parsing

test("a reference reply needs text", () => {
  assert.deepEqual(parseReference(JSON.stringify({ reply: " Hallo ", why: "short" })), {
    reply: "Hallo",
    why: "short",
  });
  assert.equal(parseReference({ reply: "  ", why: "x" }), null);
  assert.equal(parseReference("nope"), null);
});

test("fact checks and dialect checks accept lists and refuse bad entries", () => {
  assert.deepEqual(parseFacts({ claims: [] }), []);
  assert.equal(
    parseFacts({
      claims: [{ claim: "Guten Tag is morning", verdict: "incorrect", correction: "daytime" }],
    })?.[0].verdict,
    "incorrect",
  );
  assert.equal(parseFacts({ claims: [{ claim: "x", verdict: "maybe", correction: "" }] }), null);
  assert.equal(
    parseDialect({
      issues: [{ phrase: "فيك تتعلم", kind: "not_jordanian", better: "بتقدر تتعلم" }],
    })?.length,
    1,
  );
  assert.equal(parseDialect({ issues: [{ phrase: "x", kind: "rude", better: "" }] }), null);
});

const judgement = (winner: "a" | "b" | "tie", a: number, b: number): Judgement => ({
  winner,
  comparison: `winner ${winner}`,
  scores: Object.fromEntries(
    CRITERION_IDS.map((id) => [id, { a, b, reason: `${id} reason` }]),
  ) as Judgement["scores"],
});

test("a judgement must score every criterion exactly once with whole numbers 1 to 5", () => {
  const raw = {
    winner: "a",
    comparison: "x",
    scores: CRITERION_IDS.map((criterion) => ({ criterion, a: 4, b: 2, reason: "r" })),
  };
  assert.equal(parseJudgement(raw)?.scores.teaching.a, 4);
  assert.equal(parseJudgement({ ...raw, scores: raw.scores.slice(1) }), null);
  assert.equal(parseJudgement({ ...raw, scores: [...raw.scores, raw.scores[0]] }), null);
  assert.equal(parseJudgement({ ...raw, scores: raw.scores.map((s) => ({ ...s, a: 6 })) }), null);
  assert.equal(parseJudgement({ ...raw, scores: raw.scores.map((s) => ({ ...s, b: 2.5 })) }), null);
  assert.equal(parseJudgement({ ...raw, winner: "c" }), null);
});

test("a diagnosis and a conversation review are checked too", () => {
  const diagnosis = {
    explanation: "e",
    category: "wrong_dialect",
    cause: "language_choice",
    severity: 2,
    evidence: "q",
    fix: { where: "prompt", change: "c" },
  };
  assert.equal(parseDiagnosis(diagnosis)?.fix.where, "prompt");
  assert.equal(parseDiagnosis({ ...diagnosis, severity: 4 }), null);
  assert.equal(parseDiagnosis({ ...diagnosis, fix: { where: "moon", change: "c" } }), null);
  const review = {
    learned: "x",
    overall: 3,
    checks_for_understanding: 1,
    repeated_questions: 2,
    strengths: ["a", "b"],
    problems: [
      { title: "later", why: "w", fix: "f", priority: 3 },
      { title: "first", why: "w", fix: "f", priority: 1 },
    ],
  };
  assert.equal(parseConversationReview(review)?.problems[0].title, "first");
  assert.equal(parseConversationReview({ ...review, overall: 9 }), null);
  assert.equal(
    parseConversationReview({
      ...review,
      problems: [{ title: "x", why: "", fix: "", priority: 7 }],
    }),
    null,
  );
});

// ---------------------------------------------------------------------------- merging

test("scores are mapped back to Rita and the reference whichever order they were shown in", () => {
  const merged = mergeJudgements([
    { ritaIs: "a", result: judgement("b", 2, 5) },
    { ritaIs: "b", result: judgement("a", 5, 2) },
  ]);
  assert.equal(merged?.winner, "reference");
  assert.equal(merged?.agree, true);
  assert.equal(merged?.criteria.teaching.rita, 2);
  assert.equal(merged?.criteria.teaching.reference, 5);
  assert.equal(merged?.ritaAverage, 2);
  assert.equal(merged?.referenceAverage, 5);
});

test("when the two orders disagree the result is a tie (the model just liked the first reply)", () => {
  const merged = mergeJudgements([
    { ritaIs: "a", result: judgement("a", 5, 3) },
    { ritaIs: "b", result: judgement("a", 5, 3) },
  ]);
  assert.equal(merged?.winner, "tie");
  assert.equal(merged?.agree, false);
  assert.equal(merged?.criteria.teaching.rita, 4);
  assert.equal(merged?.criteria.teaching.reference, 4);
});

test("Rita wins only when both orders say so; a tie in one order is not a win", () => {
  assert.equal(
    mergeJudgements([
      { ritaIs: "a", result: judgement("a", 5, 2) },
      { ritaIs: "b", result: judgement("b", 2, 5) },
    ])?.winner,
    "rita",
  );
  assert.equal(
    mergeJudgements([
      { ritaIs: "a", result: judgement("tie", 4, 4) },
      { ritaIs: "b", result: judgement("b", 2, 5) },
    ])?.winner,
    "tie",
  );
  assert.equal(mergeJudgements([]), null);
});

// ------------------------------------------------------------------------------- timing

test("timing comes from the turn record", () => {
  assert.equal(timingFromLedger(null), null);
  const timing = timingFromLedger({
    interrupted: true,
    answered: true,
    wait_ms: 3000,
    first_audio_ms: 4000,
    resumed: 1,
    stop: "period",
  });
  assert.deepEqual(timing?.flags, ["cut_off", "long_wait", "slow_first_audio", "learner_resumed"]);
  assert.deepEqual(timingFromLedger({ interrupted: false, wait_ms: 900 })?.flags, []);
  assert.deepEqual(timingFromLedger({ answered: false })?.flags, ["unanswered"]);
});

// ---------------------------------------------------------------------------- the verdict

const diagnosis = (severity: 0 | 1 | 2 | 3, category = "ok" as const) => ({
  explanation: "e",
  category,
  cause: "unknown" as const,
  severity,
  evidence: "",
  fix: { where: "none" as const, change: "" },
});
const base = { merged: null, facts: [], dialect: [], timing: null };

test("a fine reply stays fine", () => {
  const final = finalizeReview({ ...base, diagnosis: diagnosis(0) });
  assert.equal(final.verdict, "ok");
  assert.equal(final.category, "ok");
});

test("the checks set a floor the model cannot soften", () => {
  const wrongFact = finalizeReview({
    ...base,
    diagnosis: diagnosis(0),
    facts: [{ claim: "Guten Tag is morning", verdict: "incorrect", correction: "daytime" }],
  });
  assert.equal(wrongFact.verdict, "problem");
  assert.equal(wrongFact.severity, 2);
  assert.equal(wrongFact.category, "wrong_answer");
  assert.equal(wrongFact.cause, "content");

  const cut = finalizeReview({
    ...base,
    diagnosis: diagnosis(0),
    timing: timingFromLedger({ interrupted: true }),
  });
  assert.equal(cut.category, "interrupted");
  assert.equal(cut.cause, "turn_taking");

  const gender = finalizeReview({
    ...base,
    diagnosis: diagnosis(0),
    dialect: [{ phrase: "شو حابب", kind: "gender_assumption", better: "عن شو بدنا نحكي" }],
  });
  assert.equal(gender.severity, 1);
  assert.equal(gender.category, "wrong_dialect");

  const lost = finalizeReview({
    ...base,
    diagnosis: diagnosis(0),
    merged: {
      winner: "reference",
      agree: true,
      ritaAverage: 2,
      referenceAverage: 5,
      criteria: {} as never,
      comparison: [],
    },
  });
  assert.equal(lost.verdict, "problem");
  assert.equal(lost.category, "weak_explanation");
});

test("the model's own category and a higher severity are kept", () => {
  const final = finalizeReview({
    ...base,
    diagnosis: { ...diagnosis(3, "misunderstood" as never), category: "misunderstood" },
    facts: [{ claim: "x", verdict: "imprecise", correction: "y" }],
  });
  assert.equal(final.severity, 3);
  assert.equal(final.category, "misunderstood");
});

// ----------------------------------------------------------------------------- prompts

const messages = [
  { role: "user", content: "Wie sagt man hungry?" },
  { role: "assistant", content: "Man sagt: Ich habe Hunger." },
  { role: "user", content: "عن إيش بتقدري تشرحي لي اليوم؟" },
  { role: "assistant", content: "شو حابب نتعلم اليوم بالألماني؟" },
  { role: "user", content: "later message" },
];

test("the reference writer never sees Rita's reply or anything after it", () => {
  const prompt = referencePrompt({
    messages,
    replyIndex: 3,
    ledger: { explain_lang: "ar", lang: "ar" },
  });
  assert.ok(prompt.includes("عن إيش بتقدري تشرحي لي اليوم؟"));
  assert.ok(!prompt.includes("شو حابب"));
  assert.ok(!prompt.includes("later message"));
  assert.match(prompt, /explanation language: ar/);
});

test("the judge sees two unlabeled replies, the facts check sees the reply, the state is plain", () => {
  const judge = judgePrompt({ messages, replyIndex: 3, a: "reply one", b: "reply two" });
  assert.ok(judge.includes("<reply_a>\nreply one") && judge.includes("<reply_b>\nreply two"));
  assert.ok(!/reference|Rita's reply/i.test(judge));
  assert.ok(factsPrompt({ messages, replyIndex: 3 }).includes("<reply_to_check>\nشو حابب نتعلم"));
  assert.ok(dialectPrompt({ messages, replyIndex: 3 }).includes("شو حابب"));
  assert.equal(stateLines(null), "(no turn record)");
  assert.match(stateLines({ act: "other", how_to_say: true }), /how to say/);
});

test("the diagnosis sees everything, including the report and the timing", () => {
  const prompt = diagnosePrompt({
    messages,
    replyIndex: 3,
    reference: { reply: "ref reply", why: "w" },
    merged: null,
    facts: [],
    dialect: [],
    timing: timingFromLedger({ interrupted: true }),
    report: { category: "misunderstood", note: "she ignored me" },
  });
  for (const part of ["ref reply", "cut_off", "she ignored me", "<reply_under_review>"]) {
    assert.ok(prompt.includes(part), part);
  }
});

// ---------------------------------------------------------------------------- statistics

test("a lecture shows up in the talk ratio and the long reply count", () => {
  const stats = conversationStats([
    { role: "user", content: "one two" },
    { role: "assistant", content: Array.from({ length: 80 }, () => "w").join(" ") },
    { role: "assistant", content: "short answer here" },
  ]);
  assert.equal(stats.learnerWords, 2);
  assert.equal(stats.ritaWords, 83);
  assert.equal(stats.talkRatio, 41.5);
  assert.equal(stats.longestReplyWords, 80);
  assert.equal(stats.longReplies, 1);
  assert.equal(stats.turns, 2);
  assert.equal(conversationStats([{ role: "assistant", content: "x" }]).talkRatio, null);
});

// ------------------------------------------------------------------------------- choosing

test("the turn record tells which turns look suspicious", () => {
  assert.deepEqual(suspiciousReasons(null), []);
  assert.deepEqual(suspiciousReasons({ interrupted: false, answered: true, act: "other" }), []);
  assert.deepEqual(suspiciousReasons({ interrupted: true }), ["interrupted"]);
  assert.deepEqual(suspiciousReasons({ answered: false }), ["unanswered"]);
  assert.deepEqual(suspiciousReasons({ act: "complaint" }), ["act:complaint"]);
  assert.deepEqual(suspiciousReasons({ resumed: 2, first_audio_ms: 5000 }), ["resumed", "slow"]);
});

test("a turn key is the turn ref, or the reply id when there is no record", () => {
  assert.equal(turnKey("s-t-1", "m1"), "s-t-1");
  assert.equal(turnKey(undefined, "m1"), "reply-m1");
  assert.equal(turnKey(undefined, undefined), null);
});

const ledgers = [
  { turn_ref: "s-t-1", replyMessageId: "r1", interrupted: false },
  { turn_ref: "s-t-2", replyMessageId: "r2", interrupted: true },
  { turn_ref: "s-t-3", replyMessageId: "r3", act: "complaint" },
  { turn_ref: "s-t-4", interrupted: true },
];

test("reported turns come first, then suspicious ones; ordinary turns need all or a sample", () => {
  const picked = pickCandidates({
    ledgers,
    reports: [{ replyMessageId: "r1", category: "forgot", note: null }],
    existing: new Set(),
    sampleRate: 0,
    all: false,
  });
  assert.deepEqual(
    picked.map((c) => [c.turnKey, c.trigger]),
    [
      ["s-t-1", "report"],
      ["s-t-2", "flag"],
      ["s-t-3", "flag"],
    ],
  );
  const all = pickCandidates({ ledgers, reports: [], existing: new Set(["s-t-2"]), all: true });
  assert.deepEqual(
    all.map((c) => c.turnKey),
    ["s-t-1", "s-t-3"],
  );
  const sampled = pickCandidates({
    ledgers: [ledgers[0]],
    reports: [],
    existing: new Set(),
    sampleRate: 0.5,
    random: () => 0.1,
  });
  assert.equal(sampled[0].trigger, "sample");
});

test("a report without a record still gets a turn; reports-only skips the rest", () => {
  const picked = pickCandidates({
    ledgers,
    reports: [{ replyMessageId: "old", category: "other", note: "x" }],
    existing: new Set(),
    reportsOnly: true,
    all: true,
  });
  assert.deepEqual(
    picked.map((c) => c.turnKey),
    ["reply-old"],
  );
});

// ------------------------------------------------------------------------------ issues

test("an assignment either joins an offered pattern or describes a new one", () => {
  const ids = new Set(["i1", "i2"]);
  assert.deepEqual(
    parseAssignment({ issue_id: "i1", title: "", description: "", fix_where: "prompt" }, ids),
    { issueId: "i1", title: "", description: "", fixWhere: "prompt" },
  );
  assert.equal(
    parseAssignment(
      { issue_id: "invented", title: "x", description: "", fix_where: "prompt" },
      ids,
    ),
    null,
  );
  const fresh = parseAssignment(
    { issue_id: "", title: "فيك تتعلم", description: "Lebanese phrase", fix_where: "dialect_list" },
    ids,
  );
  assert.equal(fresh?.issueId, null);
  assert.equal(fresh?.title, "فيك تتعلم");
  assert.equal(
    parseAssignment({ issue_id: "", title: "  ", description: "", fix_where: "prompt" }, ids),
    null,
  );
  assert.equal(
    parseAssignment({ issue_id: "", title: "t", description: "", fix_where: "moon" }, ids),
    null,
  );
});

test("duplicate groups only use offered ids and never merge a pattern twice", () => {
  const ids = new Set(["a", "b", "c", "d"]);
  const groups = parseDuplicates(
    {
      groups: [
        { keep_id: "a", merge_ids: ["b", "a", "zzz"], why: "same" },
        { keep_id: "c", merge_ids: ["b", "d"], why: "b is taken" },
        { keep_id: "ghost", merge_ids: ["d"], why: "unknown keep" },
        { keep_id: "d", merge_ids: [], why: "nothing" },
      ],
    },
    ids,
  );
  assert.deepEqual(groups, [
    { keepId: "a", mergeIds: ["b"], why: "same" },
    { keepId: "c", mergeIds: ["d"], why: "b is taken" },
  ]);
  assert.equal(parseDuplicates({ groups: "no" }, ids), null);
  assert.deepEqual(parseDuplicates({ groups: [] }, ids), []);
});

test("the assignment prompt lists the open patterns and carries the problem", () => {
  const prompt = assignPrompt({
    open: [{ id: "i1", title: "فيك تتعلم", description: "d", fixWhere: "dialect_list" }],
    problem: {
      category: "wrong_dialect",
      cause: "language_choice",
      explanation: "e",
      evidence: "q",
      fix: null,
      ritaReply: "رد",
      facts: [],
      dialect: [],
      timing: null,
    },
  });
  assert.ok(
    prompt.includes("<open_patterns>") &&
      prompt.includes('"id":"i1"') &&
      prompt.includes("<problem>"),
  );
});

test("a turn every check passed skips the diagnosis; anything off still gets it", async () => {
  const { needsDiagnosis, CLEAN_DIAGNOSIS, finalizeReview } = await import("./rita-review.ts");
  const ritaWins = {
    winner: "rita" as const,
    agree: true,
    ritaAverage: 4.5,
    referenceAverage: 4,
    criteria: {} as never,
    comparison: [],
  };
  const clean = { facts: [], dialect: [], merged: ritaWins, timing: null };
  assert.equal(needsDiagnosis(clean), false);
  assert.equal(finalizeReview({ diagnosis: CLEAN_DIAGNOSIS, ...clean }).verdict, "ok");

  const loose = { claim: "x", verdict: "imprecise" as const, correction: "y" };
  assert.equal(needsDiagnosis({ ...clean, facts: [loose] }), true);
  assert.equal(
    needsDiagnosis({ ...clean, dialect: [{ phrase: "x", kind: "not_jordanian", better: "y" }] }),
    true,
  );
  assert.equal(needsDiagnosis({ ...clean, merged: { ...ritaWins, winner: "tie" } }), true);
  assert.equal(needsDiagnosis({ ...clean, merged: { ...ritaWins, agree: false } }), true);
  assert.equal(needsDiagnosis({ ...clean, merged: null }), true);
  assert.equal(
    needsDiagnosis({
      ...clean,
      timing: {
        interrupted: true,
        answered: true,
        stop: null,
        waitMs: null,
        resumed: null,
        firstAudioMs: null,
        cutAfterMs: null,
        flags: ["cut_off"],
      },
    }),
    true,
  );
  assert.equal(needsDiagnosis({ ...clean, report: { category: "wrong", note: null } }), true);
});

test("the conversation comes before the turn state, so the prompt opening can be cached", () => {
  const reference = referencePrompt({ messages, replyIndex: 3, ledger: { lang: "ar" } });
  assert.ok(reference.startsWith("<conversation_so_far>"));
  const judge = judgePrompt({ messages, replyIndex: 3, a: "x", b: "y" });
  assert.ok(judge.startsWith("<conversation_so_far>"));
});
