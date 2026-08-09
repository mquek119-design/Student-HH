import Link from 'next/link';
import { Icon } from '@/components/media/Icon';

export const metadata = { title: 'Welcome · HouseGrocer' };

const BENEFITS = [
  {
    icon: 'groups',
    title: 'One shop, one order',
    body: 'Pool the house into a single basket that clears the £25 collection minimum.',
  },
  {
    icon: 'savings',
    title: 'Overlap cuts the bill',
    body: 'Meals that share ingredients get bought once, not four times.',
  },
  {
    icon: 'receipt_long',
    title: 'Split per item',
    body: "You pay for what you ate, not a quarter of someone else's protein powder.",
  },
];

export default function OnboardingWelcomePage() {
  return (
    <main className="min-h-screen flex flex-col justify-between px-margin-mobile py-xl max-w-md mx-auto">
      <div className="flex flex-col gap-xl">
        <div className="flex flex-col gap-sm pt-xl">
          <span className="w-14 h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center">
            <Icon name="shopping_basket" filled className="text-[28px]" />
          </span>
          <h1 className="font-headline-lg text-headline-lg text-primary">HouseGrocer</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Plan meals together, buy one shop, split it fairly.
          </p>
        </div>

        <ul className="flex flex-col gap-md">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-md">
              <span className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                <Icon name={benefit.icon} />
              </span>
              <div>
                <h2 className="font-title-md text-title-md">{benefit.title}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{benefit.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-sm pt-xl">
        <Link
          href="/onboarding/create"
          className="w-full h-12 rounded-lg bg-secondary-container text-on-primary font-title-md text-title-md flex items-center justify-center hover:bg-secondary transition-colors"
        >
          Create a House
        </Link>
        <Link
          href="/onboarding/join"
          className="w-full h-12 rounded-lg border border-primary text-primary font-title-md text-title-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          Join with a Code
        </Link>
      </div>
    </main>
  );
}
