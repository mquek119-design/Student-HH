import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { AppChrome } from '@/components/nav/AppChrome';
import { getCurrentUserOrNull } from '@/lib/queries';
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
  title: 'HouseGrocer',
  description: 'Plan meals together, buy one shop, split it fairly.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#006b3f',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Null when signed out — AppChrome then renders the page bare.
  const currentUser = isSupabaseConfigured ? await getCurrentUserOrNull() : null;

  return (
    <html lang="en-GB" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <head>
        {/* Material Symbols. The no-page-custom-font rule warns that fonts
            outside pages/_document.js load per-page — that is a Pages Router
            concern. This is the App Router root layout, so the tag is shared by
            every route already. Text fonts go through next/font above. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      {/* bg-surface-0, not bg-background: Surface Level 0 is the mint tint.
          A utility here beats any @layer base rule, so it must be set on the
          element rather than in globals.css. */}
      <body className="bg-surface-0 text-on-background font-body-lg text-body-lg antialiased min-h-screen selection:bg-primary selection:text-on-primary">
        <AppChrome currentUser={currentUser}>{children}</AppChrome>
      </body>
    </html>
  );
}
