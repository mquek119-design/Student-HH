import { clsx } from '@/lib/clsx';

interface IconProps {
  name: string;
  /** Material Symbols renders a solid glyph when FILL is 1. */
  filled?: boolean;
  className?: string;
}

export function Icon({ name, filled = false, className }: IconProps) {
  if (name.startsWith('ti-')) {
    return <i aria-hidden="true" className={clsx('ti', name, className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={clsx('material-symbols-outlined', filled && 'fill', className)}
    >
      {name}
    </span>
  );
}
