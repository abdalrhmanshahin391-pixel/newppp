import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef } from "react";
import { useDismiss } from "./useDismiss";

export function HeaderResourcesMenu({
  arabic,
  open,
  onOpenChange,
  showMobilePricing = false,
}: {
  arabic: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showMobilePricing?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss(open, close, menu);

  return (
    <div ref={menu} className="ub-menu">
      <button
        type="button"
        data-rh-trigger
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => onOpenChange(!open)}
      >
        {arabic ? "الموارد" : "Resources"} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="ub-list">
          <Link to="/blog" onClick={close}>
            {arabic ? "المدونة" : "Blog"}
          </Link>
          <Link to="/books" onClick={close}>
            {arabic ? "المكتبة" : "Library"}
          </Link>
          {showMobilePricing && (
            <Link to="/pricing" className="ub-mobile" onClick={close}>
              {arabic ? "الأسعار" : "Pricing"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
