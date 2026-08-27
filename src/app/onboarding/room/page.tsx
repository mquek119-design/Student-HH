import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { RoomForm } from './RoomForm';

export const metadata = { title: 'Your Room · Grub' };

export default function RoomPage() {
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
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Where do you live?</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Add your room number or identifier so housemates can see it on split payments.
        </p>
      </div>

      <RoomForm />
    </main>
  );
}
