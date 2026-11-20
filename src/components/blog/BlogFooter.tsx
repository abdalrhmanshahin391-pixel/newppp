import { Link, type LinkProps } from "@tanstack/react-router";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { BRAND_NAME } from "@/lib/brand";
import { blogFooterColumns, type FooterColumn } from "@/lib/footer-links";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/** The blog's own footer: the same light surface, type and black pill as the blog header. */
export function BlogFooterView({
  ar,
  columns,
  supportEmail,
  year,
}: {
  ar: boolean;
  columns: FooterColumn[];
  supportEmail: string;
  year: number;
}) {
  return (
    <footer className="ub-footer" aria-label={ar ? "روابط الموقع" : "Site footer"}>
      <div className="ub-foot-top">
        <Link to="/" aria-label={ar ? "يوزرا الرئيسية" : "Uzyra home"}>
          <UzyraWordmark size={16} />
        </Link>
        <Link className="ub-cta" to="/start">
          {ar ? "ابدأ التعلّم" : "Start learning"}
        </Link>
      </div>
      <div className="ub-foot-cols">
        {columns.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2>{column.heading}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.to + link.label}>
                  <Link to={link.to as LinkProps["to"]}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="ub-foot-bottom">
        <a href={`mailto:${supportEmail}`} dir="ltr">
          {supportEmail}
        </a>
        <nav aria-label={ar ? "الحساب والسياسات" : "Account and policies"}>
          <Link to="/settings" search={{ section: "account" }}>
            {ar ? "الإعدادات" : "Settings"}
          </Link>
          <Link to="/register">{ar ? "إنشاء حساب" : "Create account"}</Link>
          <Link to="/terms">{ar ? "الشروط" : "Terms"}</Link>
          <Link to="/privacy-policy">{ar ? "الخصوصية" : "Privacy"}</Link>
          <Link to="/refund-policy">{ar ? "الاسترجاع" : "Refunds"}</Link>
        </nav>
        <p>
          <bdi dir="ltr">
            © {year} {BRAND_NAME}.
          </bdi>{" "}
          {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
        </p>
      </div>
    </footer>
  );
}

export function BlogFooter({ ar }: { ar: boolean }) {
  const settings = useSiteSettings();
  return (
    <BlogFooterView
      ar={ar}
      columns={blogFooterColumns(ar, settings.offers_page_enabled)}
      supportEmail={SUPPORT_EMAIL}
      year={new Date().getFullYear()}
    />
  );
}
