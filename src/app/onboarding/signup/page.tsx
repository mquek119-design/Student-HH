import { SignupForm } from './SignupForm';

export const metadata = {
  title: 'Sign up · Grub',
  description: 'Create your Grub account with your email.',
};

/**
 * Sign up page for new users.
 *
 * Sends a magic link to the user's email, which redirects to /onboarding/instructions
 * after auth succeeds. The form is the same as login but with a hardcoded redirect.
 */
export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col justify-between px-margin-mobile py-xl max-w-md mx-auto">
      <div className="flex flex-col gap-xl">
        <div className="flex flex-col gap-sm pt-xl">
          <h1 className="font-georgia font-bold text-headline-lg-mobile text-primary">Grub</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Create your account with your email.
          </p>
        </div>

        <SignupForm />
      </div>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        Already have an account?{' '}
        <a href="/login" className="text-primary font-semibold hover:opacity-80">
          Sign in
        </a>
      </p>
    </main>
  );
}
