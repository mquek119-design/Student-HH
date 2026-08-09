---
name: HouseGrocer
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#3e4a41'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#6e7a70'
  outline-variant: '#bdcabe'
  surface-tint: '#006d40'
  primary: '#006b3f'
  on-primary: '#ffffff'
  primary-container: '#008751'
  on-primary-container: '#fdfff9'
  inverse-primary: '#70db9d'
  secondary: '#994700'
  on-secondary: '#ffffff'
  secondary-container: '#fb7800'
  on-secondary-container: '#592600'
  tertiary: '#565f5c'
  on-tertiary: '#ffffff'
  tertiary-container: '#6f7874'
  on-tertiary-container: '#ffffff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#8df8b7'
  primary-fixed-dim: '#70db9d'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#00522f'
  secondary-fixed: '#ffdbc8'
  secondary-fixed-dim: '#ffb68b'
  on-secondary-fixed: '#321200'
  on-secondary-fixed-variant: '#753400'
  tertiary-fixed: '#dce5e0'
  tertiary-fixed-dim: '#bfc9c4'
  on-tertiary-fixed: '#151d1b'
  on-tertiary-fixed-variant: '#404945'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is built for a collaborative, student-centric ecosystem where productivity meets community. The brand personality is **dependable, energetic, and transparent**, aimed at reducing the friction of shared living through clear visual communication.

The design style is **Modern Corporate with a Playful Twist**. It utilizes the structural clarity of modern SaaS interfaces—heavy whitespace, systematic grids, and clear hierarchy—but softens the edges with high-energy accents and subtle tactile elements. The interface should feel like a helpful digital roommate: organized enough to manage finances, but friendly enough to share a meal with.

## Colors

The palette is rooted in a **Fresh Grocery Green** (`#008751`), providing a sense of growth and reliability. This is paired with a **Vibrant Clementine Orange** (`#FF7A00`) specifically reserved for high-priority calls to action and urgent notifications, ensuring they "pop" against the calmer green tones.

- **Primary**: Used for branding, success states, and primary navigation elements.
- **Secondary**: Used exclusively for action buttons, progress indicators approaching deadlines, and alerts.
- **Tertiary**: A soft mint tint used for large background surfaces and container fills to reduce visual fatigue.
- **Neutrals**: Deep charcoals for text to ensure high legibility, and cool grays for borders and secondary metadata.

## Typography

This design system uses **Plus Jakarta Sans** as the primary typeface. Its soft terminals and modern geometric construction provide a friendly but professional tone. 

To handle complex data such as split costs, quantities, and schedules, **JetBrains Mono** is introduced as a secondary functional font. Its monospaced nature ensures that columns of numbers align perfectly, making financial tables and "hours until cutoff" timers easy to scan at a glance. 

- Use **Display/Headline** levels for house names and major section headers.
- Use **Body-lg** for recipe instructions and house updates.
- Use **Label-caps** (JetBrains Mono) for status badges and table headers.

## Layout & Spacing

The system follows a **4px baseline grid** to ensure mathematical harmony between typography and UI elements.

- **Mobile-First Approach**: The layout is primarily a single-column fluid stack. Side margins are fixed at `16px`.
- **The Grid System**: For the "Days x Housemates" view, use a scrolling horizontal grid on mobile to maintain legibility. On desktop, this expands into a 12-column fluid grid.
- **Vertical Rhythm**: Use `16px` (md) for spacing between related items in a list and `32px` (xl) to separate distinct functional blocks or card groups.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Soft Ambient Shadows**. 

- **Surface Level 0**: Background (`#F0F9F4`).
- **Surface Level 1 (Cards)**: Pure white (`#FFFFFF`) with a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.05)) and a `1px` subtle border in a light gray.
- **Surface Level 2 (Modals/Popovers)**: White with a more pronounced shadow (0px 12px 32px rgba(0, 0, 0, 0.12)) to indicate temporary interaction.

Avoid heavy blacks for shadows; instead, use slightly tinted shadows (e.g., a dark green-gray tint) to keep the interface feeling "fresh."

## Shapes

The shape language is **Rounded**, reflecting a friendly and approachable community vibe. 

- Standard components (Inputs, Cards) use `0.5rem` (8px) corners.
- Large containers and instructional cards use `rounded-lg` (16px).
- Interactive elements like Buttons and "Housemate" chips use `rounded-xl` (24px) or full pill shapes to signify touch-friendliness.

## Components

### Cards
- **House Updates**: White background, 16px padding. Use a 4px left-border accent in Primary Green for general updates and Secondary Orange for urgent ones.
- **Recipes**: Feature an image at the top with a `0.5rem` top-only corner radius.

### Buttons & Actions
- **Primary Action**: Bold Orange (`#FF7A00`) background with White text. High-contrast and distinctive.
- **Secondary Action**: White background with Primary Green border and text.
- **Tab System**: Use a "Segmented Control" style for switching between Personal and House views. The active tab should have a white "pill" background sliding over a soft-gray track.

### Progress & Data
- **Cutoff Bar**: A thick track (8px height) using Primary Green. As the 'hours until cutoff' decreases below 6 hours, the bar color transitions to Secondary Orange.
- **Grid Lists**: For "Days x Housemates," use 40x40px circular avatars for housemates and monospaced labels for dates.

### Inputs & Selection
- **Fields**: Large touch targets (min-height 48px) with `0.5rem` rounding.
- **Checkboxes**: Use a custom square with `4px` rounding, filling with Primary Green and a white checkmark when active.