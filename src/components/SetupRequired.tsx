import { Icon } from '@/components/media/Icon';

/**
 * Shown when no Supabase credentials are present.
 *
 * The app no longer ships fixtures, so without a database there is genuinely
 * nothing to render. Better to say so plainly than to throw a stack trace or —
 * worse — invent a house to fill the screen.
 */

const STEPS = [
  {
    title: 'Create a Supabase project',
    body: 'supabase.com → New project. Any region; the free tier is fine.',
  },
  {
    title: 'Run the two migrations',
    body: 'SQL Editor → paste supabase/migrations/0001_initial_schema.sql, run it, then 0002_rls.sql.',
  },
  {
    title: 'Add your keys',
    body: 'Copy .env.example to .env.local, then fill in the Project URL and anon key from Settings → API.',
  },
  {
    title: 'Allow the magic-link redirect',
    body: 'Authentication → URL Configuration: set Site URL to http://localhost:3000 and add http://localhost:3000/auth/callback to Redirect URLs.',
  },
  {
    title: 'Restart the dev server',
    body: 'Environment variables are read at boot, so npm run dev needs a restart to pick them up.',
  },
];

export function SetupRequired() {
  return (
    <main className="min-h-screen flex flex-col justify-center px-margin-mobile py-xl max-w-lg mx-auto gap-lg">
      <div className="flex flex-col gap-sm">
        <span className="w-14 h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center">
          <Icon name="database" filled className="text-[28px]" />
        </span>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Connect a database</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          HouseGrocer has no demo data — it only ever shows your house&apos;s real shop. Point it at
          a Supabase project and it will come to life.
        </p>
      </div>

      <ol className="flex flex-col gap-md">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-md">
            <span className="w-8 h-8 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-numeric-data">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h2 className="font-title-md text-title-md">{step.title}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant break-words">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="font-body-sm text-body-sm text-on-surface-variant border-t border-surface-container-highest pt-md">
        Full detail, including two type-generation traps worth knowing about, is in{' '}
        <code className="font-numeric-data">CLAUDE.md</code>.
      </p>
    </main>
  );
}
