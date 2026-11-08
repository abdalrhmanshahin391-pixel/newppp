import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myPlanUsage, type PlanUsage } from "@/lib/plans.functions";
import { getMySubscription, getMySavedPaymentMethods } from "@/lib/subscription.functions";
import type { SettingsSection } from "@/lib/settings";

export function useSettingsData(userId: string | undefined, section: SettingsSection) {
  const planFn = useServerFn(myPlanUsage);
  const subscriptionFn = useServerFn(getMySubscription);
  const cardsFn = useServerFn(getMySavedPaymentMethods);
  const plan = useQuery({
    queryKey: ["my-plan-usage", userId ?? "anon"],
    queryFn: () => planFn({}) as Promise<PlanUsage>,
    enabled: !!userId && (section === "plan" || section === "usage"),
    staleTime: 60_000,
  });
  const subscription = useQuery({
    queryKey: ["my-subscription", userId],
    queryFn: () => subscriptionFn(),
    enabled: !!userId && (section === "plan" || section === "billing"),
    staleTime: 30_000,
  });
  const cards = useQuery({
    queryKey: ["my-payment-methods", userId],
    queryFn: () => cardsFn(),
    enabled: !!userId && section === "billing",
    staleTime: 30_000,
  });
  return { plan, subscription, cards };
}
export type SettingsData = ReturnType<typeof useSettingsData>;
