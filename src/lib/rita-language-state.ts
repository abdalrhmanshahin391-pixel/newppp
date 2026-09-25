export type RitaLanguageSource = "explicit" | "stable-auto" | "profile";

export type RitaLanguageState = {
  activeLanguage: string;
  activeDialect: string;
  source: RitaLanguageSource;
  consecutiveEvidence: number;
  candidateLanguage: string;
  candidateDialect: string;
};

export type RitaLanguageEvidence = {
  language: string;
  dialect?: string;
  confidence: number;
  explicit?: boolean;
};

function baseLanguage(value: string) {
  return value.trim().toLowerCase().split("-")[0] || "unknown";
}

export function initialRitaLanguageState(args: {
  language?: string;
  dialect?: string;
  browserLocale?: string;
}): RitaLanguageState {
  const preferred = String(args.language || "").trim();
  const browser = String(args.browserLocale || "").trim();
  const language = preferred && preferred !== "automatic" ? preferred : browser || "unknown";
  const base = baseLanguage(language);
  return {
    activeLanguage: base === "ar" ? "ar" : base === "de" ? "de" : base === "en" ? "en" : "unknown",
    activeDialect:
      String(args.dialect || "").trim() ||
      (base === "ar" ? "ar-JO" : base === "de" ? "de-DE" : base === "en" ? "en-GB" : "standard"),
    source: preferred && preferred !== "automatic" ? "profile" : "profile",
    consecutiveEvidence: 0,
    candidateLanguage: "",
    candidateDialect: "",
  };
}

export function advanceRitaLanguageState(
  state: RitaLanguageState,
  evidence: RitaLanguageEvidence,
): RitaLanguageState {
  const language = baseLanguage(evidence.language);
  if (!language || language === "unknown") return state;
  const dialect = String(evidence.dialect || "").trim();
  if (evidence.explicit) {
    return {
      activeLanguage: language,
      activeDialect: dialect || (language === "ar" ? "ar-JO" : language),
      source: "explicit",
      consecutiveEvidence: 0,
      candidateLanguage: "",
      candidateDialect: "",
    };
  }
  if (baseLanguage(state.activeLanguage) === "unknown" && evidence.confidence >= 0.68) {
    return {
      activeLanguage: language,
      activeDialect: dialect || (language === "ar" ? "ar-JO" : language),
      source: "stable-auto",
      consecutiveEvidence: 0,
      candidateLanguage: "",
      candidateDialect: "",
    };
  }
  if (language === baseLanguage(state.activeLanguage)) {
    return {
      ...state,
      activeDialect:
        state.source === "explicit" || evidence.confidence < 0.78 || !dialect
          ? state.activeDialect
          : dialect,
      candidateLanguage: "",
      candidateDialect: "",
      consecutiveEvidence: 0,
    };
  }
  if (evidence.confidence < 0.68) return state;
  const repeated = state.candidateLanguage === language;
  const count = repeated ? state.consecutiveEvidence + 1 : 1;
  if (count < 2) {
    return {
      ...state,
      candidateLanguage: language,
      candidateDialect: dialect,
      consecutiveEvidence: count,
    };
  }
  return {
    activeLanguage: language,
    activeDialect: dialect || (language === "ar" ? "ar-JO" : language),
    source: "stable-auto",
    candidateLanguage: "",
    candidateDialect: "",
    consecutiveEvidence: 0,
  };
}

export function inferRitaTranscriptLanguage(text: string) {
  const letters = Array.from(text).filter((character) => /\p{L}/u.test(character));
  if (!letters.length) return { language: "unknown", confidence: 0 };
  const arabic = letters.filter((character) => /\p{Script=Arabic}/u.test(character)).length;
  if (arabic / letters.length >= 0.45) return { language: "ar", confidence: 0.92 };
  const germanMarkers =
    /\b(?:ich|nicht|und|oder|bitte|danke|guten|morgen|was|wie|warum|möchte|kannst|deutsch)\b/i;
  if (germanMarkers.test(text) || /[äöüß]/i.test(text)) return { language: "de", confidence: 0.84 };
  return { language: "en", confidence: 0.74 };
}
