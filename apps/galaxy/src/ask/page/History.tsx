import { Fragment, type ReactNode } from 'react';
import { ContextLine } from './ContextLine';
import { QuestionText } from './QuestionText';
import { screenshotsNote, type HistoryEntry } from './view';

// Earlier rounds, folded into a quiet list below the open one, newest first: one line each (the
// header, or the question, and its answer) with where it was answered, page or terminal; open one
// to read the full questions. An answer given with screenshots says how many (PRD 620).

/** "📎 N screenshots" beside an answer that carries them (PRD 620); nothing for one without. The
 * pictures are not shown: History, the workspace history and the shared-round page only count them. */
export function Screenshots({ count, before = '' }: { count: number | undefined; before?: string }) {
  const note = screenshotsNote(count);
  return note ? <>{before}<span className="ask-shots-count">{note}</span></> : null;
}

/** A round's questions, each with its answer and how many screenshots it carries. */
export function AnswerList({ lines, className }: { lines: { question: string; answer?: string | null; screenshots?: number }[]; className?: string }) {
  return (
    <dl className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          <dt><QuestionText text={line.question} /></dt>
          <dd>{line.answer ?? '—'}<Screenshots count={line.screenshots} before=" " /></dd>
        </Fragment>
      ))}
    </dl>
  );
}

const TAG: Record<HistoryEntry['outcome'], (via: HistoryEntry['via']) => string> = {
  answered: (via) => via ?? 'page',
  moved: () => 'terminal',
  unanswered: () => 'not answered',
};

function Summary({ entry }: { entry: HistoryEntry }) {
  if (entry.outcome !== 'answered') {
    const what = entry.lines.map((l) => l.header || l.question).join(' · ');
    return <span className="ask-past-sum">{what} — {entry.outcome === 'moved' ? 'moved to the terminal, no answer recorded' : 'not answered'}</span>;
  }
  return (
    <span className="ask-past-sum">
      <span className="ask-ok" aria-label="Answered">✓</span>{' '}
      {entry.lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {line.header || line.question}: <b>{line.answer ?? '—'}</b>
          <Screenshots count={line.screenshots} before=" " />
        </Fragment>
      ))}
    </span>
  );
}

/** `chip` puts each round's category chip under it (PRD 144). */
export function History({ history, chip }: { history: HistoryEntry[]; chip?: (entry: HistoryEntry) => ReactNode }) {
  if (history.length === 0) return null;
  return (
    <section className="ask-history" aria-labelledby="ask-history-title">
      <h2 id="ask-history-title">Earlier in this session</h2>
      <ol>
        {history.map((entry) => (
          <li key={entry.id}>
            <details className="ask-past">
              <summary>
                <Summary entry={entry} />
                <span className="ask-via" data-via={entry.via ?? entry.outcome}>{TAG[entry.outcome](entry.via)}</span>
              </summary>
              <AnswerList lines={entry.lines} />
            </details>
            <ContextLine parts={entry.context} />
            {chip?.(entry)}
          </li>
        ))}
      </ol>
    </section>
  );
}
