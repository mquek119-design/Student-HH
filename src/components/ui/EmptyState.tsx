import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { Card } from './Card';

/**
 * What a screen shows when it genuinely has nothing yet.
 *
 * Always says why it is empty and what fills it, so an empty house never looks
 * like a broken app.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <Card className="flex flex-col items-center text-center gap-sm py-xl">
      <Icon name={icon} className="text-[40px] text-outline-variant" />
      <h2 className="font-title-md text-title-md text-on-surface">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-sm px-lg py-3 rounded-full bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
        >
          {action.label}
        </Link>
      )}
    </Card>
  );
}
