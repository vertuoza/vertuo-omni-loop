'use client';
import { useMemo } from 'react';
import { ArcadeApp, type ArcadeProps } from './ArcadeApp';
import { demoAccount } from './account-demo';
import { supabaseAccount } from './account-supabase';

// The arcade as the Next page renders it: Supabase accounts when the project is configured, the
// browser-only demo account otherwise.
export function ArcadeClient({ supabase, ...props }: Omit<ArcadeProps, 'account'> & { supabase: { url: string; key: string } | null }) {
  const url = supabase?.url, key = supabase?.key;
  const account = useMemo(() => (url && key ? supabaseAccount({ url, key }) : demoAccount()), [url, key]);
  return <ArcadeApp {...props} account={account} />;
}
