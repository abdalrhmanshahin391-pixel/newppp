import type { ReactNode } from "react";
import { RequireSignIn } from "@/components/study/RequireSignIn";

/**
 * Wraps a study surface so only signed-in visitors reach it. Kept as a name for the pages that
 * use it; it is `RequireSignIn`: signed out, the visitor goes to the site's own sign-in page.
 */
export function RequireAuth({ children }: { children: ReactNode; what?: string }) {
  return <RequireSignIn>{children}</RequireSignIn>;
}
