'use client';
import { useEffect, useMemo } from 'react';
import { markSeen } from '../../waiting/documents';
import { seenWatch } from './seen';

// The PRD page's seen part (PRD 579, s1): renders nothing; marks the dossier seen in this browser on
// mount and each time the rendered versions' signature changes (src/dossier/page/seen.ts).

export function MarkSeen({ id, signature }: { id: string; signature: string }) {
  const watch = useMemo(() => seenWatch(id, (dossier) => { markSeen(() => window.localStorage, dossier, Date.now()); }), [id]);
  useEffect(() => { watch(signature); }, [watch, signature]);
  return null;
}
