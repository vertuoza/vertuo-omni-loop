import type { ApproverTick, AttestationView } from './Attestation.service';

// The attestation of a product PRD on its page (PRD 1548 s4), at `#attestation`, where `omni/approved`'s
// Details opens: who approved it, the member and approver ticks, when, then each pinned file's hash
// beside today's. Drifted, each changed file offers Restore (its pinned version, to push again) and the
// card offers Ask again (the approve screen). Plain links: it works before any script runs.

const STATE_WORDS = {
  building: 'building · every pinned hash matches',
  drifted: 'drifted · a pinned file changed',
} as const;

const APPROVER_WORDS: Record<ApproverTick, string> = {
  asked: 'product approver ✓',
  any: 'any member may approve ✓',
  'not asked': 'not a product approver ✗',
};

export function Attestation({ attestation }: { attestation: AttestationView }) {
  const { state, approver, member, approverTick, at, files, voided, askAgain } = attestation;
  return (
    <section id="attestation" className={`dossier-seal-card dossier-approval-${state}`} aria-label="Attestation">
      <p className="dossier-seal-who">Approved by {approver}</p>
      <p className="ask-hint">
        {member ? 'workspace member ✓' : 'no longer a member ✗'} · {APPROVER_WORDS[approverTick]} · {at}
      </p>
      <p><strong>{STATE_WORDS[state]}</strong></p>
      {voided && <p className="ask-hint">{voided}</p>}
      <ul className="dossier-seal-files" aria-label="Pinned files">
        <li><span>file</span><span>pinned · today</span></li>
        {files.map((file) => (
          <li key={file.path}>
            <span>{file.same ? '=' : '≠'} {file.path}</span>
            <span>
              <code>{file.pinned}</code> · <code>{file.today ?? '—'}</code>
              {file.restore && <> · <a href={file.restore}>Restore</a></>}
            </span>
          </li>
        ))}
      </ul>
      {askAgain && <p><a href={askAgain}>Ask again</a></p>}
    </section>
  );
}
