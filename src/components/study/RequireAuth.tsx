import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SignedOutPanel } from "@/components/study/SignedOutPanel";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps a study surface so only signed-in visitors reach it.
 *
 * While the shared auth snapshot is still resolving we render a quiet
 * placeholder — flashing the sign-in panel first made signed-in users think
 * they had been logged out.
 */
export function RequireAuth({
  children,
  what = "your study work",
}: {
  children: ReactNode;
  what?: string;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
          <div className="h-6 w-40 animate-pulse rounded-full bg-black/10" />
          <div className="mt-4 h-4 w-64 animate-pulse rounded-full bg-black/5" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rita-cream min-h-screen bg-[color:var(--pro-page,#fdf8ef)] text-foreground">
        <SiteHeader />
        <div className="mx-auto max-w-[1180px] px-4 md:px-8">
          <SignedOutPanel what={what} />
        </div>
      </div>
    );
  }


  return <>{children}</>;
}
