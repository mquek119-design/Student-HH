import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

/**
 * A signposted way out of the week: Recipe Hub, Import a recipe.
 *
 * These sit directly under the savings banner because the recipe book moved off
 * this page, and a browser you cannot find is a browser nobody uses. A tinted
 * icon tile, a title, a line of explanation and a chevron — the same shape a
 * settings row has, which is what makes it read as "somewhere to go" rather
 * than "something to press".
 */
export function NavCard({
  href,
  icon,
  title,
  detail,
  tone = 'primary',
}: {
  href: string;
  icon: string;
  title: string;
  detail: string;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'group flex items-center gap-md p-md rounded-xl bg-surface-container-lowest',
        'border border-surface-container-highest shadow-ambient-card transition-all',
        'hover:border-primary/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0'
      )}
    >
      <span
        className={clsx(
          'w-11 h-11 rounded-lg flex items-center justify-center shrink-0',
          tone === 'primary'
            ? 'bg-primary-fixed text-on-primary-fixed'
            : 'bg-secondary-fixed text-on-secondary-fixed'
        )}
      >
        <Icon name={icon} className="text-[22px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-title-md text-title-md text-on-surface truncate">{title}</span>
        <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
          {detail}
        </span>
      </span>

      <Icon
        name="chevron_right"
        className="text-on-surface-variant shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
