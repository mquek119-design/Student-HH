'use client';

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

/**
 * Reveals its children when they scroll into view.
 *
 * The hiding is done in CSS, gated on `html.js` (see globals.css) — so this
 * component only ever adds the `is-visible` flag. That split is deliberate:
 * the initial hidden state ships in the stylesheet, before this island
 * hydrates, so there is no frame where content shows and then jumps away. And
 * because the hide is gated on `.js`, a reader with no JavaScript sees the
 * content plainly rather than a blank page.
 *
 * Fires once — a section does not re-hide when you scroll back up. The observer
 * is disconnected the moment it has done its job.
 *
 * Motion itself is the stylesheet's business too: under `prefers-reduced-motion`
 * the reveal is neutralised there, so this component needs no branch for it.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className,
  /** Fraction of the element that must be visible before it reveals. */
  threshold = 0.15,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Milliseconds. Stagger a row of cards by passing 60, 120, 180… */
  delay?: number;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No observer (old browser, SSR shell that never hydrated a real one): show
    // it rather than risk leaving content hidden.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={clsx(visible && 'is-visible', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
