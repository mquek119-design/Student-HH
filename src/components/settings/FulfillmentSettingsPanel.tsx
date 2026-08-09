'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/media/Icon';
import type { House } from '@/lib/types';
import { updateFulfillmentSettings } from '@/app/settings/actions';

interface FulfillmentSettingsPanelProps {
  house: House;
}

export function FulfillmentSettingsPanel({ house }: FulfillmentSettingsPanelProps) {
  const [method, setMethod] = useState<'collect' | 'delivery'>(house.fulfillmentMethod);
  const [postcode, setPostcode] = useState(house.deliveryPostcode || '');
  const [collectStore, setCollectStore] = useState(house.clickCollectStore || 'coventry cannon park rear car park 1');
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  function handleSave() {
    setSaveStatus('Saving...');
    startTransition(async () => {
      try {
        const res = await updateFulfillmentSettings(method, postcode || null, collectStore);
        if (res.status === 'error') {
          setSaveStatus(`Error: ${res.message}`);
        } else {
          setSaveStatus('Fulfillment settings updated successfully!');
        }
      } catch (err: any) {
        setSaveStatus(`Error: ${err?.message || 'Failed to save settings'}`);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex flex-col">
        <h3 className="font-body-lg text-body-lg font-semibold">Tesco Fulfillment Settings</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Specify how Tesco orders are collected or delivered. This affects automated slot pricing calculation.
        </p>
      </div>

      <div className="flex gap-md">
        <label className="flex-1 flex items-center gap-xs cursor-pointer bg-surface-container hover:bg-surface-container-highest p-sm rounded-lg transition-colors border border-transparent has-[:checked]:border-primary">
          <input
            type="radio"
            name="fulfillment-method"
            value="collect"
            checked={method === 'collect'}
            onChange={() => setMethod('collect')}
            className="text-primary focus:ring-primary"
          />
          <span className="font-body-md text-body-md font-semibold ml-xs">Click + Collect</span>
        </label>
        <label className="flex-1 flex items-center gap-xs cursor-pointer bg-surface-container hover:bg-surface-container-highest p-sm rounded-lg transition-colors border border-transparent has-[:checked]:border-primary">
          <input
            type="radio"
            name="fulfillment-method"
            value="delivery"
            checked={method === 'delivery'}
            onChange={() => setMethod('delivery')}
            className="text-primary focus:ring-primary"
          />
          <span className="font-body-md text-body-md font-semibold ml-xs">Home Delivery</span>
        </label>
      </div>

      {method === 'collect' ? (
        <div className="flex flex-col gap-xs">
          <label htmlFor="collect-store-settings" className="font-label-caps text-label-caps text-on-surface-variant">
            Click & Collect Store
          </label>
          <input
            id="collect-store-settings"
            type="text"
            value={collectStore}
            onChange={(e) => setCollectStore(e.target.value)}
            placeholder="Enter postcode or store name"
            className="h-11 px-sm rounded-lg bg-surface-container border border-surface-container-highest text-on-surface font-body-md focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-xs">
          <label htmlFor="postcode-settings" className="font-label-caps text-label-caps text-on-surface-variant">
            Delivery Postcode
          </label>
          <input
            id="postcode-settings"
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="e.g. CV4 7AL"
            className="h-11 px-sm rounded-lg bg-surface-container border border-surface-container-highest text-on-surface font-body-md focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="w-full h-11 rounded-lg bg-primary hover:opacity-90 text-on-primary font-semibold flex items-center justify-center gap-xs transition-opacity disabled:opacity-50"
      >
        <Icon name={isPending ? 'progress_activity' : 'save'} />
        {isPending ? 'Saving...' : 'Save Fulfillment Settings'}
      </button>

      {saveStatus && (
        <p className={`font-body-sm text-body-sm font-semibold ${saveStatus.startsWith('Error') ? 'text-error' : 'text-primary'}`}>
          {saveStatus}
        </p>
      )}
    </Card>
  );
}
