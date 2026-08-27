import Link from 'next/link';
import { LoginForm } from './LoginForm';
import { LogoMark } from '@/components/brand/Logo';

export const metadata = { title: 'Sign in · Grub' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const errorMessage =
    searchParams.error === 'exchange_failed'
      ? 'That link has expired or was already used. Request a new one.'
      : searchParams.error === 'missing_code'
        ? 'That sign-in link was incomplete. Request a new one.'
        : null;

  return (
    <main className="min-h-screen flex flex-col justify-center px-margin-mobile py-xl max-w-md mx-auto gap-lg">
      <div className="flex flex-col gap-sm">
        <LogoMark className="h-16 w-auto" />
        <h1
          className="font-headline-lg text-headline-lg text-primary"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Grub
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Sign in with your email. We&apos;ll send you a link — no password to remember.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="px-md py-sm rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm"
        >
          {errorMessage}
        </p>
      )}

      <LoginForm next={searchParams.next ?? '/'} />

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        New to Grub?{' '}
        <Link href="/onboarding/signup" className="text-primary font-semibold hover:opacity-80">
          Sign up
        </Link>
      </p>
    </main>
  );
}
