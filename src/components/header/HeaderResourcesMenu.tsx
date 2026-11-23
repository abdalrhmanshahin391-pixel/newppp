import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef } from "react";
import { MenuPanel, useInMenuGroup, useMenuTrigger } from "./MenuGroup";
import { useDismiss } from "./useDismiss";

/**
 * The «Resources» menu. Inside a MenuGroup it is drawn in the shared panel; alone (a page without
 * a group) it is a small list under its button.
 */
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
  const inGroup = useInMenuGroup();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss(open && !inGroup, close, menu);
  const trigger = useMenuTrigger({ id: "resources", open, onOpenChange });

  return (
    <div ref={menu} className="ub-menu">
      <button
        ref={trigger.ref}
        type="button"
        data-rh-trigger
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={trigger.onClick}
        onPointerEnter={trigger.onPointerEnter}
        onKeyDown={trigger.onKeyDown}
      >
        {arabic ? "الموارد" : "Resources"} <ChevronDown size={14} aria-hidden="true" />
      </button>
      <MenuPanel
        id="resources"
        open={open}
        panelId={id}
        width={220}
        label={arabic ? "الموارد" : "Resources"}
        fallbackClassName="ub-list"
      >
        <div className="uz-mp-list">
          <Link to="/blog" data-mp-item onClick={close}>
            {arabic ? "المدونة" : "Blog"}
          </Link>
          <Link to="/books" data-mp-item onClick={close}>
            {arabic ? "المكتبة" : "Library"}
          </Link>
          {showMobilePricing && (
            <Link to="/pricing" data-mp-item className="ub-mobile" onClick={close}>
              {arabic ? "الأسعار" : "Pricing"}
            </Link>
          )}
        </div>
      </MenuPanel>
    </div>
  );
}
