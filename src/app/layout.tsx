import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { AppChrome } from '@/components/nav/AppChrome';
import { getCurrentUserOrNull, getRealUser } from '@/lib/queries';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Grub',
  description: 'Plan meals together, buy one shop, split it fairly.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Forest — the live primary. Was the retired #006b3f green.
  themeColor: '#1B4332',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Null when signed out — AppChrome then renders the page bare.
  const currentUser = isSupabaseConfigured ? await getCurrentUserOrNull() : null;

  // When the two disagree, the app is being rendered as a demo housemate and
  // every write lands as them. Say so on every page.
  const realUser = isSupabaseConfigured ? await getRealUser() : null;
  const viewingAsName =
    currentUser && realUser && currentUser.id !== realUser.id ? currentUser.name : null;

  return (
    <html
      lang="en-GB"
      className={`no-js ${jakarta.variable} ${jetbrains.variable}`}
      // The inline script below rewrites this class (no-js → js) before React
      // hydrates, so the server and client classNames intentionally differ.
      // This is the one attribute allowed to; nothing else here is suppressed.
      suppressHydrationWarning
    >
      <head>
        {/* Swap no-js → js before first paint, so the scroll-reveal styles
            (gated on html.js in globals.css) only ever hide content when the
            IntersectionObserver that reveals it is actually going to run.
            Without JS the class never flips and everything renders visible —
            which is what keeps the landing page crawlable and flash-free. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');",
          }}
        />
        {/* Material Symbols. The no-page-custom-font rule warns that fonts
            outside pages/_document.js load per-page — that is a Pages Router
            concern. This is the App Router root layout, so the tag is shared by
            every route already. Text fonts go through next/font above. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      {/* bg-surface-0, not bg-background: Surface Level 0 is the mint tint.
          A utility here beats any @layer base rule, so it must be set on the
          element rather than in globals.css. */}
      <body className="bg-surface-0 text-on-background font-body-lg text-body-lg antialiased min-h-screen selection:bg-primary selection:text-on-primary">
        <AppChrome currentUser={currentUser} viewingAsName={viewingAsName}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
