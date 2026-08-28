'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { Icon } from '@/components/media/Icon';
import { checkTescoSession, importTescoSession } from '@/app/basket/tescoActions';

export function TescoSessionPanel() {
  const [cookieInput, setCookieInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    checkTescoSession()
      .then((res) => {
        setIsAuthenticated(Boolean(res.authenticated));
        setExpiresAt(res.expiresAt);
      })
      .catch((err) => {
        console.error('Tesco session check failed:', err);
        setIsError(true);
        setMessage('Failed to check Tesco session status. Please try again later.');
      });
  }, []);

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
        setMessage('Tesco session imported');
        setIsError(false);
        setCookieInput('');
        checkTescoSession()
          .then((resCheck) => {
            setIsAuthenticated(Boolean(resCheck.authenticated));
            setExpiresAt(resCheck.expiresAt);
          })
          .catch((err) => {
            console.error('Tesco session refresh failed:', err);
            setMessage('Session imported, but failed to refresh status.');
            setIsError(true);
          });
      }
    });
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs border-b border-surface-container-highest pb-sm">
        <div className="flex items-center gap-xs">
          <Icon name="shopping_cart_checkout" className="text-primary text-[24px]" />
          <h3 className="font-body-lg text-body-lg font-semibold">Tesco Session & Authentication</h3>
        </div>
      </div>

      <div className="flex flex-col gap-xs">
        <div className="flex items-center gap-xs">
          <span className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-primary' : 'bg-secondary'}`} />
          <span className="font-body-md text-body-md font-semibold">
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
            isError ? 'bg-error-container text-on-error' : 'bg-primary-container text-on-primary-container'
          }`}
        >
          {message}
        </div>
      )}

      {/* Shown only on a narrow screen, and above the steps rather than below
          them: step one links to the Chrome Web Store, and a phone user who
          taps it discovers the constraint by failing at it. Not user-agent
          sniffing — a viewport wide enough to hide this is a browser that can
          run extensions. */}
      <Notice
        tone="check"
        icon="desktop_windows"
        title="This step needs a computer"
        className="md:hidden"
      >
        Exporting a Tesco session means logging in and running the Cookie-Editor extension, which
        mobile browsers cannot do. Open Grub on a laptop for the shop, then carry on from your
        phone — everything else works fine there.
      </Notice>

      <div className="bg-surface-container p-md rounded-lg flex flex-col gap-sm">
        <h4 className="font-body-md text-body-md font-semibold">Instructions for importing Tesco cookies:</h4>
        <ol className="list-decimal list-inside font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-xs">
          <li>
            Install the{' '}
            <a
              href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              Cookie-Editor browser extension
            </a>
            .
          </li>
          <li>Log into your Tesco account at <a href="https://www.tesco.com/groceries" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://www.tesco.com/groceries</a>.</li>
          <li>Click the Cookie-Editor icon on the Tesco page, select <strong>Export</strong> and click <strong>JSON</strong>.</li>
          <li>Paste the copied JSON string below and click <strong>Import Tesco Session</strong>.</li>
        </ol>
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="cookieJson-settings" className="font-label-caps text-label-caps text-on-surface-variant">
          Paste Cookies JSON
        </label>
        <textarea
          id="cookieJson-settings"
          rows={4}
          value={cookieInput}
          onChange={(e) => setCookieInput(e.target.value)}
          placeholder='[{"name": "...", "value": "..."}, ...]'
          className="p-sm rounded-lg bg-surface-container border border-surface-container-highest font-mono text-xs w-full focus:outline-none focus:border-primary resize-y"
        />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleImport}
        className="w-full h-11 rounded-lg bg-primary hover:opacity-90 text-on-primary font-semibold flex items-center justify-center gap-xs transition-opacity disabled:opacity-50"
      >
        <Icon name={isPending ? 'progress_activity' : 'key'} />
        {isPending ? 'Importing...' : 'Import Tesco Session'}
      </button>
    </Card>
  );
}
