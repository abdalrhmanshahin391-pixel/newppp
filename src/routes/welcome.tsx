import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old "let's set up your profile" step is gone: a new account already gets its name and
 * username when it is made, and the rest lives in Settings. Old links to /welcome go straight on
 * to where they were heading, or home.
 */
export const Route = createFileRoute("/welcome")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ href: search.next ?? "/", replace: true });
  },
});
