import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./useAuth";
import { myFreeTalkBudget } from "@/lib/free-talk.functions";
import { voiceSecondsLeft, type VoiceTimeSnapshot } from "@/lib/free-talk-time";
export function useVoiceTime() {
  const { user } = useAuth();
  const fn = useServerFn(myFreeTalkBudget);
  const client = useQueryClient();
  const key = useMemo(() => ["free-talk-budget", user?.id ?? "anon"], [user?.id]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 15000,
    retry: 1,
  });
  const clock = useMemo(() => ({ start: performance.now(), snapshot: query.data }), [query.data]);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const receive = (event: Event) => {
      const value = (event as CustomEvent<VoiceTimeSnapshot | undefined>).detail;
      if (value) client.setQueryData(key, value);
      else void client.invalidateQueries({ queryKey: key });
    };
    window.addEventListener("uzyra-voice-time", receive);
    return () => window.removeEventListener("uzyra-voice-time", receive);
  }, [key, client]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void client.invalidateQueries({ queryKey: key });
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [key, client]);
  useEffect(() => {
    if (!query.data?.activeSessionId) return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [query.data?.activeSessionId]);
  const seconds = query.data
    ? voiceSecondsLeft(query.data, Math.max(0, now - clock.start))
    : undefined;
  return { ...query, seconds };
}
