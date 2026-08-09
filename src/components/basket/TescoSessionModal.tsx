'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { importTescoSession } from '@/app/basket/tescoActions';

interface TescoSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionImported?: () => void;
  isAuthenticated: boolean;
  expiresAt?: string;
}

export function TescoSessionModal({
  isOpen,
  onClose,
  onSessionImported,
  isAuthenticated,
  expiresAt,
}: TescoSessionModalProps) {
  const [cookieInput, setCookieInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function handleImport() {
    if (!cookieInput.trim()) {
      setMessage('Please paste valid JSON cookie data.');
      setIsError(true);
      return;
    }

    startTransition(async () => {
      const res = await importTescoSession(cookieInput);
      if (res.status === 'error') {
        setMessage(res.message);
        setIsError(true);
      } else {
        setMessage(res.message);
        setIsError(false);
        setCookieInput('');
        if (onSessionImported) onSessionImported();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-md">
      <Card className="w-full max-w-lg flex flex-col gap-md bg-surface-container-lowest shadow-2xl">
        <div className="flex items-center justify-between gap-md border-b border-surface-container-highest pb-sm">
          <div className="flex items-center gap-xs">
            <Icon name="shopping_cart_checkout" className="text-primary text-[24px]" />
            <h2 className="font-title-md text-title-md">Tesco Session & Auth</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex flex-col gap-xs">
          <div className="flex items-center gap-xs">
            <span
              className={`w-3 h-3 rounded-full ${
                isAuthenticated ? 'bg-primary' : 'bg-secondary'
              }`}
            />
            <span className="font-body-lg text-body-lg font-semibold">
              {isAuthenticated ? 'Session Connected' : 'Session Required'}
            </span>
          </div>
          {isAuthenticated && expiresAt && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Expires: {new Date(expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        {message && (
          <div
            className={`p-sm rounded-lg text-body-sm font-body-sm ${
              isError
                ? 'bg-error-container text-on-error'
                : 'bg-primary-container text-on-primary-container'
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex flex-col gap-xs">
          <label htmlFor="cookieJson" className="font-label-caps text-label-caps text-on-surface-variant">
            Import Session Cookies (JSON)
          </label>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Log in to Tesco in your browser, export cookies using the Cookie-Editor extension, and paste the JSON below.
          </p>
          <textarea
            id="cookieJson"
            rows={5}
            value={cookieInput}
            onChange={(e) => setCookieInput(e.target.value)}
            placeholder='[{"name": "THS_SESSION", "value": "..."}, ...]'
            className="w-full p-sm rounded-lg bg-surface-container-low border border-surface-container-highest font-numeric-data text-[12px] focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end gap-sm pt-sm border-t border-surface-container-highest">
          <button
            type="button"
            onClick={onClose}
            className="px-md py-sm rounded-lg font-semibold text-body-sm text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isPending || !cookieInput.trim()}
            onClick={handleImport}
            className="px-md py-sm rounded-lg font-semibold text-body-sm bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Importing...' : 'Save Session'}
          </button>
        </div>
      </Card>
    </div>
  );
}
