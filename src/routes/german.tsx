import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/german")({
  component: () => (
    <RequireAuth what="your German practice">
      <Outlet />
    </RequireAuth>
  ),
});
