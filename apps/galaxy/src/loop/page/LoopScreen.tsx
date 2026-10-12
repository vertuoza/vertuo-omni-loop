import { cssVars } from '../../arcade/css-vars';
import { Notice } from '../../ask/page/Notice';
import { MemberGate } from '../../dashboard/MemberGate';
import { PersonChip } from '../../people/PersonChip';
import { LOOP_PATH, type LoopDetail, type LoopPageView, type LoopSummary, type PlanVersion } from './model';
import { prdHref, type LedgerLine } from './view';
import '../../dashboard/board/board.css';
import './loop.css';

// /app/loop in each situation (PRD 1139 s5), decided once by the page, as /app/engineering decides its
// own: closed, signed out and in no workspace through the shared gate; the list of the workspace's
// loops, or the empty state naming how to start one; one loop opened, with every version of its plan
// as a timeline per PRD, the latest open, its ledger (each tick naming the repositories its step
// touched, PRD 1162) and its parked PRDs. Every tick and every parked PRD links to its PRD's page.

type Supabase = { url: string; key: string };

export interface LoopScreenProps {
  view: LoopPageView;
  supabase: Supabase | null;
  signinError: string | null;
}

const DRIVE = '/loop /omni:drive';

function Closed() {
  return (
    <Notice title="The Loop page is not open here">
      <p className="ask-muted">This deployment has no database, so it has no loops to show.</p>
    </Notice>
  );
}

const prdsLine = (prds: readonly number[]) => prds.map((p) => `PRD ${p}`).join(', ');
const waitingLine = (n: number) => `${n} PRD${n === 1 ? ' waits' : 's wait'} on a person`;

function StateChip({ loop }: { loop: Pick<LoopSummary, 'state' | 'stateLine'> }) {
  return <span className={`loop-state is-${loop.state}`}>{loop.stateLine}</span>;
}

function Head({ loop }: { loop: LoopSummary }) {
  return (
    <div className="loop-head">
      <span className="loop-who"><PersonChip person={loop.who} size="inline" link={false} /> · {loop.repo}</span>
      <StateChip loop={loop} />
    </div>
  );
}

function Facts({ loop }: { loop: LoopSummary }) {
  return (
    <p className="loop-facts">
      {loop.lastTick ? `last tick ${loop.lastTick}` : 'no tick yet'} · driving {prdsLine(loop.prds)}
      {loop.waiting > 0 ? ` · ${waitingLine(loop.waiting)}` : null}
      {loop.state === 'silent' ? ` · run ${DRIVE} again to resume` : null}
    </p>
  );
}

function List({ name, loops }: { name: string; loops: readonly LoopSummary[] }) {
  return (
    <div className="dash">
      <h1 className="dash-name">{name}</h1>
      <p className="loop-lede">Every loop of the workspace: a session running <code>{DRIVE}</code>, one step of its plan per tick.</p>
      {loops.length === 0 ? (
        <div className="board-card loop-empty">
          <p>No loop has run in this workspace yet.</p>
          <p>Start one from a checkout with <code>{DRIVE}</code>: it builds your own PRDs, one step per tick, and shows here while it runs.</p>
        </div>
      ) : (
        <ul className="loop-list">
          {loops.map((loop) => (
            <li key={loop.id} className="board-card loop-card">
              <Head loop={loop} />
              <Facts loop={loop} />
              <p className="loop-open"><a href={loop.href}>Open this loop</a></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Timeline({ version, repo }: { version: PlanVersion; repo: string }) {
  if (version.plan.kind === 'unreadable') return <p className="loop-muted">This plan cannot be read here.</p>;
  if (version.steps === 0) return <p className="loop-muted">This plan has no step.</p>;
  const grid = cssVars({ '--loop-steps': version.steps });
  const collisions = version.rows.flatMap((row) => row.cells.filter((c) => c.collision).map((c) => ({ prd: row.prd, cell: c })));
  return (
    <>
      <ol className="loop-timeline" aria-label={`Plan v${version.version}, one row per PRD`}>
        {version.rows.map((row) => (
          <li key={row.prd} className="loop-row">
            <a className="loop-prd" href={prdHref(repo, row.prd)}>PRD {row.prd}</a>
            <ol className="loop-steps" style={grid}>
              {row.cells.map((cell) => (
                <li
                  key={cell.step}
                  className={['loop-step', cell.collision ? 'is-collision' : null, cell.beside ? 'is-beside' : null, cell.done ? 'is-done' : null, cell.current ? 'is-current' : null].filter(Boolean).join(' ')}
                  style={{ gridColumn: cell.step }}
                  title={cell.collision ?? undefined}
                >
                  <span className="loop-step-n">{cell.step}</span> {cell.label}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {collisions.length > 0 ? (
        <ul className="loop-collisions">
          {collisions.map(({ prd, cell }) => <li key={`${prd}-${cell.step}`}>Step {cell.step}: {cell.collision}</li>)}
        </ul>
      ) : null}
    </>
  );
}

function Versions({ versions, repo }: { versions: readonly PlanVersion[]; repo: string }) {
  if (versions.length === 0) return <p className="loop-muted">No plan yet.</p>;
  return (
    <>
      {versions.map((version, i) => (
        <details key={version.version} className="loop-version" data-version={version.version} open={i === 0}>
          <summary><b>v{version.version}</b> {version.reason} <span className="loop-muted">· {version.at} · {version.steps} steps</span></summary>
          <Timeline version={version} repo={repo} />
        </details>
      ))}
    </>
  );
}

function Line({ line }: { line: LedgerLine }) {
  if (line.kind === 'replan') return <li className="loop-line is-replan"><time>{line.at}</time> replanned v{line.version}: {line.reason}</li>;
  return (
    <li className="loop-line">
      <time>{line.at}</time> step {line.step}/{line.steps} · {line.action} · <a href={line.href}>PRD {line.prd}</a>
      {line.repos.length > 0 ? <span className="loop-repos"> · in {line.repos.join(', ')}</span> : null} → {line.result}
    </li>
  );
}

function Detail({ loop }: { loop: LoopDetail }) {
  const latest = loop.versions[0];
  return (
    <div className="dash">
      <p className="loop-back-row"><a className="loop-back" href={LOOP_PATH}>← Every loop</a></p>
      <h1 className="dash-name">{loop.repo}</h1>
      <div className="board loop">
        <section className="board-card loop-card">
          <Head loop={loop} />
          <Facts loop={loop} />
          {latest ? <p className="loop-facts">plan v{latest.version}{loop.current ? ` · step ${loop.current.step}/${loop.current.steps}` : ''}</p> : null}
        </section>
        <section className="board-card loop-plan">
          <h2>Plan</h2>
          <Versions versions={loop.versions} repo={loop.repo} />
        </section>
        <section className="board-card loop-ledger">
          <h2>Ledger</h2>
          {loop.ledger.length === 0 ? <p className="loop-muted">No tick yet.</p> : (
            <ol className="loop-lines">{loop.ledger.map((line, i) => <Line key={i} line={line} />)}</ol>
          )}
        </section>
        <section className="board-card loop-parked">
          <h2>Parked</h2>
          {loop.parked.length === 0 ? <p className="loop-muted">No PRD waits on a person.</p> : (
            <ul className="loop-lines">
              {loop.parked.map((p) => (
                <li key={p.prd} className="loop-line">
                  <a href={p.href}>PRD {p.prd}</a> waits on {p.who} for {p.what}
                  {p.link ? <> · <a href={p.link}>where to act</a></> : null} <span className="loop-muted">· since {p.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function LoopScreen({ view, supabase, signinError }: LoopScreenProps) {
  if (view.kind === 'closed' || view.kind === 'sign-in' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Loop page" supabase={supabase} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return <Notice title="Loop"><p className="ask-muted">The loops could not be read. Try again in a moment.</p></Notice>;
  }
  if (view.kind === 'list') return <List name={view.name} loops={view.loops} />;
  return <Detail loop={view.loop} />;
}
