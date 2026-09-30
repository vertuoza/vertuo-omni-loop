import { PersonChip } from '../../people/PersonChip';
import { initialFace, type ForMeEntry } from './question';

// For me (PRD 144): the open questions shared with the person looking, the soonest to move to the
// terminal first, each with its time left and who shared it, each opening /ask/q/<round>. The
// sidebar's For me item carries their count (PRD 438). The sharer's face comes before their name (PRD 652).

export function ForMe({ entries }: { entries: ForMeEntry[] }) {
  return (
    <div className="ask-col">
      <h1 className="ask-sr">Shared with me</h1>
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
                  {entry.sessionTitle} · shared by{' '}
                  <PersonChip person={{ name: entry.sharedBy, face: entry.sharedByFace ?? initialFace(entry.sharedBy) }} size="inline" link={false} />{' '}·{' '}
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
