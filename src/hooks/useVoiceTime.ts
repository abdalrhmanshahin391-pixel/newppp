import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./useAuth";
import { myFreeTalkBudget } from "@/lib/free-talk.functions";
import { voiceSecondsLeft } from "@/lib/free-talk-time";

/**
 * The learner's voice time (calls and the whiteboard share it), as it was when the page loaded.
 * It is read once per page load and never counts down or refreshes by itself: a new number shows
 * only after the page is reloaded. The server still takes the time exactly; the page just does not
 * show it ticking.
 */
export function useVoiceTime() {
  const { user } = useAuth();
  const fn = useServerFn(myFreeTalkBudget);
  const key = useMemo(() => ["free-talk-budget", user?.id ?? "anon"], [user?.id]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
  const seconds = query.data ? voiceSecondsLeft(query.data, 0) : undefined;
  return { ...query, seconds };
}
