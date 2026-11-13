import Link from 'next/link';
import type { Query } from '../../../nav/query';
import { Section } from '../../KnowledgeLists';
import { NONE, dayOf, excerpt, sectionHref, type DomainChoice } from '../../knowledge-sections';
import { categoryLabel } from '../categories/categories-stats';
import { percent } from '../search-stats';
import { AddAnswer, AddQuestion, AnswerButton, RemoveQuestion } from './EvalControls';
import {
  NO_QUESTION, NO_RUN, SERIES, addedByOf, byOf, categoriesOfRuns, missTextOf, openCategoryOf, seriesOf, setOf,
  type EvalAnswer, type EvalQuestion, type EvalRun, type Measures, type SetQuestion,
} from './eval-stats';

// The Search section's Eval view, drawn (PRD omni-loop-8 s5): top@1, top@5, recall@5 and recall@10 over time, one
// point per run, overall or for the category ?category= names; the latest run's misses; the set, each question with
// its right answers marked Jev or person, and the controls a member fixes them with (EvalControls.tsx). With no run
// yet it says so in one line and draws no chart; the set is shown all the same. Drawn from eval-stats.ts;
// EvalSection.tsx reads the rows.

export const EVAL_TITLE = 'Search eval';
export const EVAL_LEDE = 'Whether search finds the right entry for the questions agents ask most, measured on a set of questions whose right answers Jev proposes and a person can fix. A person’s word wins and is kept.';

const evalHref = (product: string): string => `${sectionHref(product, 'search')}/eval`;

const viewHref = (product: string, category: string | null): string =>
  category === null ? evalHref(product) : `${evalHref(product)}?category=${encodeURIComponent(category)}`;

/** The Search section's three views, the one shown marked: its overview, its categories and its eval. */
export function SearchViews({ product, shown }: { product: string; shown: 'overview' | 'categories' | 'eval' }) {
  const views: [string, string, boolean][] = [
    ['Overview', sectionHref(product, 'search'), shown === 'overview'],
    ['Categories', `${sectionHref(product, 'search')}/categories`, shown === 'categories'],
    ['Eval', evalHref(product), shown === 'eval'],
  ];
  return (
    <nav className="kn-filters kn-views" aria-label="Search views">
      {views.map(([label, href, current]) => <Link key={label} href={href} aria-current={current ? 'true' : undefined}>{label}</Link>)}
    </nav>
  );
}

function Categories({ product, runs, open, domains }: { product: string; runs: readonly EvalRun[]; open: string | null; domains: readonly DomainChoice[] }) {
  const names = categoriesOfRuns(runs);
  if (names.length === 0) return null;
  return (
    <nav className="kn-filters" aria-label="Category">
      <Link href={viewHref(product, null)} aria-current={open === null ? 'true' : undefined}>All categories</Link>
      {names.map((name) => <Link key={name} href={viewHref(product, name)} aria-current={name === open ? 'true' : undefined}>{categoryLabel(name, domains)}</Link>)}
    </nav>
  );
}

function Figures({ measures }: { measures: Measures }) {
  const figures: [string, string, string][] = [
    ...SERIES.map((s): [string, string, string] => [s.key, s.label, percent(measures[s.key])]),
    ['mrr', 'Mean reciprocal rank', measures.mrr.toFixed(2)],
    ['questions', 'Questions measured', String(measures.questions)],
  ];
  return (
    <dl className="kn-figures">
      {figures.map(([key, label, value]) => <div key={key} data-figure={key}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

const W = 600;
const H = 100;

function Chart({ points, scope }: { points: readonly { at: string; measures: Measures }[]; scope: string }) {
  const n = points.length;
  const x = (i: number): number => ((i + 0.5) * W) / n;
  const y = (v: number): number => H - v * H;
  const first = dayOf(points[0]?.at ?? '');
  const last = dayOf(points[n - 1]?.at ?? '');
  return (
    <figure className="kn-chart" data-chart="runs">
      <figcaption>{scope}, {first} to {last}: one point per run, from 0 to 100%.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`top@1, top@5, recall@5 and recall@10 per run, ${first} to ${last}`} preserveAspectRatio="none">
        {SERIES.map((s) => (
          <g key={s.key} className="ev-series" data-line={s.key}>
            <polyline className="kn-line" fill="none" points={points.map((p, i) => `${x(i).toFixed(1)},${y(p.measures[s.key]).toFixed(1)}`).join(' ')} />
            {points.map((p, i) => (
              <circle key={p.at} className="ev-point" cx={x(i)} cy={y(p.measures[s.key])} r={3} vectorEffect="non-scaling-stroke">
                <title>{`${s.label} ${percent(p.measures[s.key])}, ${dayOf(p.at)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <p className="kn-legend ask-muted">{SERIES.map((s) => <span key={s.key} data-key={s.key}>{s.label}</span>)}</p>
    </figure>
  );
}

function Misses({ run, questions }: { run: EvalRun; questions: readonly EvalQuestion[] }) {
  return (
    <div data-region="misses">
      <h3>Misses of the latest run</h3>
      {run.misses.length === 0
        ? <p className="ask-muted" data-note="no-miss">Every question’s right answer was in the top 5.</p>
        : (
          <div className="kn-scroll">
            <table className="kn-table">
              <thead><tr>{['Question', 'Category', 'Right answer ranked', 'Came first', 'Right answers'].map((head) => <th key={head} scope="col">{head}</th>)}</tr></thead>
              <tbody>
                {run.misses.map((miss, i) => {
                  const text = missTextOf(miss, questions);
                  return (
                    <tr key={miss.id ?? i} data-miss={miss.id ?? String(i)}>
                      <td className="kn-text" title={text ?? ''}>{text === null ? NONE : excerpt(text, 60)}</td>
                      <td>{miss.category}</td>
                      <td>{miss.rank === null ? 'not found' : String(miss.rank)}</td>
                      <td>{miss.first.map((id) => <code key={id}>{id}</code>)}</td>
                      <td>{miss.right.map((id) => <code key={id}>{id}</code>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      <p className="ask-muted">Latest run: {dayOf(run.ranAt)}, {run.trigger === 'embed' ? 'after new knowledge was embedded' : 'daily'}, {run.overall.questions} questions measured{run.skipped > 0 ? `, ${String(run.skipped)} left out for having no right answer` : ''}.</p>
    </div>
  );
}

function Answer({ answer }: { answer: EvalAnswer }) {
  const confidence = answer.confidence === null ? '' : `, ${answer.confidence.toFixed(2)}`;
  return (
    <li data-answer={answer.entryId} data-source={answer.source} data-relevant={answer.relevant ? 'true' : 'false'}>
      <code>{answer.entryId}</code>
      <span className="ev-by">{answer.relevant ? '' : 'not an answer · '}{byOf(answer)}{confidence} · {dayOf(answer.decidedAt)}</span>
      {answer.relevant && answer.source === 'jev'
        ? <AnswerButton question={answer.questionId} entry={answer.entryId} relevant label="Confirm" /> : null}
      <AnswerButton question={answer.questionId} entry={answer.entryId} relevant={!answer.relevant} label={answer.relevant ? 'Remove' : 'Restore'} />
    </li>
  );
}

function SetItem({ item, domains }: { item: SetQuestion; domains: readonly DomainChoice[] }) {
  const { question, right, refused } = item;
  return (
    <details className="kn-group ev-question" data-question={question.id}>
      <summary>
        <span className="kn-group-question" title={question.question}>{excerpt(question.question, 90)}</span>
        <span className="kn-group-count">{right.length} right {right.length === 1 ? 'answer' : 'answers'}</span>
        <span className="kn-group-rank ask-muted">{categoryLabel(question.category, domains)} · added by {addedByOf(question)}, {dayOf(question.addedAt)}</span>
      </summary>
      {right.length === 0 ? <p className="ask-muted" data-note="no-right-answer">No right answer yet: this question is left out of the measures until one is given.</p> : null}
      <ul className="ev-answers">{[...right, ...refused].map((a) => <Answer key={a.entryId} answer={a} />)}</ul>
      <AddAnswer question={question.id} />
      <RemoveQuestion question={question.id} />
    </details>
  );
}

export function EvalView({ product, runs, questions, answers, query, domains }: {
  product: string; runs: readonly EvalRun[]; questions: readonly EvalQuestion[]; answers: readonly EvalAnswer[];
  query: Query; domains: readonly DomainChoice[];
}) {
  const latest = runs[runs.length - 1];
  const open = openCategoryOf(runs, query);
  const points = seriesOf(runs, open);
  const lastPoint = points[points.length - 1];
  const set = setOf(questions, answers);
  const choices = domains.map((d) => ({ key: d.key, label: categoryLabel(d.key, domains) }));
  return (
    <Section id="search-eval-title" title={EVAL_TITLE} lede={EVAL_LEDE}>
      {latest === undefined ? <p className="products-empty" data-note="no-run">{NO_RUN}</p> : (
        <>
          <Categories product={product} runs={runs} open={open} domains={domains} />
          {lastPoint === undefined ? null : (
            <>
              <Figures measures={lastPoint.measures} />
              <Chart points={points} scope={open === null ? 'All categories' : categoryLabel(open, domains)} />
            </>
          )}
          <Misses run={latest} questions={questions} />
        </>
      )}
      <div data-region="set">
        <h3>The set</h3>
        <p className="ask-muted">Each question with the entries that answer it, marked Jev or person. Confirm or remove a right answer, or add an entry Jev missed: your word wins and the next run uses it.</p>
        {set.length === 0 ? <p className="products-empty" data-note="no-question">{NO_QUESTION}</p> : set.map((item) => <SetItem key={item.question.id} item={item} domains={domains} />)}
        <AddQuestion product={product} categories={choices} />
      </div>
    </Section>
  );
}
