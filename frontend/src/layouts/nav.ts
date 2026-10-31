export interface NavItem {
  path: string;
  label: string;
  description: string;
}

/** Dashboard pages, in sidebar order. Paths are relative to /dashboard. */
export const NAV_ITEMS: NavItem[] = [
  { path: "overview", label: "Overview", description: "Key metrics and trends at a glance" },
  { path: "audience", label: "Audience", description: "Who your visitors are and what they use" },
  { path: "acquisition", label: "Acquisition", description: "Where your traffic comes from" },
  { path: "content", label: "Content", description: "Which pages and events perform best" },
  { path: "geography", label: "Geography", description: "Where in the world your users are" },
  { path: "explore", label: "Explore", description: "Build a custom report" },
];

export const DEFAULT_PAGE = NAV_ITEMS[0].path;

/** True when `pathname` is one of the dashboard page routes (not a redirecting path). */
export function isPagePath(pathname: string): boolean {
  const normalised = pathname.replace(/\/+$/, "");
  return NAV_ITEMS.some((item) => normalised === `/dashboard/${item.path}`);
}
