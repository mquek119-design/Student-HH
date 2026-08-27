import { clsx } from '@/lib/clsx';
import type { User } from '@/lib/types';

/**
 * The mockups used Google-hosted photo URLs that will rot, so housemates render
 * as coloured initials from the DESIGN.md palette. `avatarUrl` is honoured when
 * a real upload exists.
 */
const ACCENT_CLASSES: Record<User['accent'], string> = {
  green: 'bg-[#D8F3DC] text-[#1B4332]',
  orange: 'bg-[#FDECD0] text-[#7C4A1E]',
  blue: 'bg-[#cfe4ff] text-[#001d36]',
  purple: 'bg-[#e6ddff] text-[#22005d]',
};

const SIZE_CLASSES = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-8 h-8 text-[12px]',
  md: 'w-10 h-10 text-[14px]',
  lg: 'w-16 h-16 text-[22px]',
  xl: 'w-24 h-24 text-[32px]',
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;

interface AvatarProps {
  user: Pick<User, 'name' | 'accent' | 'avatarUrl'>;
  size?: AvatarSize;
  className?: string;
  /** Ring drawn around the circle — used to mark "you" or a meal group. */
  ring?: 'none' | 'primary' | 'secondary' | 'error' | 'surface';
}

const RING_CLASSES = {
  none: '',
  primary: 'ring-2 ring-primary',
  secondary: 'ring-2 ring-secondary-container',
  error: 'ring-2 ring-error',
  surface: 'ring-2 ring-surface-container-lowest',
} as const;

export function Avatar({ user, size = 'md', className, ring = 'none' }: AvatarProps) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-bold shrink-0 overflow-hidden select-none',
        SIZE_CLASSES[size],
        RING_CLASSES[ring],
        !user.avatarUrl && ACCENT_CLASSES[user.accent],
        className
      )}
      title={user.name}
    >
      {user.avatarUrl ? (
         
        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

interface AvatarStackProps {
  users: Pick<User, 'name' | 'accent' | 'avatarUrl'>[];
  size?: AvatarSize;
  className?: string;
  dimmed?: boolean;
}

export function AvatarStack({ users, size = 'sm', className, dimmed }: AvatarStackProps) {
  return (
    <span className={clsx('flex -space-x-2', dimmed && 'opacity-50', className)}>
      {users.map((user) => (
        <Avatar key={user.name} user={user} size={size} ring="surface" />
      ))}
    </span>
  );
}
