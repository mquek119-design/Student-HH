import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { Icon } from '@/components/media/Icon';
import { Reveal } from '@/components/motion/Reveal';
import { Marquee } from '@/components/motion/Marquee';
import { getCurrentUserOrNull } from '@/lib/queries';

export const metadata = {
  title: 'Grub — one house, one shop, split fair',
  description:
    'Plan meals together, buy one Tesco shop that clears the minimum, and split it per item — you pay for what you ate.',
};

// Dynamic page for auth state detection
export const dynamic = 'force-dynamic';

/**
 * The front door for all users.
 *
 * All users (signed-in and signed-out) land here. Content and CTAs adapt based
 * on auth state:
 * - Signed-out: "Sign up" and "Sign in with invite"
 * - Signed-in with house: "Go to your house" button
 * - Signed-in without house: "Finish setup" button
 *
 * The one surface in the app where big type and motion carry no risk, because
 * nothing here is a real house's data — every figure is a plain fact about how
 * Grub works (the £25 collection minimum), never an invented saving.
 *
 * Server component. The only client islands are <Reveal> and <Marquee>.
 */

const STRIP = [
  'One shop, not four',
  'Split per item',
  'Clears the £25 minimum',
  'Overlap cuts the bill',
  'Own-brand swaps',
  'Pay for what you ate',
];

const BENEFITS = [
  {
    icon: 'groups',
    title: 'One shop, one order',
    body: 'Pool the whole house into a single basket that clears the £25 collection minimum a solo student never hits.',
  },
  {
    icon: 'savings',
    title: 'Overlap cuts the bill',
    body: 'Two meals that share an onion buy one bag, not two. The optimiser reuses ingredients across the week so less is wasted and less is bought.',
  },
  {
    icon: 'receipt_long',
    title: 'Split per item, not evenly',
    body: "You pay for what you ate — not a flat quarter of someone else's protein powder. Every line shows its own arithmetic.",
  },
];

const STEPS = [
  { n: '01', title: 'Everyone picks', body: 'The house says what they fancy this week. Shared meals stack; nobody is signed up to a dinner they did not choose.' },
  { n: '02', title: 'One basket builds', body: 'At the cutoff the optimiser turns the plan into a single Tesco basket, own-brand where it saves.' },
  { n: '03', title: 'Split settles', body: 'The collector orders; everyone pays their real share back. The workings are printed under every line.' },
];

export default async function WelcomePage() {
  const currentUser = await getCurrentUserOrNull();
  const hasHouse = currentUser?.houseId ? true : false;

  // Determine header link based on auth state
  const headerLink = currentUser ? (
    <Link
      href="/account"
      className="font-body-sm text-body-sm font-semibold text-primary hover:opacity-80 transition-opacity"
    >
      Account
    </Link>
  ) : (
    <Link
      href="/login"
      className="font-body-sm text-body-sm font-semibold text-primary hover:opacity-80 transition-opacity"
    >
      Sign in
    </Link>
  );

  // Determine primary CTA based on auth state
  const primaryCta = currentUser ? (
    hasHouse ? (
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
      >
        Go to your house
        <Icon name="arrow_forward" className="text-[20px]" />
      </Link>
    ) : (
      <Link
        href="/onboarding"
        className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
      >
        Finish setup
        <Icon name="arrow_forward" className="text-[20px]" />
      </Link>
    )
  ) : (
    <Link
      href="/onboarding/signup"
      className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
    >
      Sign up
      <Icon name="arrow_forward" className="text-[20px]" />
    </Link>
  );

  // Secondary CTA (only for signed-out users)
  const secondaryCta = !currentUser && (
    <Link
      href="/onboarding/join"
      className="inline-flex items-center justify-center h-12 px-xl rounded-full border border-outline-variant text-on-surface-variant font-title-md text-title-md hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
    >
      Sign in with invite
    </Link>
  );

  // Closing CTA
  const closingCta = currentUser ? (
    hasHouse ? (
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        Go to your house
        <Icon name="arrow_forward" className="text-[20px]" />
      </Link>
    ) : (
      <Link
        href="/onboarding"
        className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        Finish setup
        <Icon name="arrow_forward" className="text-[20px]" />
      </Link>
    )
  ) : (
    <Link
      href="/onboarding/signup"
      className="inline-flex items-center justify-center gap-xs h-12 px-xl rounded-full bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
    >
      Sign up
      <Icon name="arrow_forward" className="text-[20px]" />
    </Link>
  );

  return (
    <main className="min-h-screen bg-surface-0 text-on-background overflow-x-hidden">
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="relative w-full pt-xl md:pt-[6rem] pb-[4rem]">
        <div className="px-margin-mobile md:px-margin-desktop mx-auto flex items-center justify-between animate-fade-in">
          <span className="inline-flex items-center gap-sm">
            <LogoMark className="h-9 w-auto" />
            <span className="font-georgia font-bold text-title-md text-primary">Grub</span>
          </span>
          {headerLink}
        </div>

        <div className="px-margin-mobile md:px-margin-desktop mx-auto pt-[3rem] md:pt-[5rem] max-w-3xl">
          <h1 className="font-georgia text-[2.75rem] leading-[1.05] md:text-[4.5rem] md:leading-[1.02] font-bold text-primary animate-fade-in-up">
            Stop buying four bags of pasta.
          </h1>
          <p
            className="mt-md md:mt-lg font-body-lg text-body-lg md:text-[1.35rem] md:leading-relaxed text-on-surface-variant max-w-xl animate-fade-in-up"
            style={{ animationDelay: '120ms' }}
          >
            One house, one shop, split fair. Plan meals together, buy a single
            order that actually clears the minimum, and pay for what you ate.
          </p>

          <div
            className="mt-xl flex flex-col sm:flex-row gap-sm animate-fade-in-up"
            style={{ animationDelay: '240ms' }}
          >
            {primaryCta}
            {secondaryCta}
          </div>
        </div>

        {/* A slow-drifting mark, decoration only, hidden on small screens. */}
        <span aria-hidden="true" className="hidden lg:block absolute right-8 top-[7rem] opacity-15 animate-float">
          <LogoMark className="h-40 w-auto" />
        </span>
      </section>

      {/* ---- Marquee ------------------------------------------------------- */}
      <Marquee className="border-y border-surface-container-highest bg-primary py-md">
        {STRIP.map((phrase) => (
          <span key={phrase} className="inline-flex items-center gap-md px-md">
            <span className="font-georgia text-title-md text-secondary">{phrase}</span>
            <Icon name="soup_kitchen" className="text-[18px] text-primary-fixed-dim" />
          </span>
        ))}
      </Marquee>

      {/* ---- Why Grub ------------------------------------------------------ */}
      <section className="px-margin-mobile md:px-margin-desktop py-[4rem] max-w-5xl mx-auto">
        <Reveal as="h2" className="font-georgia text-headline-lg-mobile md:text-headline-lg text-primary mb-lg">
          Why Grub
        </Reveal>
        <Reveal className="max-w-3xl">
          <p className="font-body-lg text-body-lg md:text-[1.1rem] md:leading-relaxed text-on-surface-variant">
            Every student house has the same conversation: four bags of pasta, nobody&apos;s sure who&apos;s paying for
            what, someone&apos;s cooking for one when they could be cooking for four. Grub is what we actually call
            dinner — not a &quot;meal solution,&quot; just grub — built so your house plans together, shops once, and
            splits it fair without the group chat argument. The mark is two shapes overlapping on purpose: your food is
            never really just your food when you live with other people.
          </p>
        </Reveal>
      </section>

      {/* ---- Benefits ------------------------------------------------------ */}
      <section className="px-margin-mobile md:px-margin-desktop py-[4rem] max-w-5xl mx-auto">
        <Reveal as="h2" className="font-georgia text-headline-lg-mobile md:text-headline-lg text-primary max-w-2xl">
          The buying unit is the household, not the student.
        </Reveal>
        <div className="mt-xl grid gap-md md:grid-cols-3">
          {BENEFITS.map((benefit, i) => (
            <Reveal
              key={benefit.title}
              delay={i * 90}
              className="flex flex-col gap-sm p-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-ambient-card"
            >
              <span className="w-11 h-11 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                <Icon name={benefit.icon} />
              </span>
              <h3 className="font-title-md text-title-md text-on-surface">{benefit.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{benefit.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- How it works -------------------------------------------------- */}
      <section className="px-margin-mobile md:px-margin-desktop py-[4rem] max-w-5xl mx-auto">
        <Reveal as="h2" className="font-georgia text-headline-lg-mobile md:text-headline-lg text-primary">
          How a week runs
        </Reveal>
        <div className="mt-xl grid gap-md md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90} className="flex flex-col gap-xs">
              <span className="font-numeric-data text-secondary text-title-md">{step.n}</span>
              <h3 className="font-title-md text-title-md text-on-surface">{step.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Closing CTA --------------------------------------------------- */}
      <section className="px-margin-mobile md:px-margin-desktop pb-[4rem] max-w-5xl mx-auto">
        <Reveal className="rounded-xl bg-primary text-on-primary p-xl md:p-[3rem] flex flex-col items-start gap-md">
          <h2 className="font-georgia text-headline-lg-mobile md:text-headline-lg text-secondary max-w-2xl">
            Get the house in before someone buys another four pints of milk.
          </h2>
          {closingCta}
        </Reveal>

        <p className="mt-xl text-center font-body-sm text-body-sm text-on-surface-variant">
          <span className="font-georgia text-primary">Grub</span> · one house, one shop, split fair
        </p>
      </section>
    </main>
  );
}
