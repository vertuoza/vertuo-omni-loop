import type { ProofView } from './proof';
import { VersionPicker } from './VersionPicker';

// The Proof tab of /prd/<id> (PRD 798, s4): what /omni:prove recorded against the ready feature PR's
// preview. The run picker (the version picker, one entry per run), then the run's facts — the commit, the
// URL it was recorded on, when, and the ✓/✗/— counts — then one row per criterion: its mark and text, its
// note, a player for its clip, and its script behind a "Script" fold. Read-only; every text is escaped.

const VERDICT_WORDS = { pass: 'pass', fail: 'fail', unfilmable: 'not filmable' } as const;

export function ProofPane({ proof, action }: { proof: ProofView | null; action: string }) {
  if (!proof) return <p className="dossier-empty">No proof was recorded for this PRD.</p>;
  const { counts } = proof;
  return (
    <>
      <VersionPicker action={action} tab="proof" versions={proof.versions} shown={proof.number} noun="Run" />
      <dl className="proof-facts">
        <div><dt>Commit</dt><dd><code>{proof.commit}</code></dd></div>
        <div><dt>Recorded on</dt><dd><a href={proof.url} target="_blank" rel="noopener noreferrer">{proof.url}</a></dd></div>
        <div><dt>When</dt><dd>{proof.at}</dd></div>
        <div>
          <dt>Verdicts</dt>
          <dd className="proof-counts">
            <span className="proof-mark proof-pass">✓ {counts.pass}</span>
            <span className="proof-mark proof-fail">✗ {counts.fail}</span>
            <span className="proof-mark proof-unfilmable">— {counts.unfilmable}</span>
          </dd>
        </div>
      </dl>
      <ol className="proof-rows">
        {proof.criteria.map((c, i) => (
          <li key={i} className={`proof-row proof-${c.verdict}`}>
            <p className="proof-criterion">
              <span className={`proof-mark proof-${c.verdict}`} aria-label={VERDICT_WORDS[c.verdict]} title={VERDICT_WORDS[c.verdict]}>{c.mark}</span>
              <span>{c.text}</span>
            </p>
            {c.note && <p className="proof-note">{c.note}</p>}
            {c.video && (
              <video className="proof-video" src={c.video} controls preload="metadata" playsInline aria-label={`Clip: ${c.text}`} />
            )}
            {c.videoMissing && <p className="ask-problem" role="alert">The clip could not be loaded. Reload the page in a moment.</p>}
            {c.script && (
              <details className="proof-script">
                <summary>Script <code>{c.script.name}</code></summary>
                {c.script.text !== null
                  ? <pre><code>{c.script.text}</code></pre>
                  : <p className="ask-hint">The script could not be read here.{c.script.href && <> <a href={c.script.href} target="_blank" rel="noopener noreferrer">Open it</a>.</>}</p>}
              </details>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
