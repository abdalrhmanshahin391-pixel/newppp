/**
 * Course and Question Bank constants and slug resolution.
 */

export const SAMPLE_BANK_ID = "11111111-1111-4111-8111-111111111111";

export const QUESTION_BANK_SLUGS = new Set([
  "question-bank",
  "sample-bank",
  "rheumatic-fever",
  "sample",
]);

/**
 * Resolves a URL parameter (slug or UUID) to the database course ID.
 */
export function resolveCourseId(param?: string | null): string {
  if (!param) return SAMPLE_BANK_ID;
  const clean = param.trim().toLowerCase();
  if (QUESTION_BANK_SLUGS.has(clean)) {
    return SAMPLE_BANK_ID;
  }
  return param;
}
