import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { supabaseEnv } from '../data/supabase-server';
import { MemberGate } from '../dashboard/MemberGate';
import { PersonChip } from '../people/PersonChip';
import { ProductFilter } from '../product-filter/ProductFilter';
import { EMPTY_BY_TAB, STALE_TITLE, staleSummary, TABS, UNREADABLE_BOARD, type BoardRow, type TabId, type Turn } from './board';
import type { WaitingView } from './waiting-board.controller';
import '../dashboard/board/board.css';
import '../product-filter/product-filter.css';
import './waiting-board.css';

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

function Rows({ rows, tab }: { rows: BoardRow[]; tab: TabId }) {
  if (rows.length === 0) return <p className="dash-note">{EMPTY_BY_TAB[tab]}</p>;
  return (
    <div className="board-scroll">
      <table className="board-table wait-table">
        <thead>
          <tr>
            <th scope="col">PRD</th>
            <th scope="col">Pull request</th>
            <th scope="col">Waits on</th>
            <th scope="col">Whose turn</th>
            <th scope="col" className="is-num">Waiting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.overdue ? 'is-overdue' : undefined}>
              <th scope="row" className="board-name"><Subject row={row} />{row.prd ? null : <span className="wait-sub">{row.repo}</span>}</th>
              <td>{row.pr ? <a href={row.pr.href}>{`${row.pr.repo}#${row.pr.number}`}</a> : <span className="wait-sub">none yet</span>}</td>
              <td className="wait-what">{row.what}</td>
              <td><TurnCell row={row} /></td>
              <td className="is-num wait-age">{row.age}{row.overdue ? <span className="wait-late"> · late</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tabs({ tab, reviews }: { tab: TabId; reviews: number }) {
  return (
    <nav className="wait-tabs" aria-label="Waiting views">
      {TABS.map((t) => (
        <a key={t.id} className="wait-tab" aria-current={t.id === tab ? 'page' : undefined} href={`/app/waiting?tab=${t.id}`}>{t.id === 'reviews' && reviews > 0 ? `${t.label} (${reviews})` : t.label}</a>
      ))}
    </nav>
  );
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
    <div className="dash" data-screen="waiting">
      <h1 className="dash-name">Waiting</h1>
      <Tabs tab={tab} reviews={view.board.reviews} />
      <ProductFilter filter={view.filter} unreadable={view.productsUnreadable} />
      {stale ? (
        <details className="wait-stale" role="status">
          <summary title={STALE_TITLE}>{stale}</summary>
          <ul className="wait-stale-list">{view.board.stale.map((repo) => <li key={repo}>{repo}</li>)}</ul>
        </details>
      ) : null}
      <section className="board-card" aria-label={SECTION_LABEL[tab]}>
        <Rows rows={view.board.rows} tab={tab} />
      </section>
    </div>
  );
}
