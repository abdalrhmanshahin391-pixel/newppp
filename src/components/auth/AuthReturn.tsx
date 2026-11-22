import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/legacy-client";

/**
 * Google sends people back to the home page. When a sign-in page asked to go somewhere after it,
 * that wish is kept for the trip and honoured here, once the account is really signed in.
 */
export function AuthReturn() {
  const router = useRouter();
  useEffect(() => {
    const destination = sessionStorage.getItem("rita-auth-next");
    if (!destination) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sessionStorage.removeItem("rita-auth-next");
      if (destination.startsWith("/") && !destination.startsWith("//")) {
        void router.navigate({ href: destination, replace: true });
      }
    });
  }, [router]);
  return null;
}
