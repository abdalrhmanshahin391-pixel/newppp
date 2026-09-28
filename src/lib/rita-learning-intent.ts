export type RitaLearningIntent =
  "translation" | "word_meaning" | "language_word_list" | "explicit_save" | "none";

const EXPLICIT_SAVE =
  /(?:save|add|put|always put|احفظ|حط|ضيف|أضف|خزّن).{0,55}(?:flashcards?|german lab|فلاش|مختبر|الموضوع|subject|subtopic)|(?:flashcards?|german lab|فلاش|مختبر).{0,45}(?:save|add|put|احفظ|حط|ضيف|أضف)/iu;
const TRANSLATION =
  /(?:translate|translation|how do (?:i|you|we) say|ترجم|ترجمة|كيف\s+(?:أحكي|أقول|بنحكي)|übersetz|wie sagt man)/iu;
const WORD_MEANING =
  /(?:what does .{1,80} mean|what is the meaning of|meaning of|شو\s+(?:معنى|يعني)|(?:ما|ايش|إيش)\s+معنى|was bedeutet|bedeutung von)/iu;
const LANGUAGE_LIST =
  /(?:give|teach|show|list|اعط|أعط|علمني|هات|اكتب).{0,35}(?:words?|phrases?|vocabulary|sentences?|كلمات|مفردات|جمل).{0,35}(?:german|english|arabic|deutsch|englisch|عربي|انجليزي|إنجليزي|ألماني|الماني)|(?:german|english|arabic|deutsch|englisch|عربي|انجليزي|إنجليزي|ألماني|الماني).{0,35}(?:words?|phrases?|vocabulary|sentences?|كلمات|مفردات|جمل)/iu;

export function classifyRitaLearningIntent(text: string): RitaLearningIntent {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 2) return "none";
  if (EXPLICIT_SAVE.test(clean)) return "explicit_save";
  if (TRANSLATION.test(clean)) return "translation";
  if (WORD_MEANING.test(clean)) return "word_meaning";
  if (LANGUAGE_LIST.test(clean)) return "language_word_list";
  return "none";
}

export function hasRitaLanguageLearningIntent(text: string) {
  return classifyRitaLearningIntent(text) !== "none";
}
