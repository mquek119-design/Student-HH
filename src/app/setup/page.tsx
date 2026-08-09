import { SetupRequired } from '@/components/SetupRequired';

export const metadata = { title: 'Connect a database · HouseGrocer' };

/**
 * Where middleware sends every request while Supabase is unconfigured.
 *
 * This has to be a real route rather than a branch inside the root layout: Next
 * renders the page component *before* handing it to the layout as `children`,
 * so a layout-level guard cannot stop a page from running its queries. The page
 * would still hit the database and throw.
 */
export default function SetupPage() {
  return <SetupRequired />;
}
