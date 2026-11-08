import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { settingsSection } from "@/lib/settings";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: `Settings — ${BRAND_NAME}` },
      { name: "description", content: "Manage your profile, security, plan, usage and billing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    section: settingsSection(search.section),
  }),
  component: SettingsRoute,
});
function SettingsRoute() {
  const { section } = Route.useSearch();
  return <SettingsPage section={section} />;
}
