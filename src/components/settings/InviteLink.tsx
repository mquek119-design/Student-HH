'use client';

import { useState } from 'react';
import { Icon } from '@/components/media/Icon';

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // origin is only available in the browser, so read it at click time.
    const link = `${window.location.origin}/onboarding/join?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the code is displayed below regardless.
    }
  }

  return (
    <div className="flex items-center gap-sm">
      <code className="flex-1 min-w-0 truncate px-md py-3 rounded-lg bg-surface-container-low font-numeric-data text-numeric-data tracking-wider">
        {inviteCode}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 px-md py-3 rounded-lg bg-primary text-on-primary font-semibold text-[14px] flex items-center gap-xs hover:opacity-90 transition-opacity"
      >
        <Icon name={copied ? 'check' : 'content_copy'} className="text-[18px]" />
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
