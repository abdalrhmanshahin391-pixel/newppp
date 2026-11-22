import { ProHeader } from "@/components/home/procreate/ProHeader";

export { NAV_GROUPS } from "@/components/site-nav";
export type { NavItem, NavGroup } from "@/components/site-nav";

export function SiteHeader(_props: { variant?: "dark" | "light" } = {}) {
  void _props;
  return <ProHeader variant="solid" />;
}
