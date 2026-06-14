'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

interface CredentialResponse {
  credential?: string;
}

interface GoogleId {
  initialize: (config: {
    client_id: string;
    callback: (resp: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: () => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS failed to load'));
    document.head.appendChild(s);
  });
}

/**
 * Google One Tap sign-in. Renders the auto-prompt plus a fallback "Sign in with
 * Google" button. On credential, verifies + signs in via the `google-onetap`
 * NextAuth provider, then routes to the dashboard.
 */
export function GoogleOneTap({ clientId }: { clientId: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || initialized.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || initialized.current) return;
        const id = window.google?.accounts?.id;
        if (!id) return;
        initialized.current = true;

        id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          callback: async (resp) => {
            if (!resp.credential) return;
            setBusy(true);
            setError(null);
            const result = await signIn('google-onetap', {
              credential: resp.credential,
              redirect: false,
            });
            if (result?.error) {
              setError('Google sign-in failed. Please try again.');
              setBusy(false);
              return;
            }
            router.push('/dashboard');
            router.refresh();
          },
        });

        // One Tap auto-prompt…
        id.prompt();
        // …plus a visible button as a reliable fallback.
        if (buttonRef.current) {
          id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'center',
            width: 320,
          });
        }
      })
      .catch(() => setError('Could not load Google sign-in.'));

    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <div ref={buttonRef} className="flex justify-center" aria-busy={busy} />
      {busy && <p className="text-center text-xs text-muted-foreground">Signing you in…</p>}
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
