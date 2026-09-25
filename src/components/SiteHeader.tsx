import { ProHeader } from "@/components/home/procreate/ProHeader";

export { NAV_GROUPS } from "@/components/site-nav";
export type { NavItem, NavGroup } from "@/components/site-nav";

/**
 * One header for the whole site. The home page floats it over the artwork;
 * every other page gets the same bar on a solid cream strip.
 */
export function SiteHeader(_props: { variant?: "dark" | "light" } = {}) {
  void _props;
  return <ProHeader variant="solid" />;
}
