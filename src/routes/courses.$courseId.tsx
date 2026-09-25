import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseLayout,
});

/**
 * Course layout — enforces the paywall at the route level.
 * If the course has a price and the signed-in user is neither admin, directly
 * enrolled, nor covered by a package purchase, redirect to checkout.
 */
function CourseLayout() {
  const { courseId } = Route.useParams();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user || isAdmin) return;
    let cancelled = false;

    (async () => {
      const { data: c } = await (supabase.from as any)("courses")
        .select("price")
        .eq("id", courseId)
        .maybeSingle();
      const price = Number(c?.price ?? 0);
      if (price <= 0) return;

      // Direct enrollment
      const { data: enr } = await (supabase.from as any)("user_courses")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();
      if (cancelled) return;
      if (enr) return;


      navigate({ to: "/pricing" });
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, user, isAdmin, loading, navigate]);

  return <Outlet />;
}
