'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../../ask/page/poll';
import { PlayDock } from '../../play-dock/PlayDock';
import type { WorkingState } from '../../working/state';
import type { DockSetup } from './dock-player';
import { watchNewWork } from './live-refresh-watch';
import { readPulse } from './source';
import { readWorking, withWorking } from './working';

// The page refreshes itself (PRD 384, part 5): while the tab is visible, every 2 s through poll(), the
// browser reads the dossier's pulse as the signed-in person, and asks the server to render the page
// again, in place (router.refresh()): the address, so the tab and a `?v=` picked by hand, and the
// scroll position stay. It renders nothing until three reads in a row fail. The demo has no database,
// and so no LiveRefresh.
// PRD 657, s10: it refreshes only when a new version or a new round appears (live-refresh-watch.ts),
// and no longer asks the server for the GitHub part (the stage, the open outbox count, the pending
// answers): a change there shows at the next load of the page.
// PRD 757, s4: the same poll carries `working` (./working.ts): whether a terminal works on this
// dossier, asks on it, or neither. With `dock`, the play dock sits in the page's corner with that
// state: the pill while Claude works, the game paused on an open round, leading to the Questions tab.
// It starts idle, so nothing shows before the first read.

type Props = {
  supabase: { url: string; key: string };
  id: string;
  /** The signature the page was rendered with; null when it could not be told. */
  signature: string | null;
  /** The play dock's player and where its question button leads; none, no dock. */
  dock?: (DockSetup & { answerHref: string }) | null;
};

export function LiveRefresh({ supabase, id, signature, dock = null }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<WorkingState>('idle');
  const rendered = useRef(signature);
  const docked = dock !== null;

  useEffect(() => {
    const db = createBrowserClient(supabase.url, supabase.key);
    const pulse = () => readPulse(db, id);
    return poll(watchNewWork({
      initial: rendered.current,
      read: docked ? withWorking(pulse, (p) => readWorking(db, id, p), setWorking) : pulse,
      onChange: () => router.refresh(),
      onProblem: setProblem,
    }), document);
  }, [supabase.url, supabase.key, id, router, docked]);

  return (
    <>
      {problem && <p className="ask-problem" role="alert">{problem}</p>}
      {dock && (
        <PlayDock state={working} player={dock.player} hero={dock.hero} team={dock.team} answerHref={dock.answerHref}
          supabase={supabase} workspace={dock.workspace} />
      )}
    </>
  );
}
