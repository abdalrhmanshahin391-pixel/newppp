import { useLang } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { footerColumns } from "@/lib/footer-links";
import { SiteFooterView } from "./SiteFooterView";

/** Account-aware links feed a static, lightweight footer surface. */
export function SiteFooter() {
  const { lang } = useLang();
  const settings = useSiteSettings();
  const ar = lang === "ar";
  return (
    <SiteFooterView
      ar={ar}
      columns={footerColumns(ar, settings.offers_page_enabled)}
      supportEmail={SUPPORT_EMAIL}
      year={new Date().getFullYear()}
      tone="light"
    />
  );
}
