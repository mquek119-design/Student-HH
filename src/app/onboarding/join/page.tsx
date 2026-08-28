import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { getCurrentUserOrNull } from '@/lib/queries';
import { JoinHouseForm } from './JoinHouseForm';

export const metadata = { title: 'Join a House · Grub' };

export const dynamic = 'force-dynamic';

export default async function JoinHousePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await getCurrentUserOrNull();
  const params = await searchParams;

  // If user is not authenticated, redirect to signup with the invite code preserved
  if (!user) {
    const code = params.code ?? '';
    const inviteUrl = code ? `/onboarding/join?code=${encodeURIComponent(code)}` : '/onboarding/join';
    redirect(`/onboarding/signup?next=${encodeURIComponent(inviteUrl)}`);
  }

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

      <JoinHouseForm defaultCode={params.code ?? ''} />
    </main>
  );
}
