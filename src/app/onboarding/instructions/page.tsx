import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';

export const metadata = {
  title: 'How Grub Works · Grub',
  description: 'Learn how to plan meals together, shop once, and split fair.',
};

const STEPS = [
  { n: '01', title: 'Everyone picks', body: 'The house says what they fancy this week. Shared meals stack; nobody is signed up to a dinner they did not choose.' },
  { n: '02', title: 'One basket builds', body: 'At the cutoff the optimiser turns the plan into a single Tesco basket, own-brand where it saves.' },
  { n: '03', title: 'Split settles', body: 'The collector orders; everyone pays their real share back. The workings are printed under every line.' },
];

/**
 * Instructions page shown to new users after signup.
 *
 * Explains how Grub works so they understand the flow before creating a house.
 * Mandatory but skippable — users can skip to /onboarding if they prefer to learn as they go.
 */
export default function InstructionsPage() {
  return (
    <main className="min-h-screen flex flex-col justify-between px-margin-mobile py-xl max-w-md mx-auto">
      <div className="flex flex-col gap-xl">
        <div className="flex flex-col gap-sm pt-xl">
          <h1 className="font-georgia font-bold text-headline-lg-mobile text-primary">How Grub Works</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Three steps to splitting a shop fairly.
          </p>
        </div>

        <div className="flex flex-col gap-md">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.n}
              delay={i * 90}
              className="flex flex-col gap-xs p-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-ambient-card"
            >
              <span className="font-numeric-data text-secondary text-title-md">{step.n}</span>
              <h2 className="font-title-md text-title-md text-on-surface">{step.title}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-sm pt-xl">
        <Link
          href="/onboarding"
          className="w-full h-12 rounded-lg bg-secondary-container text-on-secondary font-title-md text-title-md flex items-center justify-center hover:bg-secondary transition-colors"
        >
          Let&apos;s go
        </Link>
        <Link
          href="/onboarding"
          className="w-full h-12 rounded-lg border border-primary text-primary font-title-md text-title-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          Skip
        </Link>
      </div>
    </main>
  );
}
