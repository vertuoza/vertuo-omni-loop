'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../../ask/page/poll';
import { watchNewWork } from './live-refresh-watch';
import { readPulse } from './source';

// The page refreshes itself (PRD 384, part 5): while the tab is visible, every 2 s through poll(), the
// browser reads the dossier's pulse as the signed-in person, and asks the server to render the page
// again, in place (router.refresh()): the address, so the tab and a `?v=` picked by hand, and the
// scroll position stay. It renders nothing until three reads in a row fail. The demo has no database,
// and so no LiveRefresh.
// PRD 657, s10: it refreshes only when a new version or a new round appears (live-refresh-watch.ts),
// and no longer asks the server for the GitHub part (the stage, the open outbox count, the pending
// answers): a change there shows at the next load of the page.

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
    return poll(watchNewWork({
      initial: rendered.current,
      read: () => readPulse(db, id),
      onChange: () => router.refresh(),
      onProblem: setProblem,
    }), document);
  }, [supabase.url, supabase.key, id, router]);

  return problem ? <p className="ask-problem" role="alert">{problem}</p> : null;
}
