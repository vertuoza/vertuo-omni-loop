import type { MainWatchView } from '../../main-watch/status';
import { CHECK_LABELS, ORIGIN_LABELS, type FindingState, type FindingView } from '../../rewind/rewind.contract';

const STATE_WORDS: Readonly<Record<FindingState, string>> = { proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' };
const isCheck = (value: string): value is keyof typeof CHECK_LABELS => value in CHECK_LABELS;
const isOrigin = (value: string): value is keyof typeof ORIGIN_LABELS => value in ORIGIN_LABELS;

// The Main tab of /prd/<id> (PRD 2410, s3): what the Omni App saw on main after the PRD merged. On top,
// the status in words; then each break with its kind, its link and, for a CI red, what the parent commit
// was; then what the rewind found, which is nothing until it runs: it says so, with the line to run it
// from a terminal. Read-only. Every text is escaped; a link opens on GitHub.

export function MainPane({ main, findings = [] }: { main: MainWatchView | null; findings?: readonly FindingView[] }) {
  if (!main) return <p className="dossier-empty">The Omni App watches main for seven days once the PRD merges.</p>;
  return (
    <>
      <p className={`main-status main-${main.state}`}><strong>{main.words}</strong>{main.detail && <> · <span className="ask-hint">{main.detail}</span></>}</p>
      {main.unread.length > 0 && (
        <ul className="main-unread" aria-label="Signals that could not be read">
          {main.unread.map((signal) => <li key={signal} className="ask-hint">Could not read: {signal}</li>)}
        </ul>
      )}
      {main.breaks.length === 0 ? (
        <p className="ask-hint main-none">Nothing broke main so far.</p>
      ) : (
        <ol className="main-breaks" aria-label="What broke main">
          {main.breaks.map((b, at) => (
            <li key={at} className={`main-break main-break-${b.kind}`}>
              <p className="main-break-head">
                <span className="main-kind">{b.label}</span>
                <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
              </p>
              <p className="ask-hint">
                {b.at}{b.lane && <> · {b.lane}</>}{b.parent && <> · {b.parent}</>}
              </p>
            </li>
          ))}
        </ol>
      )}
      {main.state === 'broke' && (
        <section className="main-rewind" aria-label="The rewind">
          <h2>The rewind</h2>
          {findings.length === 0 ? (
            <p className="dossier-empty">
              No rewind yet.{' '}Run <code>/omni:rewind {main.prd}</code> from a terminal.
            </p>
          ) : (
            <ol className="main-findings" aria-label="What the rewind found">
              {findings.map((f) => <Finding key={f.id} finding={f} />)}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

/** One finding of the rewind: its check, where the break started, what happened, the links it stands on and its fix (PRD 2410, s5). */
function Finding({ finding: f }: { finding: FindingView }) {
  const check = isCheck(f.check) ? CHECK_LABELS[f.check] : f.check;
  const origin = isOrigin(f.origin) ? ORIGIN_LABELS[f.origin] : f.origin;
  return (
    <li className={`main-finding main-finding-${f.state}`}>
      <p className="main-finding-head">
        <span className="main-kind">{check}</span>
        <span className="ask-hint">Started in: {origin}</span>
        <span className="ask-hint">{STATE_WORDS[f.state]}{f.state === 'rejected' && f.reason ? `: ${f.reason}` : ''}</span>
      </p>
      <p className="main-finding-happened">{f.happened}</p>
      <ul className="main-finding-evidence" aria-label="Evidence">
        {f.evidence.filter((link) => link.startsWith('https://')).map((link) => (
          <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></li>
        ))}
      </ul>
      <p className="main-finding-fix"><strong>Fix:</strong> {f.fix}</p>
    </li>
  );
}
