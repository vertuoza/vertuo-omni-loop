import type { ForMeEntry } from './question';

// For me (PRD 144): the open questions shared with the person looking, the soonest to move to the
// terminal first, each with its time left and who shared it, each opening /ask/q/<round>. The
// sidebar's For me item carries their count (PRD 438).

export function ForMe({ entries }: { entries: ForMeEntry[] }) {
  return (
    <div className="ask-col">
      <p className="ask-title">For me</p>
      {entries.length === 0 ? (
        <section className="ask-card">
          <h1>Nothing waits for you</h1>
          <p className="ask-muted">When a teammate shares a question with you while Claude waits for it, it shows here.</p>
        </section>
      ) : (
        <ol className="ask-for-me">
          {entries.map((entry) => (
            <li key={entry.roundId}>
              <a className="ask-for-me-link" href={`/ask/q/${entry.roundId}`}>
                <span className="ask-for-me-question">{entry.question}</span>
                <span className="ask-hint">
                  {entry.sessionTitle} · shared by {entry.sharedBy} ·{' '}
                  <span suppressHydrationWarning>{entry.minutesLeft > 1 ? `${entry.minutesLeft} min left` : 'less than a minute left'}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
