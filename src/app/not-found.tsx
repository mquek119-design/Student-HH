import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { PageShell } from '@/components/ui/PageShell';

export default function NotFound() {
  return (
    <PageShell className="items-center text-center py-xl">
      <Icon name="search_off" className="text-[48px] text-outline" />
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Not found</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        That page does not exist, or it belongs to a different house.
      </p>
      <Link
        href="/"
        className="px-lg py-3 rounded-full bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
      >
        Back to the Feed
      </Link>
    </PageShell>
  );
}
