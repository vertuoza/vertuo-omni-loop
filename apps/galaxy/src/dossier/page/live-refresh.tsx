'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../../ask/page/poll';
import { watchChanges } from './live';
import { readPulse } from './source';

// The page refreshes itself (PRD 384, part 5): while the tab is visible, every 2 s through poll(), the
// browser reads the dossier's pulse as the signed-in person, and only when its signature moved asks the
// server to render the page again, in place (router.refresh()): the address, so the tab and a `?v=`
// picked by hand, and the scroll position stay. It renders nothing until three reads in a row fail.
// The demo has no database, and so no LiveRefresh.

type Props = {
  supabase: { url: string; key: string };
  id: string;
  /** The signature the page was rendered with; null when it could not be told. */
  signature: string | null;
};

export function LiveRefresh({ supabase, id, signature }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const rendered = useRef(signature);

  useEffect(() => {
    const db = createBrowserClient(supabase.url, supabase.key);
    return poll(watchChanges({
      initial: rendered.current,
      read: () => readPulse(db, id),
      onChange: () => router.refresh(),
      onProblem: setProblem,
    }), document);
  }, [supabase.url, supabase.key, id, router]);

  return problem ? <p className="ask-problem" role="alert">{problem}</p> : null;
}
