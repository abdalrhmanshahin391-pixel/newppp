/**
 * Which language Rita teaches in a voice session. A free conversation keeps the language it was
 * started in; otherwise it is the learner's active language. A language is only used when it is
 * in the list, and Rita's voice is only offered for languages an admin has switched voice on for.
 */

export type RegistryLanguage = {
  code: string;
  name_en: string;
  speech_code: string;
  voice_enabled: boolean;
  enabled: boolean;
};

export type TargetLanguage = {
  code: string;
  name: string;
  speechCode: string;
  voiceEnabled: boolean;
};

export function resolveTargetLanguage(input: {
  conversationLanguage?: string | null;
  profileLanguage?: string | null;
  registry: readonly RegistryLanguage[];
}): TargetLanguage | null {
  const code = input.conversationLanguage || input.profileLanguage || null;
  if (!code) return null;
  const row = input.registry.find((language) => language.code === code);
  if (!row) return null;
  return {
    code: row.code,
    name: row.name_en,
    speechCode: row.speech_code || row.code,
    voiceEnabled: row.enabled && row.voice_enabled,
  };
}
