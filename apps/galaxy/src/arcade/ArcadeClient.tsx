'use client';
import { useMemo } from 'react';
import { ArcadeApp, type ArcadeProps } from './ArcadeApp';
import { closedAccount } from './account-closed';
import { demoAccount } from './account-demo';
import { supabaseAccount } from './account-supabase';
import type { ArcadeMode } from '../data/mode';

// The arcade as the Next page renders it: Supabase accounts when the project is configured, the
// browser-only demo account when the build plays the demo, and no way in at all otherwise.
export function ArcadeClient({ mode, supabase, ...props }: Omit<ArcadeProps, 'account'> & {
  mode: ArcadeMode; supabase: { url: string; key: string } | null;
}) {
  const url = supabase?.url, key = supabase?.key;
  const account = useMemo(() => {
    if (mode === 'supabase' && url && key) return supabaseAccount({ url, key });
    return mode === 'demo' ? demoAccount() : closedAccount();
  }, [mode, url, key]);
  return <ArcadeApp {...props} account={account} />;
}
