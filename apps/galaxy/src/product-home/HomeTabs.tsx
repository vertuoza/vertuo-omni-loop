import Link from 'next/link';
import type { ReactNode } from 'react';
import { outboxTabPath } from '../dossier/page/history-at';
import { workPath } from '../dossier/page/work';
import { brainstormLine } from '../ideas/members/members';
import { boardPath, LANES } from '../ideas/model';
import { IDEAS } from '../ideas/words';
import type { HomeFix, HomeIdea, HomeQuestion, HomeRoadmap, ProductHome as Home } from './product-home.service';

// The product home's other tabs, drawn (PRD 1364 s10): each lists only the product's own. Ideas: each idea
// with its repository's board, its lane there, the PRD it became and its /omni:brainstorm line. Roadmap:
// each roadmap with its milestone and target date, opening /roadmaps/<id>. Bug fixes and Visual fixes:
// each fix opening its page. Questions: each outbox question waiting on a person, with its PRD, linking to
// where it is answered today, the PRD page's Outbox tab. Each tab says so when it has nothing.

export const EMPTY = {
  ideas: 'No idea carries this product yet. An idea takes its product when it is added to a board of the product’s repository.',
  roadmap: 'No roadmap carries this product yet.',
  bugs: 'No bug fix carries this product yet.',
  visual: 'No visual fix carries this product yet.',
  questions: 'No outbox question of the product’s PRDs waits on a person.',
} as const;

/** An idea's lane as its board names it: Now, Next or Later; a lane no board has, as stored. */
function laneWord(lane: string): string {
  const known = LANES.find((l) => l === lane);
  return known === undefined ? lane : IDEAS.lanes[known];
}
const day = (iso: string) => iso.slice(0, 10);

function List({ label, empty, children }: { label: string; empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="products-empty">{empty}</p>;
  return <section className="products-list product-home-lane" aria-label={label}><ul>{children}</ul></section>;
}

/** One row: a leading mark, a title and its meta, and one word at the end. */
function Row({ mark, title, meta, end, data }: { mark: ReactNode; title: ReactNode; meta: ReactNode; end: ReactNode; data: string }) {
  return (
    <li className="product-home-row" data-row={data}>
      <span className="product-home-n">{mark}</span>
      <span className="product-home-main">
        {title}
        <span className="product-home-meta">{meta}</span>
      </span>
      <span className="product-home-state">{end}</span>
    </li>
  );
}

function Idea({ idea }: { idea: HomeIdea }) {
  return (
    <Row
      data="idea"
      mark="idea"
      title={<Link className="product-home-title" href={boardPath(idea.repo)}>{idea.title}</Link>}
      meta={(
        <>
          <span className="products-chip">{idea.repo}</span>
          {idea.prd === null ? null : <span className="products-chip">PRD {idea.prd}</span>}
          <span className="product-home-question">{idea.pitch}</span>
          <code className="product-home-line">{brainstormLine(idea)}</code>
        </>
      )}
      end={laneWord(idea.lane)}
    />
  );
}

function Roadmap({ roadmap }: { roadmap: HomeRoadmap }) {
  return (
    <Row
      data="roadmap"
      mark={roadmap.number}
      title={<Link className="product-home-title" href={`/roadmaps/${encodeURIComponent(roadmap.id)}`}>{roadmap.title}</Link>}
      meta={<><span className="products-chip">{roadmap.repo}</span><span className="product-home-question">{roadmap.milestone}</span></>}
      end={roadmap.targetDate ?? 'no date'}
    />
  );
}

function Fix({ fix, kind }: { fix: HomeFix; kind: 'bug' | 'visual' }) {
  return (
    <Row
      data={kind}
      mark={kind === 'bug' ? 'bug' : 'vis'}
      title={<Link className="product-home-title" href={workPath(kind, fix.dossier)}>{fix.title}</Link>}
      meta={<span className="products-chip">{fix.repo}</span>}
      end={day(fix.created)}
    />
  );
}

function Question({ q }: { q: HomeQuestion }) {
  return (
    <Row
      data="question"
      mark={q.prd}
      title={<span className="product-home-title">{q.question}</span>}
      meta={(
        <>
          <span className="products-chip">{q.repo}</span>
          <span>{q.title}</span>
          <Link href={outboxTabPath(q.dossier)}>Answer on its Outbox tab →</Link>
        </>
      )}
      end={q.rank}
    />
  );
}

export const IdeasTab = ({ home }: { home: Home }) => (
  <List label={`${home.product.name}'s ideas`} empty={EMPTY.ideas}>{home.ideas.map((i) => <Idea key={i.id} idea={i} />)}</List>
);

export const RoadmapTab = ({ home }: { home: Home }) => (
  <List label={`${home.product.name}'s roadmaps`} empty={EMPTY.roadmap}>{home.roadmaps.map((r) => <Roadmap key={r.id} roadmap={r} />)}</List>
);

export const BugsTab = ({ home }: { home: Home }) => (
  <List label={`${home.product.name}'s bug fixes`} empty={EMPTY.bugs}>{home.bugs.map((f) => <Fix key={f.dossier} fix={f} kind="bug" />)}</List>
);

export const VisualTab = ({ home }: { home: Home }) => (
  <List label={`${home.product.name}'s visual fixes`} empty={EMPTY.visual}>{home.visuals.map((f) => <Fix key={f.dossier} fix={f} kind="visual" />)}</List>
);

export const QuestionsTab = ({ home }: { home: Home }) => (
  <List label={`${home.product.name}'s questions`} empty={EMPTY.questions}>
    {home.questions.map((q) => <Question key={`${q.dossier}:${q.id}`} q={q} />)}
  </List>
);
