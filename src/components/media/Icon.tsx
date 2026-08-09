import { clsx } from '@/lib/clsx';

interface IconProps {
  name: string;
  /** Material Symbols renders a solid glyph when FILL is 1. */
  filled?: boolean;
  className?: string;
}

export function Icon({ name, filled = false, className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx('material-symbols-outlined', filled && 'fill', className)}
    >
      {name}
    </span>
  );
}
