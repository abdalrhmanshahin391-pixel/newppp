import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { createActivityGate, PRESENCE_INTERVAL_MS } from "@/lib/idle-activity";

/**
 * Presence only after genuine interaction, at most every 30 minutes while
 * visible and active in the last 2 minutes. Hydration never writes. Mount once.
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
    const activity = createActivityGate();
    const onActivity = () => {
      if (document.hidden) return;
      activity.interact(Date.now());
      if (activeUserId) heartbeat(activeUserId);
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    function heartbeat(uid: string) {
      if (disposed || !activity.take(Date.now(), !document.hidden)) return;
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
      heartbeatTimer = setInterval(() => {
        heartbeat(uid);
      }, PRESENCE_INTERVAL_MS);
    }

    function stop() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      activeUserId = null;
      activity.reset();
    }

    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange((event, session) => {
        const uid = session?.user?.id;
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && uid) {
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
    };
  }, []);
}
