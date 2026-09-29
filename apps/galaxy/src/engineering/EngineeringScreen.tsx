import { Notice } from '../ask/page/Notice';
import { MemberGate } from '../dashboard/MemberGate';
import type { Query } from '../dashboard/board/links';
import type { Period } from '../dashboard/board/period';
import { hrefWith } from '../dashboard/board/links';
import { EngineeringBoard, ENGINEERING_PATH } from './EngineeringBoard';
import type { EngineeringBoard as Loaded } from './load';

// /app/engineering in each situation (PRD 612 s3), decided once by the page, as /app/workspace decides
// its own: the demo and any member get the workspace's Engineering board, headed by the workspace's
// name; a deployment with no database says the board is not open here; signed out, only the sign-in
// card; signed in to an account in no workspace, the notice with a way to switch. A repository's page
// (PRD 645 s2) is the same screen, led by a link back to every repository and headed by its name.

type Supabase = { url: string; key: string };

export type EngineeringView = { kind: 'closed' } | { kind: 'sign-in' } | Loaded;

export interface EngineeringScreenProps {
  view: EngineeringView;
  period: Period;
  supabase: Supabase | null;
  signinError: string | null;
  query: Query;
}

function Closed() {
  return (
    <Notice title="The Engineering board is not open here">
      <p className="ask-muted">This deployment has no database, so it has no pull requests to count.</p>
    </Notice>
  );
}

export function EngineeringScreen({ view, period, supabase, signinError, query }: EngineeringScreenProps) {
  if (view.kind !== 'board') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Engineering board" supabase={supabase} signinError={signinError} />;
  }
  return (
    <div className="dash">
      {view.repo ? <p className="eng-back-row"><a className="eng-back" href={hrefWith(ENGINEERING_PATH, {}, { period })}>← All repositories</a></p> : null}
      <h1 className="dash-name">{view.repo ?? view.name}</h1>
      <EngineeringBoard board={view.board} period={period} query={query} repo={view.repo} />
    </div>
  );
}
