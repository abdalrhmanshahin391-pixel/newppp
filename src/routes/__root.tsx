import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getSiteBootstrap, type BootstrapPayload } from "@/lib/site-bootstrap.functions";
import { normalizeSettings } from "@/hooks/useSiteSettings";
import { usePresence } from "@/hooks/usePresence";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { GoldenTheme } from "@/components/GoldenTheme";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { needsOnboarding } from "@/lib/onboarding";
import "@/i18n";
import { DeferredOverlays } from "@/components/DeferredOverlays";
import { AnnouncementBar } from "@/components/AnnouncementBar";

// Language only — the seasonal theme comes from the server-rendered head script
// so it can never flash a stale value from localStorage.
const themeBootScript = `(function(){try{document.documentElement.classList.remove('dark');var l='en';try{l=localStorage.getItem('ysmu-lang')==='ar'?'ar':'en';}catch(_){}document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');}catch(e){}})();`;
// A stale deployment can make a lazy-loaded chunk unavailable. Retry once, then
// stop with a readable page. The old pageshow handler cleared this guard on the
// retry itself, which turned one persistent chunk error into an endless reload.
const recoveryBootScript = `(function(){var m='rita-recovered-build';var ttl=300000;function clearLater(){try{if(sessionStorage.getItem(m)==='1'){setTimeout(function(){try{sessionStorage.removeItem(m)}catch(_){}},ttl)}}catch(_){}}function stale(e){var s=String((e&&e.reason&&e.reason.message)||(e&&e.message)||'');return /dynamically imported module|ChunkLoadError|Loading chunk|Importing a module script failed/i.test(s)}function recover(e){if(!stale(e))return;try{if(sessionStorage.getItem(m)!=='1'){sessionStorage.setItem(m,'1');location.reload();return}}catch(_){}document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:24px;font:15px/1.5 system-ui;background:#faf8f2;color:#181817"><div style="max-width:430px;text-align:center"><h1 style="font-size:24px">RitaJet needs a refresh</h1><p>The site was updated while this page was open. Try again after a moment, or return home.</p><button onclick="location.reload()" style="border:0;border-radius:999px;padding:12px 20px;background:#0071e3;color:white;font-weight:700">Reload RitaJet</button></div></main>'}clearLater();addEventListener('error',recover,true);addEventListener('unhandledrejection',recover);clearLater()})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async (): Promise<BootstrapPayload> => {
    return await getSiteBootstrap();
  },
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RitaJet — flashcards, PDF summaries and AI study questions" },
      {
        name: "description",
        content:
          "Rita is a calm study workspace: build flashcard decks, turn lecture PDFs into one-page summaries, generate practice questions and plan your day.",
      },
      { name: "author", content: "RitaJet" },
      { name: "google-site-verification", content: "U9UIGln2ZVhjR6-rfab8T6y0XwmD0zLbLQqcwmBL1Lg" },
      { name: "google-site-verification", content: "5x31hbQQtmr14Jhd9AbkN5YlijfbfFTulNvcHMs1Y_8" },
      { name: "application-name", content: "RitaJet" },
      { name: "theme-color", content: "#8ec63f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "RitaJet" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },

      {
        property: "og:title",
        content: "RitaJet — flashcards, PDF summaries and AI study questions",
      },
      {
        property: "og:description",
        content:
          "A calm study workspace: flashcards, one-page PDF summaries, practice questions and a to-do board that keeps your streak alive.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "RitaJet" },
      {
        name: "twitter:title",
        content: "RitaJet — flashcards, PDF summaries and AI study questions",
      },
      {
        name: "twitter:description",
        content: "Flashcards, PDF summaries, practice questions and a study planner in one place.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://cdn.paddle.com" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter+Tight:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter+Tight:wght@400;500;600;700&display=swap",
        media: "print",
        onLoad: "this.media='all'",
      },

      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        // Runs once per page load only. Re-injections after a router
        // invalidate can carry a stale (cached) theme and would otherwise
        // snap the skin back to the previous one.
        children: `(function(){try{if(window.__themeBooted)return;window.__themeBooted=1;var d=['ramadan','eid','fireworks','stars','golden-age','desert-night','emerald-library'];var t=${JSON.stringify(
          (loaderData?.settings?.["theme"] as string) ?? "default",
        )};if(t&&t!=='default'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.removeAttribute('data-theme');}document.documentElement.classList.toggle('dark',d.indexOf(t)>=0);try{localStorage.setItem('ysmu-theme',t);}catch(_){}}catch(e){}})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "EducationalOrganization",
              "@id": "https://ritajet.com/#organization",
              name: "RitaJet",
              alternateName: ["RitaJet", "Rita Study", "RitaJet study tools"],
              url: "https://ritajet.com/",
              logo: "https://ritajet.com/favicon-512.png",
              description:
                "Rita is a study workspace with flashcards, PDF summaries, AI practice questions and a study planner.",
            },
            {
              "@type": "WebSite",
              "@id": "https://ritajet.com/#website",
              name: "RitaJet",
              url: "https://ritajet.com/",
              publisher: { "@id": "https://ritajet.com/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: recoveryBootScript }} />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter+Tight:wght@400;500;600;700&display=swap"
          />
        </noscript>
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const boot = Route.useLoaderData();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Seed the caches synchronously (before the first paint) so no component
  // has to refetch global settings/copy after hydration.
  useState(() => {
    if (boot?.settings)
      queryClient.setQueryData(["site-settings"], normalizeSettings(boot.settings));
    // Replaced artwork is already resolved on the server, so pictures paint
    // correct on the first frame instead of flashing the built-in art.
    if (boot?.siteImages) queryClient.setQueryData(["site-images"], boot.siteImages);
    return null;
  });

  useEffect(() => {
    if (loading) return;
    // Sample content is only added after the account's own kit has loaded, so
    // it can never overwrite real data or race the cloud copy.
    // Guests do not need cloud synchronization at all, so keep its network and
    // storage work off the public landing-page startup path.
    let cancelled = false;
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const run = async () => {
      if (cancelled) return;
      try {
        const seed = await import("@/lib/demo-seed");
        if (user) {
          const sync = await import("@/lib/cloud-sync");
          await sync.startCloudSync();
        }
        if (cancelled) return;
        seed.seedDemoContent();
      } catch (error) {
        reportLovableError(error, { boundary: "background_startup" });
      }
    };
    const id = idle
      ? idle(() => void run(), { timeout: 1500 })
      : window.setTimeout(() => void run(), 600);
    return () => {
      cancelled = true;
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (idle && cancelIdle) cancelIdle(id as number);
      else window.clearTimeout(id as number);
    };
  }, [loading, user?.id]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
            router.invalidate();
            // Only user-scoped caches change on auth transitions; blanket
            // invalidation used to refetch the whole site on every sign-in.
            if (event !== "SIGNED_OUT") {
              for (const key of [
                "auth",
                "my-courses",
                "my-lecture-courses",
                "profile",
                "committee-role",
              ]) {
                queryClient.invalidateQueries({ queryKey: [key] });
              }
            }
          }
        });
        unsub = () => sub.subscription.unsubscribe();
      } catch (error) {
        reportLovableError(error, { boundary: "auth_listener_startup" });
      }
    })();
    return () => unsub?.();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <GoldenTheme />
          <PresenceTracker />
          <DeviceTracker />
          <OnboardingGate />
          <AnnouncementBar />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <GlobalFooter />
          <DeferredOverlays />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function PresenceTracker() {
  usePresence();
  return null;
}

/**
 * Accounts can land without a username, real
 * name or phone. Send them through /welcome once, from anywhere in the app,
 * so the state can never linger half-finished.
 */
const ONBOARDING_EXEMPT = [
  "/welcome",
  "/auth",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/locked",
];

function OnboardingGate() {
  const { user, profile, loading } = useAuth();
  const location = useRouterState({ select: (s) => s.location });
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const pathname = location.pathname;
    if (ONBOARDING_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
    const provider =
      (user.app_metadata?.provider as string | undefined) ??
      (user.identities?.[0]?.provider as string | undefined);
    if (!needsOnboarding(user.id, profile, provider)) return;
    const next = pathname + (location.searchStr ?? "");
    const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    // Navigate in-app: a hard reload here threw away the freshly booted app.
    void router.navigate({ href: `/welcome${q}`, replace: true });
  }, [loading, user, profile, location, router]);

  return null;
}

/**
 * The site directory footer on every page except full-screen working
 * surfaces (admin, quiz/study players, auth-blocked screens) where it
 * would only get in the way.
 */
const NO_FOOTER = [
  "/admin",
  "/locked",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/rita-live",
];

function GlobalFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    NO_FOOTER.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    /\/(run|exam|match|tap|checkout)(\/|$)/.test(pathname);
  if (hidden) return null;
  return <SiteFooter />;
}

function DeviceTracker() {
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    let lastPing = 0;

    // The device check used to run every 60s in every open tab, plus once on
    // every focus/visibility change. That is a request storm at scale for a
    // check that only needs to be roughly current, so it is now throttled to
    // once every 5 minutes and never runs while the tab is hidden.
    const MIN_GAP_MS = 5 * 60_000;

    async function ping(force = false) {
      if (cancelled) return;
      if (!force) {
        if (document.hidden) return;
        if (Date.now() - lastPing < MIN_GAP_MS) return;
      }
      lastPing = Date.now();
      try {
        const [{ supabase }, { getOrCreateDeviceId }, { recordDevice }] = await Promise.all([
          import("@/integrations/supabase/client"),
          import("@/lib/device-id"),
          import("@/lib/devices.functions"),
        ]);
        const { data } = await supabase.auth.getSession();
        if (!data.session || cancelled) return;
        const deviceId = getOrCreateDeviceId();
        const res = await recordDevice({ data: { deviceId } }).catch(() => null);
        if (cancelled) return;
        if (res && "ok" in res && !res.ok) {
          // Over the device limit (or manually locked): send the user to the
          // reactivation screen instead of silently signing them out, so they
          // can redeem a code or contact support. Admins never hit this path.
          if (window.location.pathname !== "/locked") {
            window.location.replace("/locked");
          }
        }
      } catch {
        /* ignore */
      }
    }

    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") void ping(true);
        });
        unsub = () => sub.subscription.unsubscribe();
        const idle = (
          window as unknown as {
            requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
          }
        ).requestIdleCallback;
        if (idle) {
          idle(
            () => {
              if (!cancelled) void ping(true);
            },
            { timeout: 2000 },
          );
        } else {
          setTimeout(() => {
            if (!cancelled) void ping(true);
          }, 1000);
        }
      } catch {
        /* Account tracking is optional and must never affect page rendering. */
      }
    })();

    const interval = window.setInterval(() => void ping(), MIN_GAP_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      unsub?.();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
