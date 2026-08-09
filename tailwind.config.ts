import type { Config } from 'tailwindcss';

/**
 * Tokens ported verbatim from mockups/housegrocer/DESIGN.md frontmatter.
 *
 * NOTE ON borderRadius: DESIGN.md's `rounded` block and the scale the mockup
 * HTML was actually rendered with disagree (DESIGN.md: DEFAULT 0.5rem / lg 1rem
 * / xl 1.5rem; the mockups: DEFAULT 0.25rem / lg 0.5rem / xl 0.75rem). Every
 * `code.html` ships the second scale, and the markup here is ported from those
 * files, so `rounded-xl` on a card must mean 12px. We follow the mockups.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f9f9fc',
        'surface-dim': '#dadadc',
        'surface-bright': '#f9f9fc',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f3f3f6',
        'surface-container': '#eeeef0',
        'surface-container-high': '#e8e8ea',
        'surface-container-highest': '#e2e2e5',
        'surface-variant': '#e2e2e5',
        'surface-tint': '#006d40',
        'on-surface': '#1a1c1e',
        'on-surface-variant': '#3e4a41',
        'inverse-surface': '#2f3133',
        'inverse-on-surface': '#f0f0f3',
        outline: '#6e7a70',
        'outline-variant': '#bdcabe',
        primary: '#006b3f',
        'on-primary': '#ffffff',
        'primary-container': '#008751',
        'on-primary-container': '#fdfff9',
        'inverse-primary': '#70db9d',
        'primary-fixed': '#8df8b7',
        'primary-fixed-dim': '#70db9d',
        'on-primary-fixed': '#002110',
        'on-primary-fixed-variant': '#00522f',
        secondary: '#994700',
        'on-secondary': '#ffffff',
        'secondary-container': '#fb7800',
        'on-secondary-container': '#592600',
        'secondary-fixed': '#ffdbc8',
        'secondary-fixed-dim': '#ffb68b',
        'on-secondary-fixed': '#321200',
        'on-secondary-fixed-variant': '#753400',
        tertiary: '#565f5c',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#6f7874',
        'on-tertiary-container': '#ffffff',
        'tertiary-fixed': '#dce5e0',
        'tertiary-fixed-dim': '#bfc9c4',
        'on-tertiary-fixed': '#151d1b',
        'on-tertiary-fixed-variant': '#404945',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        background: '#f9f9fc',
        'on-background': '#1a1c1e',
        // Surface Level 0 from DESIGN.md "Elevation & Depth". Distinct from the
        // `background` token, which the mockups define but then override on
        // <body> with this mint tint. Cards sit on top of this.
        'surface-0': '#f0f9f4',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        base: '4px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        gutter: '16px',
        'margin-mobile': '16px',
        'margin-desktop': '48px',
      },
      fontFamily: {
        'display-lg': ['var(--font-jakarta)', 'sans-serif'],
        'headline-lg': ['var(--font-jakarta)', 'sans-serif'],
        'headline-lg-mobile': ['var(--font-jakarta)', 'sans-serif'],
        'title-md': ['var(--font-jakarta)', 'sans-serif'],
        'body-lg': ['var(--font-jakarta)', 'sans-serif'],
        'body-sm': ['var(--font-jakarta)', 'sans-serif'],
        'label-caps': ['var(--font-jetbrains)', 'monospace'],
        'numeric-data': ['var(--font-jetbrains)', 'monospace'],
      },
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'title-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
        'numeric-data': ['14px', { lineHeight: '20px', fontWeight: '600' }],
      },
      boxShadow: {
        // Soft ambient shadows per DESIGN.md "Elevation & Depth"
        'ambient-card': '0px 4px 20px rgba(0, 0, 0, 0.05)',
        'ambient-modal': '0px 12px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
