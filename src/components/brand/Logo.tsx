import { clsx } from '@/lib/clsx';

/**
 * The Grub mark: an oat disc offset behind a forest-green disc, with a serif
 * italic "g".
 *
 * Inline SVG rather than an image file so it stays crisp at every size, needs
 * no network request, and inherits the brand tokens — `#1B4332` (primary) and
 * `#D4A574` (secondary) are the same values in `tailwind.config.ts`.
 *
 * The offset disc is drawn first so the green sits on top, matching the
 * artwork: the oat should peek out on the right, never surround the green.
 */

const FOREST = '#1B4332';
const OAT = '#D4A574';
const CREAM = '#F7F5EF';

/**
 * `tone` exists because the app bar is forest green: the default mark's green
 * disc would disappear into it. On dark ground the discs invert to cream so the
 * two-disc identity stays legible.
 */
export type LogoTone = 'brand' | 'onDark';

export function LogoMark({
  className,
  title = 'Grub',
  tone = 'brand',
}: {
  className?: string;
  title?: string;
  tone?: LogoTone;
}) {
  const discBack = tone === 'onDark' ? OAT : OAT;
  const discFront = tone === 'onDark' ? CREAM : FOREST;
  const letter = tone === 'onDark' ? FOREST : CREAM;

  return (
    <svg
      viewBox="0 0 64 56"
      role="img"
      aria-label={title}
      className={clsx('shrink-0', className)}
    >
      {/* Oat disc, offset right. */}
      <circle cx="38" cy="28" r="24" fill={discBack} />
      {/* Front disc on top. */}
      <circle cx="26" cy="28" r="24" fill={discFront} />
      <text
        x="26"
        y="28"
        textAnchor="middle"
        dominantBaseline="central"
        fill={letter}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="30"
      >
        g
      </text>
    </svg>
  );
}

/**
 * Mark plus wordmark, for headers and anywhere the product needs naming.
 * `markOnly` covers tight spots where the name is already obvious from context.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
  tone = 'brand',
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  tone?: LogoTone;
}) {
  return (
    <span className={clsx('inline-flex items-center gap-sm', className)}>
      <LogoMark tone={tone} className={clsx('h-8 w-auto', markClassName)} />
      {showWordmark && (
        <span
          className={clsx(
            'font-bold tracking-tight select-none',
            tone === 'onDark' ? 'text-secondary' : 'text-primary',
            wordmarkClassName
          )}
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Grub
        </span>
      )}
    </span>
  );
}
