'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../../ask/page/poll';
import { everyFew, GITHUB_EVERY_MS, watchChanges } from './live';
import { readLiveGithub } from './live-github';
import { readPulse } from './source';

// The page refreshes itself (PRD 384, part 5): while the tab is visible, every 2 s through poll(), the
// browser reads the dossier's pulse as the signed-in person, and only when its signature moved asks the
// server to render the page again, in place (router.refresh()): the address, so the tab and a `?v=`
// picked by hand, and the scroll position stay. It renders nothing until three reads in a row fail.
// The demo has no database, and so no LiveRefresh.
// PRD 426: the signature also covers the stage and the open outbox count, asked of the server (never
// of GitHub) at most every GITHUB_EVERY_MS; a failed ask keeps the last answer and shows no problem.

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
    const stage = everyFew(() => readLiveGithub(id), GITHUB_EVERY_MS);
    return poll(watchChanges({
      initial: rendered.current,
      read: async () => {
        const [pulse, github] = await Promise.all([readPulse(db, id), stage()]);
        return pulse && github ? { ...pulse, github } : pulse;
      },
      onChange: () => router.refresh(),
      onProblem: setProblem,
    }), document);
  }, [supabase.url, supabase.key, id, router]);

  return problem ? <p className="ask-problem" role="alert">{problem}</p> : null;
}
