import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ReviewSwitch } from "@/components/rita/ReviewSwitch";
import { useAuth } from "@/hooks/useAuth";

/**
 * The admin's strip on the conversations page: the AI analysis switch, the way to Rita quality and
 * the guide. Dashed and labelled "Admin only" so it is never read as part of the learner's page;
 * learners do not get it at all.
 */
export function AdminBar() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;
  return (
    <details className="mt-5 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Admin tools</summary>
      <div className="rita-admin-bar flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <span className="rounded-md bg-[var(--pp-grey)] px-2 py-1 text-[13px] font-semibold text-[var(--pp-muted)]">
          Admin only
        </span>
        <ReviewSwitch compact />
        <span className="flex flex-wrap items-center gap-2 sm:ms-auto">
          <Link to="/admin/rita-quality" className="rita-btn rita-btn-sm rita-btn-soft gap-2">
            Rita quality <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </span>
      </div>
    </details>
  );
}
