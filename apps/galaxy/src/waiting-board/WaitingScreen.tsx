import type { IconName } from '@omni/design';
import { Icon, SegmentedControl } from '@omni/ui';
import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { supabaseEnv } from '../data/supabase-server';
import { MemberGate } from '../dashboard/MemberGate';
import { PersonChip } from '../people/PersonChip';
import { ProductFilter } from '../product-filter/ProductFilter';
import { EMPTY_BY_TAB, STALE_TITLE, staleSummary, TABS, UNREADABLE_BOARD, type BoardRow, type TabId, type Turn } from './board';
import type { WaitingView } from './waiting-board.controller';
import '../inbox/inbox.css';
import '../product-filter/product-filter.css';
import './waiting-board.css';

// PRD omni-loop-23 s7: the board is drawn as the Inbox's shared rows, not a table: Late (past the
// escalation limit) first, as a word, then Waiting; a Whose turn column of faces and names; the views as
// pills, the product filter and the stale line on the toolbar line.
//
// /app/waiting in each situation (PRD 2377 s3), decided once by the page, as /app/engineering decides its
// own: the demo and any member get the workspace's Waiting board, headed by Waiting and its tabs (Workspace, My PRDs, My reviews with its
// count), the product filter, the stale line, then the tab's waits, oldest first; a deployment
// with no database says the board is not open here; signed out, only the sign-in card; signed in to an
// account in no workspace, the notice with a way to switch; a read that failed says the page could not
// load. The board makes no script and no GitHub request.

export interface WaitingScreenProps {
  view: WaitingView;
  tab: TabId;
  signinError: string | null;
}

const SECTION_LABEL: Readonly<Record<TabId, string>> = { workspace: 'Every open wait', mine: 'Waits on your PRDs', reviews: 'Waits on you' };

function Closed() {
  return (
    <Notice title="The Waiting board is not open here">
      <p className="ask-muted">This deployment has no database, so it has no waits to show.</p>
    </Notice>
  );
}

function TurnCell({ row }: { row: BoardRow }) {
  if (row.turn.length === 0) return <span className="wait-anyone">{row.anyone}</span>;
  return (
    <ul className="wait-turn" aria-label="Whose turn">
      {row.turn.map((t: Turn) => (
        <li key={t.kind === 'team' ? `team:${t.name}` : `person:${t.person.login ?? t.person.name}`}>
          {t.kind === 'team' ? <span className="wait-team">{t.name}</span> : <PersonChip person={t.person} />}
        </li>
      ))}
    </ul>
  );
}

function Subject({ row }: { row: BoardRow }): ReactNode {
  const { prd, pr } = row;
  if (prd) {
    const label = `PRD ${prd.number}${prd.title ? ` · ${prd.title}` : ''}`;
    return prd.href ? <a href={prd.href}>{label}</a> : <span>{label}</span>;
  }
  return <span>{pr ? `Pull request ${pr.number}` : row.repo}</span>;
}

const KIND_ICON: Readonly<Record<BoardRow['kind'], IconName>> = { approval: 'check', review: 'prds', merge: 'roadmap', outbox: 'outbox', law: 'settings' };

function WaitRow({ row }: { row: BoardRow }) {
  return (
    <li className="inbox-r wait-r">
      <span className="inbox-r-anchor"><Icon name={KIND_ICON[row.kind]} /></span>
      <span className="inbox-r-main">
        <p className="inbox-r-title"><Subject row={row} /></p>
        <p className="inbox-r-line wait-what">{row.what}</p>
        <p className="inbox-r-quiet">
          {row.pr ? <a href={row.pr.href}>{`${row.pr.repo}#${row.pr.number}`}</a> : <span>{row.prd ? `${row.repo} · no pull request yet` : row.repo}</span>}
        </p>
      </span>
      <span className="wait-turn-col"><TurnCell row={row} /></span>
      <span className="inbox-r-end">
        <span className="wait-age">{row.age}</span>
        {row.overdue ? <span className="wait-late">Late</span> : null}
      </span>
    </li>
  );
}

/** One group of waits under its heading, with the column the turn sits in named at its end. */
function Group({ label, count, note, rows }: { label: string; count: number; note?: string; rows: BoardRow[] }) {
  return (
    <section className="inbox-group" aria-label={label}>
      <h3 className="inbox-group-head wait-group-head">
        <span>{label} <span className="wait-group-count">{count}</span>{note ? <span className="wait-group-note">{` · ${note}`}</span> : null}</span>
        <span className="wait-group-col">Whose turn</span>
      </h3>
      <ol className="wait-rows">{rows.map((row) => <WaitRow key={row.id} row={row} />)}</ol>
    </section>
  );
}

/** Late waits (past the escalation limit) first, then the rest, each oldest first as the board gave them. */
function Rows({ rows, tab }: { rows: BoardRow[]; tab: TabId }) {
  if (rows.length === 0) return <p className="dash-note">{EMPTY_BY_TAB[tab]}</p>;
  const late = rows.filter((row) => row.overdue);
  const waiting = rows.filter((row) => !row.overdue);
  return (
    <>
      {late.length > 0 ? <Group label="Late" count={late.length} note="more than 2 working days" rows={late} /> : null}
      {waiting.length > 0 ? <Group label="Waiting" count={waiting.length} rows={waiting} /> : null}
    </>
  );
}

function Views({ tab, reviews }: { tab: TabId; reviews: number }) {
  const options = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    href: `/app/waiting?tab=${t.id}`,
    ...(t.id === 'reviews' && reviews > 0 ? { count: String(reviews) } : {}),
  }));
  return <SegmentedControl label="Waiting views" variant="pills" options={options} value={tab} />;
}

export function WaitingScreen({ view, tab, signinError }: WaitingScreenProps) {
  if (view.kind === 'closed' || view.kind === 'sign-in' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Waiting board" supabase={supabaseEnv()} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return (
      <div className="dash" data-screen="waiting">
        <h1 className="dash-name">Waiting</h1>
        <p className="dash-note" role="alert">{UNREADABLE_BOARD}</p>
      </div>
    );
  }
  const stale = staleSummary(view.board.stale);
  return (
    <div className="dash wait-board" data-screen="waiting">
      <h2 className="dash-name">Waiting</h2>
      <div className="inbox-toolbar wait-toolbar">
        <Views tab={tab} reviews={view.board.reviews} />
        <div className="inbox-toolbar-end">
          {stale ? (
            <details className="wait-stale" role="status">
              <summary title={STALE_TITLE}>{stale}</summary>
              <ul className="wait-stale-list">{view.board.stale.map((repo) => <li key={repo}>{repo}</li>)}</ul>
            </details>
          ) : null}
          <ProductFilter filter={view.filter} unreadable={view.productsUnreadable} />
        </div>
      </div>
      <section className="wait-list" aria-label={SECTION_LABEL[tab]}>
        <Rows rows={view.board.rows} tab={tab} />
      </section>
    </div>
  );
}
