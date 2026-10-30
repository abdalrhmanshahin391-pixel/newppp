import { useEffect, useState, type ComponentType } from "react";

/**
 * Floating extras (announcements, tour, help button, sign-in sheet, toasts)
 * are not part of the first painted page. Loading them after the page is
 * interactive keeps the very first download small, so pages open fast.
 */
export function DeferredOverlays() {
  const [parts, setParts] = useState<ComponentType[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [banner, ritax, help, auth, toaster] = await Promise.all([
        import("@/components/PaymentTestModeBanner"),
        import("@/components/RitaXAnnouncements"),
        import("@/components/tutorials/HowItWorksButton"),
        import("@/components/auth/AuthDialog"),
        import("@/components/ui/sonner"),
      ]).catch((error) => {
        console.warn("Optional tools could not be loaded", error);
        return [];
      });
      if (!banner || !ritax || !help || !auth || !toaster) return;
      if (cancelled) return;
      const Toasts = () => <toaster.Toaster richColors position="top-right" />;
      const activeParts = [
        banner.PaymentTestModeBanner,
        ritax.RitaXAnnouncements,
        help.ToolTutorialLauncher,
        auth.AuthDialogHost,
        Toasts,
      ];
      setParts(activeParts);
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const id = idle ? idle(() => void load(), { timeout: 1200 }) : window.setTimeout(() => void load(), 200);
    return () => {
      cancelled = true;
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && cancelIdle) cancelIdle(id as number);
      else window.clearTimeout(id as number);
    };
  }, []);

  if (!parts) return null;
  return (
    <>
      {parts.map((Part, i) => (
        <Part key={i} />
      ))}
    </>
  );
}
