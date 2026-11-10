import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ReviewSwitch } from "@/components/rita/ReviewSwitch";
import { useAuth } from "@/hooks/useAuth";
import { useUiLanguage } from "@/components/language/useUiLanguage";

/** Review controls stay available to admins inside a closed disclosure. */
export function AdminBar() {
  const { isAdmin } = useAuth();
  const ui = useUiLanguage();

  if (!isAdmin) return null;
  return (
    <details className="mt-5 text-sm" dir={ui === "ar" ? "rtl" : "ltr"}>
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        {ui === "ar" ? "أدوات الإدارة" : "Admin tools"}
      </summary>
      <div className="rita-admin-bar flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <span className="rounded-md bg-[var(--pp-grey)] px-2 py-1 text-[13px] font-semibold text-[var(--pp-muted)]">
          {ui === "ar" ? "للأدمن" : "Admin only"}
        </span>
        <ReviewSwitch compact />
        <span className="flex flex-wrap items-center gap-2 sm:ms-auto">
          <Link to="/admin/rita-quality" className="rita-btn rita-btn-sm rita-btn-soft gap-2">
            {ui === "ar" ? "جودة المحادثات" : "Conversation quality"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </span>
      </div>
    </details>
  );
}
