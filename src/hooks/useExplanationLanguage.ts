import { useCallback, useSyncExternalStore } from "react";
import {
  EXPLANATION_CHANGED_EVENT,
  EXPLANATION_STORAGE_KEY,
  pickExplanation,
  writeExplanationLanguage,
  type ExplanationLanguage,
} from "@/lib/explanation-language";

/** The account this device belongs to; set by the account sync and never mirrored itself. */
const ACCOUNT_KEY = "rj_last_account";
let shown: { value: ExplanationLanguage; account: string | null } | null = null;

function snapshot(): ExplanationLanguage {
  const store = storage();
  let raw: string | null = null;
  let account: string | null = null;
  try {
    raw = store?.getItem(EXPLANATION_STORAGE_KEY) ?? null;
    account = store?.getItem(ACCOUNT_KEY) ?? null;
  } catch {
    /* blocked storage: automatic */
  }
  const value = pickExplanation(raw, shown, account);
  shown = { value, account };
  return value;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === EXPLANATION_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage); // another tab
  window.addEventListener("rita-cloud-sync", onChange); // the account's saved value arrived
  window.addEventListener(EXPLANATION_CHANGED_EVENT, onChange); // this page
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("rita-cloud-sync", onChange);
    window.removeEventListener(EXPLANATION_CHANGED_EVENT, onChange);
  };
}

/** The language Rita explains in (see lib/explanation-language). Shared by every page that shows it. */
export function useExplanationLanguage() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "automatic" as const);
  const setValue = useCallback((next: ExplanationLanguage) => {
    writeExplanationLanguage(storage(), next);
    window.dispatchEvent(new Event(EXPLANATION_CHANGED_EVENT));
  }, []);
  return { value, setValue };
}
