import { Notice } from '../../ask/page/Notice';
import { GithubSignInCard } from '../../ask/page/GithubSignInCard';
import { MemberGate } from '../../dashboard/MemberGate';
import { AnswerBox } from './AnswerBox';
import { GanttChart } from './GanttChart';
import { PrerequisitesPane } from './PrerequisitesPane';
import {
  ROADMAP_SKILL, ROADMAPS_PATH, type Demo, type HumanWorkCount, type HumanWorkEntry, type HumanWorkView, type ProductChoice, type QuestionView,
  type RoadmapDetail, type RoadmapPageView, type RoadmapSummary,
} from './model';
import '../../dashboard/board/board.css';
import './roadmap.css';

// /roadmaps in each situation (PRD 1162), decided once by the page: closed and in no workspace through
// the shared gate; the demo for a person signed out, under a sign-in card; the list of the workspace's
// roadmaps with its product filter, or the empty state naming how to write one; one roadmap opened,
// with its milestone, its Gantt, its human work by kind (PRD 1217), its open questions (an answer box
// for a `person` one) and its PRDs, each linking to its page. Each card counts its open human work by
// kind. One roadmap has two tabs (PRD 1218), picked by `?tab=` in the PRD page's tab style: Overview,
// all of the above, and Prerequisites (PrerequisitesPane.tsx).

type Supabase = { url: string; key: string };

export interface RoadmapsScreenProps {
  view: RoadmapPageView;
  supabase: Supabase | null;
  signinError: string | null;
}

const CALLBACK = `${ROADMAPS_PATH}/callback`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Closed() {
  return (
    <Notice title="Roadmaps are not open here">
      <p className="ask-muted">This deployment has no database, so it has no roadmaps to show.</p>
    </Notice>
  );
}

function DemoBanner({ demo, supabase, signinError }: { demo: Demo; supabase: Supabase | null; signinError: string | null }) {
  if (demo !== 'signed-out') return null;
  return supabase ? (
    <GithubSignInCard
      supabase={supabase}
      returnPath={CALLBACK}
      error={signinError}
      titleId="roadmaps-signin-title"
      title="Sign in to see your roadmaps"
      text="Below is a demo. Sign in with your GitHub account to see your workspace's roadmaps, and you come straight back here."
    />
  ) : null;
}

function Progress({ roadmap }: { roadmap: RoadmapSummary }) {
  return (
    <p className="roadmap-chips">
      {roadmap.product ? <span className="roadmap-chip is-product">{roadmap.product}</span> : null}
      <span className="roadmap-chip is-merged">{roadmap.merged} of {roadmap.total} merged</span>
      {roadmap.ready > 0 ? <span className="roadmap-chip is-ready">{plural(roadmap.ready, 'waits on your merge', 'wait on your merge')}</span> : null}
      {roadmap.target ? <span className="roadmap-chip">target {roadmap.target}</span> : null}
    </p>
  );
}

function Blocks({ roadmap }: { roadmap: RoadmapSummary }) {
  if (roadmap.blocks.length === 0) return <p className="roadmap-muted">Nothing blocks it now.</p>;
  return (
    <ul className="roadmap-blocks" aria-label="What blocks it now">
      {roadmap.blocks.map((line) => <li key={line}>{line}</li>)}
      {roadmap.moreBlocks > 0 ? <li className="roadmap-muted">and {roadmap.moreBlocks} more</li> : null}
    </ul>
  );
}

function WorkChips({ counts, className, label }: { counts: readonly HumanWorkCount[]; className: string; label: string }) {
  return (
    <p className={`roadmap-chips ${className}`} aria-label={label}>
      {counts.map((c) => <span key={c.kind} className={`roadmap-chip roadmap-work-chip is-${c.kind}${c.open === 0 ? ' is-none' : ''}`}>{c.label} {c.open}</span>)}
    </p>
  );
}

function WorkEntry({ entry }: { entry: HumanWorkEntry }) {
  return (
    <li className={`roadmap-work-entry is-${entry.kind}`}>
      <p>
        <span className="roadmap-muted">{entry.prdHref ? <><a href={entry.prdHref}>PRD {entry.prd}</a> · </> : null}{entry.repo}</span> {entry.text}
      </p>
      {entry.act ? <p className="roadmap-work-act">{entry.act}</p> : null}
      <WorkWhere entry={entry} />
    </li>
  );
}

/** When a done entry was settled, and where an entry is answered. */
function WorkWhere({ entry }: { entry: HumanWorkEntry }) {
  const parts = [
    entry.settled ? <span key="settled">{entry.label} · settled {entry.settled}</span> : null,
    entry.url ? <a key="url" href={entry.url}>{entry.settled ? 'where it was answered' : 'where it is answered'}</a> : null,
  ].filter((p) => p !== null);
  if (parts.length === 0) return null;
  return <p className="roadmap-muted">{parts.flatMap((p, i) => (i === 0 ? [p] : [' · ', p]))}</p>;
}

function HumanWork({ work }: { work: HumanWorkView }) {
  const none = work.open.length === 0 && work.done.length === 0;
  return (
    <section className="board-card roadmap-work">
      <h2>Human work</h2>
      {none ? <p className="roadmap-muted">No human work recorded yet.</p> : (
        <>
          <WorkChips counts={work.counts} className="roadmap-work-kinds" label="Open human work by kind" />
          {work.open.map((group) => (
            <div key={group.kind} className="roadmap-work-group">
              <h3 className={`roadmap-work-kind is-${group.kind}`}>{group.label}</h3>
              <ul className="roadmap-lines">{group.entries.map((e) => <WorkEntry key={e.key} entry={e} />)}</ul>
            </div>
          ))}
          {work.done.length > 0 ? (
            <details className="roadmap-work-done">
              <summary>Done ({work.done.length})</summary>
              <ul className="roadmap-lines">{work.done.map((e) => <WorkEntry key={e.key} entry={e} />)}</ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function Filter({ products }: { products: readonly ProductChoice[] }) {
  if (products.length <= 1) return null;
  return (
    <nav className="roadmap-filter" aria-label="Filter by product">
      {products.map((p) => (
        <a key={p.href} href={p.href} className={p.current ? 'roadmap-chip is-current' : 'roadmap-chip'} aria-current={p.current ? 'page' : undefined}>
          {p.label} <span className="roadmap-muted">{p.count}</span>
        </a>
      ))}
    </nav>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  return (
    <div className="board-card roadmap-empty">
      {filtered ? <p>No roadmap of this product yet.</p> : <p>No roadmap in this workspace yet.</p>}
      <p>
        Write one from a checkout with <code>{`${ROADMAP_SKILL} <source>`}</code> (<code>/omni:mega-roadmap</code> in a plan repository): it
        turns a plan into its PRDs and their order, and shows here once pushed.
      </p>
    </div>
  );
}

function List({ view }: { view: Extract<RoadmapPageView, { kind: 'list' }> }) {
  return (
    <div className="dash">
      <h1 className="dash-name">{view.name}</h1>
      <p className="roadmap-lede">Every roadmap of the workspace: a milestone, the PRDs that deliver it, and what blocks them now.</p>
      <Filter products={view.products} />
      {view.roadmaps.length === 0 ? <Empty filtered={view.filtered} /> : (
        <ul className="roadmap-list">
          {view.roadmaps.map((r) => (
            <li key={r.id} className="board-card roadmap-card">
              <h2 className="roadmap-title"><a href={r.href}>{r.title}</a></h2>
              <p className="roadmap-milestone">{r.milestone}</p>
              <Progress roadmap={r} />
              <Blocks roadmap={r} />
              {r.openWork.length > 0 ? <WorkChips counts={r.openWork} className="roadmap-work-counts" label="Open human work" /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Question({ q, roadmap }: { q: QuestionView; roadmap: RoadmapDetail }) {
  return (
    <li className={`roadmap-question is-${q.kind}`}>
      <p><b>{q.id}</b> {q.question} <span className="roadmap-muted">· blocks {q.blocks.join(', ') || 'nothing'}</span></p>
      {q.recommendation ? <p className="roadmap-muted">Recommended: {q.recommendation}{q.kind === 'default' ? ' (runs on it)' : null}</p> : null}
      {q.answer ? <p>Answered: {q.answer}</p> : null}
      {q.answerable ? <AnswerBox roadmap={roadmap.number} question={q.id} issueUrl={roadmap.issueUrl} /> : null}
    </li>
  );
}

function Tabs({ roadmap }: { roadmap: RoadmapDetail }) {
  return (
    <nav className="roadmap-tabs" aria-label="Roadmap">
      {roadmap.tabs.map((t) => (
        <a key={t.tab} className="roadmap-tab" href={t.href} aria-current={t.current ? 'page' : undefined}>
          {t.label}
          {t.badge !== null ? <small>{t.badge}</small> : null}
        </a>
      ))}
    </nav>
  );
}

function Detail({ roadmap }: { roadmap: RoadmapDetail }) {
  return (
    <div className="dash">
      <p className="roadmap-back-row"><a className="roadmap-back" href={ROADMAPS_PATH}>← Every roadmap</a></p>
      <h1 className="dash-name">{roadmap.title}</h1>
      <Tabs roadmap={roadmap} />
      {roadmap.tab === 'prerequisites' ? <PrerequisitesPane prerequisites={roadmap.prerequisites} roadmap={roadmap.id} /> : <Overview roadmap={roadmap} />}
    </div>
  );
}

function Overview({ roadmap }: { roadmap: RoadmapDetail }) {
  const { gantt } = roadmap;
  return (
    <div className="board roadmap">
      <section className="board-card roadmap-card">
        <p className="roadmap-milestone"><b>Milestone:</b> {roadmap.milestone}</p>
        <Progress roadmap={roadmap} />
        <p className="roadmap-muted">{roadmap.repo} · <a href={roadmap.issueUrl}>roadmap #{roadmap.number}</a>{roadmap.source ? <> · <a href={roadmap.source}>its source</a></> : null}</p>
        <Blocks roadmap={roadmap} />
      </section>
      <section className="board-card roadmap-plan">
        <h2>Gantt</h2>
        <GanttChart gantt={gantt} />
        <p className="roadmap-legend">
          {(['waiting', 'building', 'outbox', 'ready', 'merged', 'closed'] as const).map((s) => <span key={s} className={`roadmap-key is-${s}`}>{s === 'ready' ? 'waiting for merge' : s === 'closed' ? 'closed unmerged' : s}</span>)}
        </p>
        <p className="roadmap-muted">
          {gantt.dated
            ? 'Real dates once a PRD starts; dashed bars are projected from the median length of this roadmap\'s merged PRDs.'
            : 'No PRD has merged yet, so nothing is dated: each bar sits in its wave.'}
          {gantt.lanes ? ' Each bar has a lane per repository.' : null}
        </p>
      </section>
      <HumanWork work={roadmap.humanWork} />
      <section className="board-card roadmap-questions">
        <h2>Open questions</h2>
        {roadmap.questions.length === 0 ? <p className="roadmap-muted">No open question.</p> : (
          <ul className="roadmap-lines">{roadmap.questions.map((q) => <Question key={q.id} q={q} roadmap={roadmap} />)}</ul>
        )}
      </section>
      <section className="board-card roadmap-prds">
        <h2>PRDs</h2>
        <ol className="roadmap-lines">
          {gantt.rows.map((row) => (
            <li key={row.id} className="roadmap-line">
              <span className={`roadmap-key is-${row.state}`}>{row.stateLabel}</span> <b>{row.id}</b> <a href={row.href}>PRD {row.prd}</a> {row.title}
              <span className="roadmap-muted"> · wave {row.wave}{row.lanes.length > 0 ? ` · ${row.lanes.join(', ')}` : ''}{row.blockers.length > 0 ? ` · after ${row.blockers.join(', ')}` : ''}</span>
              {row.waitsOn ? <span className="roadmap-muted"> · {row.waitsOn.url ? <a href={row.waitsOn.url}>{row.waitsOn.label}</a> : row.waitsOn.label}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function RoadmapsScreen({ view, supabase, signinError }: RoadmapsScreenProps) {
  if (view.kind === 'closed' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="Roadmaps" supabase={supabase} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return <Notice title="Roadmaps"><p className="ask-muted">The roadmaps could not be read. Try again in a moment.</p></Notice>;
  }
  return (
    <>
      <DemoBanner demo={view.demo} supabase={supabase} signinError={signinError} />
      {view.kind === 'list' ? <List view={view} /> : <Detail roadmap={view.roadmap} />}
    </>
  );
}
