import { clsx } from '@/lib/clsx';
import { Icon } from './Icon';

/**
 * Placeholder for product and recipe imagery.
 *
 * The mockups pointed at `lh3.googleusercontent.com/aida-public/…` URLs which
 * are temporary and will 404. Until real Tesco product images (or uploaded
 * recipe photos) are wired in, we render a deterministic tinted tile so the
 * layout keeps its intended weight and nothing depends on a dead host.
 */

const TINTS = [
  'bg-primary-fixed/60 text-on-primary-fixed',
  'bg-secondary-fixed/70 text-on-secondary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-[#cfe4ff] text-[#001d36]',
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

interface FoodImageProps {
  /** Real image when one exists; falls back to the tinted tile when null. */
  src?: string | null;
  alt: string;
  /** Stable seed for the tint — usually the recipe or product name. */
  seed: string;
  icon?: string;
  className?: string;
}

export function FoodImage({ src, alt, seed, icon = 'restaurant', className }: FoodImageProps) {
  if (src) {
    return (
       
      <img src={src} alt={alt} className={clsx('object-cover', className)} />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={clsx('flex items-center justify-center', tintFor(seed), className)}
    >
      <Icon name={icon} className="text-[50%] opacity-60" />
    </div>
  );
}
