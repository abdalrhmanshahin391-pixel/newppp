import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";

/**
 * Tracks login events (one row per SIGNED_IN) and heartbeats a presence row
 * every 15 min (visible + active tabs only) while the user is signed in. Mount once at the root.
 *
 * IMPORTANT: never `await` inside the onAuthStateChange callback — doing so
 * can deadlock the Supabase auth client and stall every subsequent request
 * (login, queries, etc.). All DB writes are fire-and-forget.
 */
export function usePresence() {
  useEffect(() => {
    let disposed = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let activeUserId: string | null = null;
    let lastActivity = Date.now();
    let wasIdle = false;
    const onActivity = () => {
      const idleBefore = wasIdle || Date.now() - lastActivity > 5 * 60_000;
      lastActivity = Date.now();
      wasIdle = false;
      if (idleBefore && activeUserId && !document.hidden) heartbeat(activeUserId);
    };
    const onVisibility = () => {
      if (document.hidden) wasIdle = true;
      else onActivity();
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    function heartbeat(uid: string) {
      void supabase
        .from("user_sessions")
        .upsert({ user_id: uid, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" })
        .then(
          () => {},
          () => {},
        );
    }

    function start(uid: string) {
      if (disposed || activeUserId === uid) return;
      stop();
      activeUserId = uid;
      heartbeat(uid);
      // Only write while the tab is visible and the user interacted in the last
      // 5 minutes, so forgotten/idle tabs never keep the database awake.
      heartbeatTimer = setInterval(() => {
        if (document.hidden) return;
        if (Date.now() - lastActivity > 5 * 60_000) return;
        heartbeat(uid);
      }, 15 * 60_000);
    }

    function stop() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      activeUserId = null;
    }

    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange((event, session) => {
        const uid = session?.user?.id;
        if (event === "SIGNED_IN" && uid) {
          void supabase
            .from("user_login_events")
            .insert({ user_id: uid })
            .then(
              () => {},
              () => {},
            );
          start(uid);
        } else if (event === "SIGNED_OUT") {
          stop();
        } else if (event === "TOKEN_REFRESHED" && uid && uid !== activeUserId) {
          start(uid);
        }
      });
      sub = result.data;

      // On first mount, if a session already exists, start heartbeat.
      supabase.auth.getSession().then(
        ({ data }) => {
          const uid = data.session?.user?.id;
          if (uid) start(uid);
        },
        () => {},
      );
    } catch {
      /* Presence is optional when account services are unavailable. */
    }

    return () => {
      disposed = true;
      sub?.subscription.unsubscribe();
      stop();
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
