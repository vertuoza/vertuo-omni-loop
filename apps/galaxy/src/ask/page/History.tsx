import { Fragment } from 'react';
import type { HistoryEntry } from './view';

// Earlier rounds, folded into a quiet list below the open one, newest first: one line each (the
// header, or the question, and its answer) with where it was answered, page or terminal; open one
// to read the full questions.

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
        </Fragment>
      ))}
    </span>
  );
}

export function History({ history }: { history: HistoryEntry[] }) {
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
              <dl>
                {entry.lines.map((line, i) => (
                  <Fragment key={i}>
                    <dt>{line.question}</dt>
                    <dd>{line.answer ?? '—'}</dd>
                  </Fragment>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
