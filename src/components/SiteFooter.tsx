import { useLang } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { SUPPORT_EMAIL } from "@/lib/legal-content";
import { footerColumns } from "@/lib/footer-links";
import { SiteFooterView } from "./SiteFooterView";

/** Account-aware links feed a static, lightweight footer surface. */
export function SiteFooter() {
  const { lang } = useLang();
  const settings = useSiteSettings();
  const learning = useLearningLanguage();
  const ar = lang === "ar";
  return (
    <SiteFooterView
      ar={ar}
      columns={footerColumns(ar, learning.code, settings.offers_page_enabled)}
      supportEmail={SUPPORT_EMAIL}
      year={new Date().getFullYear()}
    />
  );
}
