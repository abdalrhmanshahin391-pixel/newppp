const UNCERTAIN_DIALECT = /^(unknown|standard|automatic|neutral|none)$/i;

function cleanLabel(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function baseLanguage(value: string) {
  if (/\barabic\b/i.test(value)) return "ar";
  if (/\benglish\b/i.test(value)) return "en";
  return (
    cleanLabel(value)
      .match(/^([a-z]{2,3})(?:-|$)/i)?.[1]
      ?.toLowerCase() ?? ""
  );
}

export type RitaDialectEvidence = {
  dialect: string;
  confidence: number;
  source: "explicit" | "lexical" | "none";
};

function normalizedArabic(value: string) {
  return cleanLabel(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const ARABIC_DIALECT_MARKERS: Array<{
  dialect: string;
  markers: Array<[string, number]>;
}> = [
  {
    dialect: "ar-IQ",
    markers: [
      ["شنو", 4],
      ["شلون", 3],
      ["هوايه", 4],
      ["اكو", 4],
      ["اريد", 3],
      ["هسه", 3],
    ],
  },
  {
    dialect: "ar-EG",
    markers: [
      ["عايز", 4],
      ["ازاي", 4],
      ["دلوقتي", 4],
      ["ايه", 2],
      ["اوي", 3],
    ],
  },
  {
    dialect: "ar-JO",
    markers: [
      ["هسا", 4],
      ["بقدر", 2],
      ["بتقدر", 2],
      ["احكي", 1],
      ["احكيلي", 2],
      ["منيح", 2],
      ["قديش", 2],
    ],
  },
  {
    dialect: "ar-LB",
    markers: [
      ["هلق", 4],
      ["كتير", 2],
      ["شو", 1],
      ["بدي", 1],
    ],
  },
  {
    dialect: "ar-PS",
    markers: [
      ["هسع", 4],
      ["هسا", 2],
      ["كتير", 2],
      ["شو", 1],
      ["بدي", 1],
    ],
  },
  {
    dialect: "ar-SA",
    markers: [
      ["ابغى", 4],
      ["وش", 3],
      ["مره", 2],
      ["الحين", 2],
    ],
  },
  {
    dialect: "Gulf Arabic",
    markers: [
      ["وايد", 4],
      ["ابي", 3],
      ["الحين", 2],
    ],
  },
  {
    dialect: "ar-MA",
    markers: [
      ["دابا", 4],
      ["بزاف", 4],
      ["بغيت", 4],
      ["واش", 3],
    ],
  },
];

/**
 * Cheap, deterministic evidence from the transcript. It intentionally returns
 * no result for ambiguous Levantine vocabulary instead of inventing a country.
 */
export function detectRitaDialectEvidence(utterance: string): RitaDialectEvidence {
  const explicit = explicitRitaAccent(utterance);
  if (explicit) return { dialect: explicit, confidence: 1, source: "explicit" };

  const words = new Set(normalizedArabic(utterance).split(/\s+/).filter(Boolean));
  const ranked = ARABIC_DIALECT_MARKERS.map(({ dialect, markers }) => ({
    dialect,
    score: markers.reduce((score, [word, weight]) => score + (words.has(word) ? weight : 0), 0),
  })).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.score < 4 || best.score - (runnerUp?.score ?? 0) < 2)
    return { dialect: "", confidence: 0, source: "none" };
  return {
    dialect: best.dialect,
    confidence: Math.min(0.94, 0.72 + best.score * 0.035),
    source: "lexical",
  };
}

// An explicit spoken request is stronger evidence than a dialect guess made
// from a text transcript. Keep the mapping small and allow other dialect names
// through as labels so the model can still honor them.
export function explicitRitaAccent(utterance: string) {
  const normalized = normalizedArabic(utterance);
  const arabic = normalized.match(
    /(?:باللهجه|باللهجة|بلهجه|بلهجة|اللهجه|اللهجة|لهجه|لهجة)\s+([\p{L}-]+)/u,
  );
  const english = normalized.match(
    /(jordanian|iraqi|egyptian|palestinian|lebanese|syrian|saudi|moroccan|tunisian|algerian|emirati|yemeni|sudanese|gulf)\s+(?:arabic\s+)?(?:accent|dialect)|(?:speak|talk)\s+(?:in|with)\s+(?:a\s+)?(jordanian|iraqi|egyptian|palestinian|lebanese|syrian|saudi|moroccan|tunisian|algerian|emirati|yemeni|sudanese|gulf)/i,
  );
  const genericEnglish = normalized.match(
    /(?:speak|talk)(?:\s+to\s+me)?\s+(?:in|with)\s+(?:a|an)?\s*([a-z][a-z -]{1,38}?)\s+(?:accent|dialect)\b/i,
  );
  const requested =
    arabic?.[1] || english?.[1] || english?.[2] || genericEnglish?.[1]?.trim() || "";
  if (!requested) return "";
  const accents: Array<[RegExp, string]> = [
    [/اردن|jordan/, "ar-JO"],
    [/عراق|iraq/, "ar-IQ"],
    [/مصر|egypt/, "ar-EG"],
    [/فلسطين|palestin/, "ar-PS"],
    [/لبنان|leban/, "ar-LB"],
    [/سور|syria/, "ar-SY"],
    [/سعود|saudi/, "ar-SA"],
    [/مغرب|morocc/, "ar-MA"],
    [/تونس|tunis/, "ar-TN"],
    [/جزائر|algeri/, "ar-DZ"],
    [/امارات|emirati/, "ar-AE"],
    [/يمن|yemen/, "ar-YE"],
    [/سودان|sudan/, "ar-SD"],
    [/خليج|gulf/, "Gulf Arabic"],
  ];
  return accents.find(([pattern]) => pattern.test(requested))?.[1] || requested.slice(0, 40);
}

export function stableRitaDialect(args: {
  detected: string;
  confidence: number;
  previous: string;
  preference: string;
  language: string;
}) {
  const preference = cleanLabel(args.preference);
  if (preference && !UNCERTAIN_DIALECT.test(preference)) return preference;

  const detected = cleanLabel(args.detected);
  const previous = cleanLabel(args.previous);
  if (detected && !UNCERTAIN_DIALECT.test(detected) && args.confidence >= 0.72) return detected;

  if (previous && !UNCERTAIN_DIALECT.test(previous)) {
    const previousLanguage = baseLanguage(previous);
    const currentLanguage = baseLanguage(args.language);
    if (!previousLanguage || !currentLanguage || previousLanguage === currentLanguage)
      return previous;
  }
  return "standard";
}

export function spokenDialectLabel(value: string) {
  const clean = cleanLabel(value);
  if (!clean || UNCERTAIN_DIALECT.test(clean)) return "";
  if (/^[a-z]{2,3}$/i.test(clean)) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(clean.toLowerCase()) || clean;
    } catch {
      return clean;
    }
  }
  const locale = clean.match(/^([a-z]{2,3})-([a-z]{2}|[0-9]{3})$/i);
  if (!locale) return clean;
  try {
    const language = new Intl.DisplayNames(["en"], { type: "language" }).of(
      locale[1].toLowerCase(),
    );
    const region = new Intl.DisplayNames(["en"], { type: "region" }).of(locale[2].toUpperCase());
    return language && region ? `${language} as spoken in ${region}` : clean;
  } catch {
    return clean;
  }
}

export function ritaVoiceInstructions(language: string, dialect: string, emotion: string) {
  const accent = spokenDialectLabel(dialect);
  const spokenLanguage = spokenDialectLabel(language) || "the language of the supplied text";
  const style =
    emotion === "excited"
      ? "Sound genuinely pleased, not theatrical."
      : emotion === "playful"
        ? "Sound lightly playful, never sarcastic."
        : emotion === "thoughtful"
          ? "Sound attentive and thoughtful."
          : "Sound warm and relaxed.";
  return `You are Rita, a friendly tutor talking one-to-one, not reading a script. Speak naturally in ${accent || spokenLanguage}. Keep the exact colloquial wording and code-switching in the text. Use conversational rhythm, varied intonation, and brief natural pauses. ${style} Do not exaggerate an accent or add words.`;
}
