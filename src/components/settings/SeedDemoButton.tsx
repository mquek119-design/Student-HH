'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/media/Icon';
import { seedDemoData } from '@/app/settings/seedActions';

export function SeedDemoButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function handleSeed() {
    setStatus('Seeding data...');
    startTransition(async () => {
      try {
        const res = await seedDemoData();
        setStatus(res.message);
      } catch (err: any) {
        setStatus(`Error: ${err?.message || 'Failed to seed demo data'}`);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-sm">
      <div className="flex flex-col">
        <h3 className="font-body-lg text-body-lg font-semibold">Seed Demo Data</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Populate the database with 5 Asian recipes and 5 Western recipes to test basket and splits.
        </p>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSeed}
        className="w-full h-11 rounded-lg bg-secondary hover:opacity-90 text-on-secondary font-semibold flex items-center justify-center gap-xs transition-opacity disabled:opacity-50 mt-sm"
      >
        <Icon name={isPending ? 'progress_activity' : 'database'} />
        {isPending ? 'Seeding...' : 'Seed Asian & Western Recipes'}
      </button>

      {status && (
        <p className={`font-body-sm text-body-sm font-semibold ${status.startsWith('Error') ? 'text-error' : 'text-primary'}`}>
          {status}
        </p>
      )}
    </Card>
  );
}
