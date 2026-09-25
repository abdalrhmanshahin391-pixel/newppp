export type RitaLearningIntent =
  "translation" | "word_meaning" | "language_word_list" | "explicit_save" | "none";

const EXPLICIT_SAVE =
  /(?:save|add|put|always put|احفظ|حط|ضيف|أضف|خزّن).{0,55}(?:flashcards?|german lab|فلاش|مختبر|الموضوع|subject|subtopic)|(?:flashcards?|german lab|فلاش|مختبر).{0,45}(?:save|add|put|احفظ|حط|ضيف|أضف)/iu;
const TRANSLATION =
  /(?:translate|translation|how do (?:i|you|we) say|how (?:is|do they call)|in (?:german|english|arabic)|ترجم|ترجمة|كيف\s*(?:بدي\s*)?(?:أحكي|احكي|بحكي|أقول|اقول|بقول|بنحكي|بقولوا)|شو\s+(?:اسمها|بنحكيها|بقولوا)|(?:بال|ب)(?:ألماني|الماني|إنجليزي|انجليزي|عربي)\s+شو|(?:ألماني|الماني|إنجليزي|انجليزي|عربي)\s+(?:كيف|شو)|übersetz|wie sagt man|auf deutsch|auf englisch)/iu;
const WORD_MEANING =
  /(?:what does .{1,80} mean|what is the meaning of|meaning of|شو\s+(?:معنى|يعني)|(?:ما|ايش|إيش|وش)\s+(?:معنى|يعني)|(?:هاي|هذي|هذه)\s+شو\s+يعني|was bedeutet|bedeutung von)/iu;
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

export function replyContainsLearningPair(reply: string) {
  const hasArabic = /[\u0600-\u06ff]{2,}/u.test(reply);
  const hasForeign = /[A-Za-zÄÖÜäöüß]{2,}/u.test(reply);
  return hasArabic && hasForeign && /(?:يعني|معناها|تقول|بنحكي|مثال|means?|say|bedeutet|heißt|:|—)/iu.test(reply);
}
