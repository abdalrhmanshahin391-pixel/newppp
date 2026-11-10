import * as Menu from "@radix-ui/react-dropdown-menu";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useUiLanguage } from "@/components/language/useUiLanguage";
export type ConversationAction =
  "rename" | "pin" | "transcript" | "pdf" | "md" | "json" | "repair" | "delete";
export function ConversationMenu({
  title,
  isAdmin,
  busy,
  pinned = false,
  onAction,
}: {
  title: string;
  isAdmin: boolean;
  busy: boolean;
  pinned?: boolean;
  onAction: (action: ConversationAction) => void;
}) {
  const ui = useUiLanguage();
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  return (
    <Menu.Root dir={ui === "ar" ? "rtl" : "ltr"}>
      <Menu.Trigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={t(`More for ${title}`, `خيارات ${title}`)}
          className="rita-btn rita-btn-soft rita-btn-icon disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <MoreHorizontal size={20} />}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="edith-premium rita-menu">
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("rename")}>
            {t("Rename", "تغيير الاسم")}
          </Menu.Item>
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("pin")}>
            {pinned ? t("Unpin", "إلغاء التثبيت") : t("Pin conversation", "تثبيت المحادثة")}
          </Menu.Item>
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("transcript")}>
            {t("Read transcript", "اقرأ المحادثة")}
          </Menu.Item>
          <Menu.Sub>
            <Menu.SubTrigger className="rita-menu-item">{t("Export", "تصدير")}</Menu.SubTrigger>
            <Menu.Portal>
              <Menu.SubContent sideOffset={6} className="edith-premium rita-menu">
                <Menu.Item className="rita-menu-item" onSelect={() => onAction("pdf")}>
                  PDF
                </Menu.Item>
                <Menu.Item className="rita-menu-item" onSelect={() => onAction("md")}>
                  {t("Text for AI", "نص للذكاء الاصطناعي")}
                </Menu.Item>
                <Menu.Item className="rita-menu-item" onSelect={() => onAction("json")}>
                  JSON
                </Menu.Item>
                {isAdmin && (
                  <Menu.Item className="rita-menu-item" onSelect={() => onAction("repair")}>
                    {t("Repair file", "ملف الإصلاح")}
                  </Menu.Item>
                )}
              </Menu.SubContent>
            </Menu.Portal>
          </Menu.Sub>
          <Menu.Separator className="rita-menu-sep" />
          <Menu.Item
            className="rita-menu-item rita-menu-item-danger"
            onSelect={() => onAction("delete")}
          >
            {t("Delete conversation", "حذف المحادثة")}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
