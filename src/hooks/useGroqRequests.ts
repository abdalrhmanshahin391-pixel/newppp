import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./useAuth";
import { myGroqRequests } from "@/lib/free-talk.functions";

/**
 * The learner's Emith requests this month, as they were when the page loaded (like the call time:
 * read once, a new number after a reload).
 */
export function useGroqRequests() {
  const { user } = useAuth();
  const fn = useServerFn(myGroqRequests);
  const key = useMemo(() => ["groq-requests", user?.id ?? "anon"], [user?.id]);
  return useQuery({
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
}
