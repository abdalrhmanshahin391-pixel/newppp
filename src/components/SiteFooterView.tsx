import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { BRAND_NAME } from "@/lib/brand";

import type { FooterColumn } from "@/lib/footer-links";

/** The shared footer's visual surface; data and account rules stay in SiteFooter. */
export function SiteFooterView({
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
    <footer
      className="uz-footer"
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "روابط الموقع" : "Site footer"}
    >
      <div className="uz-footer-inner">
        <div className="uz-footer-top">
          <Link to="/" aria-label={ar ? "Uzyra الرئيسية" : "Uzyra home"} className="uz-footer-logo">
            <UzyraWordmark size={23} />
          </Link>
          <button
            type="button"
            className="uz-footer-up"
            onClick={() => {
              const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
            }}
          >
            <span>{ar ? "للأعلى" : "Back to top"}</span>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="uz-footer-grid">
          <div className="uz-footer-intro">
            <h2>
              {ar ? (
                <>
                  تعلّمها.
                  <br />
                  خلّيها معك.
                </>
              ) : (
                <>
                  Learn it.
                  <br />
                  Keep it.
                </>
              )}
            </h2>
            <p>
              {ar
                ? "احكي مع يوزرا، وادرس من مادّتك، وراجع اللي تعلّمته."
                : "Speak with Uzyra. Study your material. Keep what you learn."}
            </p>
            <Link to="/learn" className="uz-footer-start">
              {ar ? "ابدأ التعلّم" : "Start learning"}
              <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
          </div>

          <div className="uz-footer-links">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h3>{column.heading}</h3>
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
        </div>

        <div className="uz-footer-bottom">
          <a href={`mailto:${supportEmail}`} className="uz-footer-email" dir="ltr">
            {supportEmail}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <nav
            className="uz-footer-legal"
            aria-label={ar ? "الحساب والسياسات" : "Account and policies"}
          >
            <Link to="/settings" search={{ section: "account" }}>
              {ar ? "الإعدادات" : "Settings"}
            </Link>
            <Link to="/register">{ar ? "إنشاء حساب" : "Create account"}</Link>
            <Link to="/terms">{ar ? "الشروط" : "Terms"}</Link>
            <Link to="/privacy-policy">{ar ? "الخصوصية" : "Privacy"}</Link>
            <Link to="/refund-policy">{ar ? "الاسترجاع" : "Refunds"}</Link>
          </nav>
          <p className="uz-footer-copyright">
            <bdi dir="ltr">
              © {year} {BRAND_NAME}.
            </bdi>{" "}
            {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>
        </div>
      </div>

      <div className="uz-footer-art" aria-hidden="true" dir="ltr">
        <svg
          className="uz-footer-thread"
          viewBox="0 0 1400 300"
          fill="none"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M-70 240 C180 240 190 50 420 50 S780 270 1010 180 S1210 20 1470 20" />
        </svg>
        <UzyraWordmark withMark={false} size={240} className="uz-footer-signature" />
      </div>
    </footer>
  );
}
