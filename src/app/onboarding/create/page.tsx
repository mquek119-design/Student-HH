import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { CreateHouseForm } from './CreateHouseForm';

export const metadata = { title: 'Create a House · HouseGrocer' };

export default function CreateHousePage() {
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
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Set up your house</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          You can change any of this later in House Settings.
        </p>
      </div>

      <CreateHouseForm />
    </main>
  );
}
