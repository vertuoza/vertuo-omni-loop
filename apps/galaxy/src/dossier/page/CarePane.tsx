import { PersonChip } from '../../people/PersonChip';
import { StageHeaderCopy } from './StageHeaderCopy';
import type { CareView } from './view';

// The PR care tab of /prd/<id> (PRD 790, s4): the feature PR's health, read from GitHub. Three rows —
// CI (the failed run linked while red), Conflicts, Review (the threads counted by verdict) — then one
// line per thread, asked first: the reviewer's face and login, the comment's first line, the verdict
// with Claude's reason, and a link to it on GitHub. Under them, the watcher line, with
// `/omni:pr-care <n>` to copy while nobody is watching. Read-only. Merged, it says there is
// nothing left to look after; GitHub still being read, or unreadable, it says so.

const COUNT_WORDS = [['open', 'open'], ['fixed', 'fixed'], ['pushed-back', 'pushed back'], ['asked', 'asked']] as const;

export function CarePane({ care }: { care: CareView | null }) {
  if (!care) return <p className="dossier-empty">This PRD has no feature PR yet.</p>;
  if (care.state === 'unread') return <p className="ask-problem" role="alert">{care.words}</p>;
  const open = care.prUrl && (
    <p className="outbox-answer">
      <a className="ask-button" href={care.prUrl} target="_blank" rel="noopener noreferrer">Open the feature PR</a>
    </p>
  );
  if (care.state === 'done' || care.state === 'pending') {
    return (
      <>
        {open}
        <p className="dossier-empty">{care.words}</p>
      </>
    );
  }
  const { ci, conflict, counts, threads, watcher } = care;
  return (
    <>
      {open}
      <dl className="care-rows">
        <div className={`care-row care-ci-${ci.state}`}>
          <dt>CI</dt>
          <dd>{ci.href ? <a href={ci.href} target="_blank" rel="noopener noreferrer">{ci.words}</a> : ci.words}</dd>
        </div>
        <div className={`care-row care-conflict-${conflict.state}`}>
          <dt>Conflicts</dt>
          <dd>{conflict.words}</dd>
        </div>
        <div className="care-row">
          <dt>Review</dt>
          <dd>{COUNT_WORDS.map(([verdict, words]) => `${counts[verdict]} ${words}`).join(' · ')}</dd>
        </div>
      </dl>
      {threads.length > 0 && (
        <ul className="care-threads" aria-label="Review threads">
          {threads.map((t) => (
            <li key={t.url} className={`care-thread care-verdict-${t.verdict}`}>
              <PersonChip person={t.person} size="inline" />
              <span className="care-first">{t.firstLine}</span>
              <span className="care-verdict">
                <strong>{t.verdictWords}</strong>
                {t.reason && <span className="ask-hint"> · {t.reason}</span>}
              </span>
              <a href={t.url} target="_blank" rel="noopener noreferrer">on GitHub ↗</a>
            </li>
          ))}
        </ul>
      )}
      <p className={watcher.watching ? 'care-watcher care-watching' : 'care-watcher'}>
        <span>{watcher.words}</span>
        {!watcher.watching && <>{' '}<StageHeaderCopy label="Copy" command={watcher.command} /></>}
      </p>
    </>
  );
}
