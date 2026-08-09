import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { JoinHouseForm } from './JoinHouseForm';

export const metadata = { title: 'Join a House · HouseGrocer' };

export default function JoinHousePage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  return (
    <main className="min-h-screen flex flex-col px-margin-mobile py-lg max-w-md mx-auto gap-lg">
      <Link
        href="/onboarding"
        className="flex items-center gap-xs text-primary font-semibold text-[14px] w-fit hover:opacity-80"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Back
      </Link>

      <div className="flex flex-col gap-xs">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Join a house</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Ask a housemate for the invite code from their House Settings.
        </p>
      </div>

      <JoinHouseForm defaultCode={searchParams.code ?? ''} />
    </main>
  );
}
