import { readFileSync } from "node:fs";

export const REQUIRED_CASES = Object.freeze({
  jordanian: 150,
  msa: 80,
  english: 100,
  german: 100,
  code_switch: 150,
  thinking_pause: 80,
  backchannel: 100,
  true_interruption: 100,
  noise_echo: 50,
  general_knowledge: 100,
  translation_vocabulary: 100,
  learning_save: 20,
  language_stability: 20,
  teaching_retry: 20,
  provider_failure: 12,
  pronunciation_uncertain: 20,
});
const SPEECH_CATEGORIES = new Set([
  "jordanian",
  "msa",
  "english",
  "german",
  "code_switch",
  "thinking_pause",
  "backchannel",
  "true_interruption",
  "noise_echo",
]);

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function evaluateRitaQa(rows) {
  const validRows = rows.filter((row) => row && typeof row === "object");
  const unique = new Set();
  const problems = [];
  if (validRows.length !== rows.length) problems.push("One or more rows are not objects");
  for (const row of validRows) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || unique.has(row.id)) {
      problems.push(`Missing or duplicate case id: ${String(row?.id ?? "")}`);
      continue;
    }
    unique.add(row.id);
    if (!(row.category in REQUIRED_CASES)) problems.push(`Unknown category: ${row.id}`);
    if (row.source !== "recorded_audio") problems.push(`No recorded-audio evidence: ${row.id}`);
  }

  const coverage = Object.fromEntries(
    Object.entries(REQUIRED_CASES).map(([category, required]) => {
      const observed = validRows.filter(
        (row) => row.category === category && row.source === "recorded_audio",
      ).length;
      return [category, { observed, required, passed: observed >= required }];
    }),
  );
  const goodNetwork = validRows.filter(
    (row) =>
      SPEECH_CATEGORIES.has(row.category) &&
      row.network === "good" &&
      finiteNonNegative(row.audibleLatencyMs),
  );
  const audible = goodNetwork.map((row) => row.audibleLatencyMs);
  const turnDecision = validRows
    .filter((row) => finiteNonNegative(row.turnDecisionMs))
    .map((row) => row.turnDecisionMs);
  const speech = validRows.filter((row) => SPEECH_CATEGORIES.has(row.category));
  const codeSwitch = validRows.filter((row) => row.category === "code_switch");
  const pauses = validRows.filter((row) => row.category === "thinking_pause");
  const backchannels = validRows.filter((row) => row.category === "backchannel");
  const interruptions = validRows.filter((row) => row.category === "true_interruption");
  const generalKnowledge = validRows.filter((row) => row.category === "general_knowledge");
  const learning = validRows.filter((row) => row.category === "translation_vocabulary");
  const saves = validRows.filter((row) => row.category === "learning_save");
  const languageStability = validRows.filter((row) => row.category === "language_stability");
  const teachingRetry = validRows.filter((row) => row.category === "teaching_retry");
  const failures = validRows.filter((row) => row.category === "provider_failure");
  const pronunciation = validRows.filter((row) => row.category === "pronunciation_uncertain");
  const rated = validRows.filter(
    (row) =>
      row.category === "jordanian" &&
      row.ratingCount >= 3 &&
      finiteNonNegative(row.naturalnessScore) &&
      finiteNonNegative(row.dialectScore) &&
      finiteNonNegative(row.intelligibilityScore),
  );
  const average = (key) =>
    rated.length ? rated.reduce((sum, row) => sum + row[key], 0) / rated.length : null;
  const stopTimes = interruptions
    .filter((row) => finiteNonNegative(row.interruptionStopMs))
    .map((row) => row.interruptionStopMs);
  const prematureRate = pauses.length
    ? pauses.filter((row) => row.prematureEnd === true).length / pauses.length
    : null;
  const falseInterruptionRate = backchannels.length
    ? backchannels.filter((row) => row.falseInterruption === true).length / backchannels.length
    : null;
  const latencyP50 = percentile(audible, 0.5);
  const latencyP95 = percentile(audible, 0.95);
  const stopP50 = percentile(stopTimes, 0.5);
  const stopP95 = percentile(stopTimes, 0.95);
  const gates = {
    corpusComplete: Object.values(coverage).every((item) => item.passed) && problems.length === 0,
    audibleLatency: audible.length >= 200 && latencyP50 < 1_500 && latencyP95 < 2_500,
    turnDecision: turnDecision.length >= 200 && percentile(turnDecision, 0.5) < 450,
    noPrematureCut: pauses.length >= REQUIRED_CASES.thinking_pause && prematureRate < 0.03,
    backchannelSafety:
      backchannels.length >= REQUIRED_CASES.backchannel && falseInterruptionRate < 0.03,
    interruptionSpeed:
      stopTimes.length >= REQUIRED_CASES.true_interruption && stopP50 < 200 && stopP95 < 400,
    understanding:
      speech.length >= 910 &&
      speech.filter((row) => row.intentUnderstood === true).length / speech.length >= 0.95,
    codeSwitchTerms:
      codeSwitch.length >= REQUIRED_CASES.code_switch &&
      codeSwitch.filter((row) => row.targetTermsCorrect === true).length / codeSwitch.length >=
        0.95,
    noFalseCards:
      generalKnowledge.length >= REQUIRED_CASES.general_knowledge &&
      generalKnowledge.every((row) => row.learningItemCount === 0),
    learningExtraction:
      learning.length >= REQUIRED_CASES.translation_vocabulary &&
      learning.every(
        (row) => row.learningJsonValid === true && row.learningMeaningCorrect === true,
      ),
    verifiedSaves:
      saves.length >= REQUIRED_CASES.learning_save &&
      saves.every((row) => row.savePersisted === true && row.duplicateCount === 0),
    stableLanguage:
      languageStability.length >= REQUIRED_CASES.language_stability &&
      languageStability.every((row) => row.turnCount >= 20 && row.wrongLanguageSwitch === false),
    changedTeachingStrategy:
      teachingRetry.length >= REQUIRED_CASES.teaching_retry &&
      teachingRetry.every((row) => row.changedStrategy === true),
    visibleProviderFailures:
      failures.length >= REQUIRED_CASES.provider_failure &&
      failures.every((row) => row.visibleError === true && row.legacyFallback === false),
    honestPronunciationFeedback:
      pronunciation.length >= REQUIRED_CASES.pronunciation_uncertain &&
      pronunciation.every((row) => row.uncertaintySafe === true),
    humanVoiceQuality:
      rated.length >= 50 &&
      average("naturalnessScore") >= 4 &&
      average("dialectScore") >= 4 &&
      average("intelligibilityScore") >= 4,
  };
  return {
    passed: Object.values(gates).every(Boolean),
    gates,
    coverage,
    sampleCounts: {
      audible: audible.length,
      turnDecision: turnDecision.length,
      interruptionStop: stopTimes.length,
    },
    measures: {
      latencyP50,
      latencyP95,
      turnDecisionP50: percentile(turnDecision, 0.5),
      stopP50,
      stopP95,
      prematureRate,
      falseInterruptionRate,
      ratedCount: rated.length,
      naturalnessAverage: average("naturalnessScore"),
      dialectAverage: average("dialectScore"),
      intelligibilityAverage: average("intelligibilityScore"),
    },
    problems,
  };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href
) {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("Usage: node scripts/rita-v3-qa-report.mjs results.jsonl\n");
    process.exitCode = 2;
  } else {
    try {
      const rows = readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const report = evaluateRitaQa(rows);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (!report.passed) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    }
  }
}
