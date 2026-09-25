// Compatibility auth middleware for server functions written against the
// previous backend schema: same checks, but the client is untyped so legacy
// table names keep compiling.
import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth as typedRequireSupabaseAuth } from "./auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any, "public", any>;

export const requireSupabaseAuth = createMiddleware({ type: "function" })
  .middleware([typedRequireSupabaseAuth])
  .server(async ({ next, context }) =>
    next({
      context: {
        supabase: context.supabase as unknown as UntypedClient,
        userId: context.userId,
        claims: context.claims,
      },
    }),
  );
