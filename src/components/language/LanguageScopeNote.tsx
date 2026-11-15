import { LanguageFlag } from "@/components/language/LanguageFlag";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";

/**
 * One quiet line that says whose cards (or words) are on screen: the learning language's flag and
 * name, and that each language keeps its own. Shown on pages whose content is kept per language,
 * so switching language and seeing other cards is expected, not a loss.
 */
export function LanguageScopeNote({ what = "cards" }: { what?: string }) {
  const { language } = useLearningLanguage();
  if (!language) return null;
  return (
    <p
      data-testid="language-scope-note"
      className="mb-3 flex items-center gap-2 text-[13px] font-medium text-[var(--pp-muted,#5d5c6b)]"
    >
      <LanguageFlag language={language} size={18} />
      <span>
        Your {language.name_en} {what}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">. </span>
        each language keeps its own
      </span>
    </p>
  );
}
