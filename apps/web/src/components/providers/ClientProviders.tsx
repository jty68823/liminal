'use client';

import { useEffect, useState, useCallback } from 'react';
import { ToastContainer } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { BootScreen } from '@/components/ui/BootScreen';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Connecting');

  // Check if we've already shown boot animation this session
  const [skipBoot] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('liminal_booted') === '1';
  });

  const handleBootComplete = useCallback(() => {
    setBooting(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('liminal_booted', '1');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function waitForApi() {
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        if (cancelled) return;
        try {
          const resp = await fetch('/api/v1/health', { signal: AbortSignal.timeout(2000) });
          if (resp.ok) {
            if (!cancelled) setLoading(false);
            return;
          }
        } catch {
          // not ready yet
        }
        if (i === 2) setMessage('Connecting to API');
        if (i === 8) setMessage('Loading models');
        await new Promise(r => setTimeout(r, 1000));
      }
      // Timeout — show app anyway
      if (!cancelled) setLoading(false);
    }

    waitForApi();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <BootScreen onComplete={handleBootComplete} skip={skipBoot} />
      {!booting && <LoadingScreen visible={loading} message={message} />}
      {children}
      <ToastContainer />
    </>
  );
}
