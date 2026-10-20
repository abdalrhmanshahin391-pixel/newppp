import { useCallback, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/legacy-client";
import { refreshAuthProfile, useAuth } from "@/hooks/useAuth";
import { isVoiceSessionActive } from "@/lib/language-scope";
import {
  BUILT_IN_LANGUAGES,
  resolveActiveLanguage,
  sortLanguages,
  type LearningLanguage,
} from "@/lib/learning-language";

export const LANGUAGES_QUERY_KEY = ["learning-languages"] as const;

/** `error` while a live conversation blocks switching (the picker words it for the learner). */
export const VOICE_SESSION_ERROR = "voice-session-active";

async function fetchLanguages(): Promise<LearningLanguage[]> {
  const { data, error } = await supabase.from("learning_languages").select("*").order("sort");
  // No table yet (migration pending) or a network blip: answer "empty" instead of failing, so the
  // answer is cached like any other and every component using it does not retry on its own.
  if (error) return [];
  return (data ?? []) as LearningLanguage[];
}

/** The list of languages: from the database, or the two built-in ones if it is not there yet. */
export function useLanguageRegistry() {
  const query = useQuery({
    queryKey: LANGUAGES_QUERY_KEY,
    queryFn: fetchLanguages,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const fromDb = query.isSuccess && query.data.length > 0;
  const all = fromDb ? sortLanguages(query.data) : BUILT_IN_LANGUAGES;
  return {
    all,
    enabled: all.filter((l) => l.enabled),
    fromDb,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/* The choice is also kept on this device, so the right language is there on first paint and
 * keeps working on a database that has not been migrated yet. When the account has the
 * column, the account's value is the one that counts. */
const deviceKey = (uid: string) => `ritajet_learning_language:${uid}`;
const deviceListeners = new Set<() => void>();

function readDevice(uid: string | null): string | null {
  if (!uid || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(deviceKey(uid));
  } catch {
    return null;
  }
}

function writeDevice(uid: string, code: string) {
  try {
    window.localStorage.setItem(deviceKey(uid), code);
  } catch {
    /* private mode: the account copy still applies */
  }
  deviceListeners.forEach((listener) => listener());
}

function subscribeDevice(listener: () => void) {
  deviceListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    deviceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export type LearningLanguageState = {
  /** The active language code, or null until the learner has chosen one. */
  code: string | null;
  language: LearningLanguage | null;
  /** Languages the learner can pick today. */
  languages: LearningLanguage[];
  /** Every language including disabled ones (for names and the admin page). */
  allLanguages: LearningLanguage[];
  /** The language that received the learner's content from before languages existed. */
  legacyLanguage: string | null;
  /** True when the database has been migrated (the profile carries the new columns). */
  schemaReady: boolean;
  /** The account and the list have both loaded, so "not chosen yet" is a fact. */
  ready: boolean;
  pending: string | null;
  error: string | null;
  setLanguage: (code: string) => Promise<boolean>;
};

export function useLearningLanguage(): LearningLanguageState {
  const { user, profile, loading } = useAuth();
  const registry = useLanguageRegistry();
  const uid = user?.id ?? null;
  const device = useSyncExternalStore(
    subscribeDevice,
    () => readDevice(uid),
    () => null,
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columnPresent = profile !== null && "learning_language" in profile;
  const chosen = columnPresent ? (profile.learning_language ?? null) : device;
  // Until the list has come from the database, trust the stored choice (it may be a language the
  // built-in list does not know); afterwards it must still be an enabled language.
  const code = registry.fromDb ? resolveActiveLanguage(chosen, registry.all) : (chosen ?? null);
  const language = registry.all.find((l) => l.code === code) ?? null;
  const schemaReady = columnPresent;

  const setLanguage = useCallback(
    async (next: string) => {
      if (!uid || pending || next === code) return false;
      if (isVoiceSessionActive()) {
        setError(VOICE_SESSION_ERROR);
        return false;
      }
      setPending(next);
      setError(null);
      try {
        if (schemaReady) {
          const { error: rpcError } = await supabase.rpc("set_learning_language", { p_code: next });
          if (rpcError) throw rpcError;
          await refreshAuthProfile();
        }
        writeDevice(uid, next);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not change the language.");
        return false;
      } finally {
        setPending(null);
      }
    },
    [uid, pending, code, schemaReady],
  );

  return {
    code,
    language,
    languages: registry.enabled,
    allLanguages: registry.all,
    legacyLanguage: columnPresent ? (profile.legacy_language ?? null) : null,
    schemaReady,
    ready: !loading && (uid === null || profile !== null) && !registry.isLoading,
    pending,
    error,
    setLanguage,
  };
}
