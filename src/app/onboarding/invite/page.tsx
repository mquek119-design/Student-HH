import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { InviteLink } from '@/components/settings/InviteLink';
import { getHouse } from '@/lib/queries';

export const metadata = { title: 'Invite Housemates · Grub' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  const house = await getHouse();

  return (
    <main className="min-h-screen flex flex-col justify-between px-margin-mobile py-xl max-w-md mx-auto gap-xl">
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col items-center text-center gap-sm pt-xl">
          <span className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center">
            <Icon name="check" className="text-[32px]" />
          </span>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Your house is ready</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Invite your housemates. You need at least two more people to clear the delivery
            minimum comfortably.
          </p>
        </div>

        <div className="flex flex-col gap-sm">
          <span className="font-body-sm text-body-sm font-semibold">Invite code</span>
          <InviteLink inviteCode={house.inviteCode} />
        </div>
      </div>

      <div className="flex flex-col gap-sm">
        <Link
          href="/"
          className="w-full h-12 rounded-lg bg-secondary-container text-on-secondary font-title-md text-title-md flex items-center justify-center hover:bg-secondary transition-colors"
        >
          Go to the Feed
        </Link>
        <Link
          href="/plan"
          className="w-full h-12 rounded-lg border border-primary text-primary font-title-md text-title-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          Start Planning
        </Link>
      </div>
    </main>
  );
}
