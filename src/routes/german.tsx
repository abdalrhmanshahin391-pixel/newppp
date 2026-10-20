import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/study/RequireAuth";
import { GermanOnlyGate } from "@/components/language/LanguageGate";

export const Route = createFileRoute("/german")({
  component: () => (
    <RequireAuth what="your German practice">
      <GermanOnlyGate>
        <Outlet />
      </GermanOnlyGate>
    </RequireAuth>
  ),
});
