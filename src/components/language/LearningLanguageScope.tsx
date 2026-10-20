import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { LANGUAGE_CHANGED_EVENT, setLanguageScope } from "@/lib/language-scope";
import { moveLegacyKeys } from "@/lib/learning-language";

/**
 * Mounted once at the root. Keeps the study kit's active language in step with the learner's
 * account, and moves what they saved before languages existed under their first language.
 */
export function LearningLanguageScope() {
  const { user, loading } = useAuth();
  const { code, legacyLanguage, ready, schemaReady } = useLearningLanguage();
  const userId = user?.id ?? null;

  useEffect(() => {
    // Not signed out until the first session check has finished.
    if (loading) return;
    if (!userId) {
      setLanguageScope({ active: null, legacy: null });
      return;
    }
    // Until the account has loaded, keep what the device remembers so the first paint is right.
    if (!ready) return;
    // Old-named keys move first, in the same step, so the new scope never opens on an empty board
    // (which would get the sample content) while the learner's own content is still unmoved.
    if (schemaReady && legacyLanguage) moveLegacyKeys(window.localStorage, legacyLanguage);
    setLanguageScope({ active: code, legacy: legacyLanguage });
  }, [loading, userId, ready, schemaReady, code, legacyLanguage]);

  useEffect(() => {
    if (!userId || !ready || !schemaReady || !legacyLanguage) return;
    let cancelled = false;
    const adopt = () => {
      if (cancelled) return;
      if (moveLegacyKeys(window.localStorage, legacyLanguage) > 0) {
        window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
      }
    };
    // The account's saved kit is pulled onto the device first; moving before that would race it.
    void import("@/lib/cloud-sync")
      .then((sync) => sync.startCloudSync())
      .then(adopt)
      .catch(() => {});
    // A later pull (another tab, another device) can bring old-named keys back.
    window.addEventListener("rita-cloud-sync", adopt);
    return () => {
      cancelled = true;
      window.removeEventListener("rita-cloud-sync", adopt);
    };
  }, [userId, ready, schemaReady, legacyLanguage]);

  return null;
}
