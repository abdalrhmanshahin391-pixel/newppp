import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { settingsText as t, type SettingsLang } from "@/lib/settings";

export function SettingsRow({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        {id ? (
          <label htmlFor={id} className="settings-label">
            {label}
          </label>
        ) : (
          <p className="settings-label">{label}</p>
        )}
        {hint && (
          <p className="settings-hint" id={id ? `${id}-hint` : undefined}>
            {hint}
          </p>
        )}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}
export function SettingsNotice({
  id,
  kind = "info",
  children,
}: {
  id?: string;
  kind?: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="settings-notice"
      data-kind={kind}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function SettingsLoading({ lang }: { lang: SettingsLang }) {
  return (
    <div className="settings-loading" role="status">
      <Loader2 size={20} className="settings-spinner" aria-hidden="true" />
      {t(lang, "Loading your details…", "جاري تحميل معلوماتك…")}
    </div>
  );
}
export function SettingsFailure({ lang, onRetry }: { lang: SettingsLang; onRetry: () => void }) {
  return (
    <SettingsNotice kind="error">
      <p>
        {t(
          lang,
          "We couldn’t load these details. Please try again.",
          "تعذّر تحميل هذه المعلومات. جرّب مرة ثانية.",
        )}
      </p>
      <button type="button" className="settings-button settings-button-secondary" onClick={onRetry}>
        {t(lang, "Try again", "إعادة المحاولة")}
      </button>
    </SettingsNotice>
  );
}
export function SettingsConfirm({
  open,
  onClose,
  title,
  children,
  busy,
  onConfirm,
  confirmLabel,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  confirmLabel: string;
  lang: SettingsLang;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="settings-overlay" />
        <Dialog.Content
          className="rita-app settings-confirm"
          dir={lang === "ar" ? "rtl" : "ltr"}
          role="alertdialog"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <Dialog.Title className="settings-confirm-title">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="settings-confirm-copy">{children}</div>
          </Dialog.Description>
          <div className="settings-actions">
            <button
              type="button"
              className="settings-button settings-button-secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t(lang, "Go back", "رجوع")}
            </button>
            <button
              type="button"
              className="settings-button settings-button-danger"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy && <Loader2 size={16} className="settings-spinner" aria-hidden="true" />}
              {busy ? t(lang, "Working…", "جاري التنفيذ…") : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
