/**
 * The four primary tabs.
 *
 * Screens the mockups showed as their own tabs (Recipes, "Fancy?") live inside
 * these four instead: "Fancy?" is the top section of Plan, Recipes is reachable
 * from the Plan search/add flow. `owns` lists the route prefixes each tab is
 * responsible for, so deep routes still light up the right tab.
 */
export interface Tab {
  href: string;
  label: string;
  icon: string;
  owns: string[];
}

export const TABS: Tab[] = [
  {
    href: '/',
    label: 'Feed',
    icon: 'ti-home',
    owns: ['/'],
  },
  {
    href: '/plan',
    label: 'Plan',
    icon: 'ti-calendar',
    // Recipes and the pantry are entered from the planning flow.
    owns: ['/plan', '/recipes', '/pantry'],
  },
  {
    href: '/basket',
    label: 'Basket',
    icon: 'ti-shopping-cart',
    owns: ['/basket'],
  },
  {
    href: '/split',
    label: 'Split',
    icon: 'ti-receipt',
    owns: ['/split'],
  },
];

export function activeTabHref(pathname: string): string {
  // Longest prefix wins so /plan does not swallow a future /planning route.
  let best: { href: string; length: number } | null = null;

  for (const tab of TABS) {
    for (const prefix of tab.owns) {
      const matches =
        prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (matches && (best === null || prefix.length > best.length)) {
        best = { href: tab.href, length: prefix.length };
      }
    }
  }
  return best?.href ?? '/';
}
