'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { stopViewingAs } from '@/app/dev/viewAsActions';

/**
 * You are not yourself right now.
 *
 * On every page, deliberately. Writes land as the housemate you are viewing —
 * joining a meal signs *them* up, logging a purchase spends *their* money — so
 * forgetting is not a small mistake, and a note tucked away on `/dev` would be
 * forgotten within one navigation.
 *
 * Tan rather than red: nothing is wrong, you just need to know.
 */
export function ViewAsBanner({ name }: { name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="fixed top-[72px] left-0 right-0 z-30 bg-secondary-fixed border-b border-secondary-container/50">
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-1.5 flex items-center justify-between gap-sm">
        <p className="flex items-center gap-xs min-w-0 font-body-sm text-[13px] text-on-secondary-fixed">
          <Icon name="visibility" className="text-[16px] shrink-0" />
          <span className="truncate">
            Viewing as <strong className="font-bold">{name}</strong> — anything you do saves as
            them.
          </span>
        </p>

        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => void (await stopViewingAs()))}
          className="shrink-0 px-sm h-7 rounded-full bg-on-secondary-fixed/10 text-on-secondary-fixed text-[12px] font-bold hover:bg-on-secondary-fixed/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-secondary-fixed"
        >
          {isPending ? '…' : 'Back to me'}
        </button>
      </div>
    </div>
  );
}
