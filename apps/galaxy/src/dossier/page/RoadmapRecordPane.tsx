import type { RoadmapRecordView } from '../../roadmap/page/model';
import { ApproveButton } from './ApproveButton';
import { SealCard } from './SealCard';

// A product roadmap's page (PRD 2011, s3), under its title: its status word and approval as a ◆ PRD's page
// shows them (./DossierPage.tsx) — the Approve button for a member while it waits, drifted or voided, the
// seal of #1351 once approved — and, on the Versions tab, every version of each part a push sent, the newest
// first, with the text of the one picked (`?part=`, `?v=`). The approval pins roadmap.md alone.

/** The status word and the approval: what it waits on, then Approve or the seal. */
export function RoadmapApproval({ record }: { record: RoadmapRecordView }) {
  const { approval, status } = record;
  return (
    <>
      <p className="roadmap-chips" aria-label="Approval">
        <span className={`roadmap-chip roadmap-status is-${status}`}>{status}</span>
        <span className="roadmap-chip">{approval.words}</span>
      </p>
      {approval.detail ? <p className="roadmap-muted">{approval.detail}</p> : null}
      {approval.canApprove ? (
        <section className="dossier-approve-screen" id="approve" aria-label="Approve">
          <p className="roadmap-muted">Approving pins roadmap.md as it is now; a newer one drifts the approval.</p>
          <ApproveButton dossier={approval.dossier} noun="roadmap" />
        </section>
      ) : approval.seal ? <SealCard seal={{ ...approval.seal, name: `roadmap ${approval.seal.roadmap ?? ''}`, mark: approval.seal.roadmap?.split('-').pop() ?? '' }} dossier={approval.dossier} /> : null}
    </>
  );
}

/** The Versions tab: each part with its versions, and the text of the one shown. */
export function RoadmapVersions({ record }: { record: RoadmapRecordView }) {
  const { parts, shown } = record;
  if (parts === null) return <p className="ask-problem" role="alert">The roadmap's versions could not be read. Reload the page in a moment.</p>;
  return (
    <div className="board roadmap">
      {parts.map((part) => (
        <section key={part.part} className="board-card roadmap-versions" aria-label={part.label}>
          <h2>{part.label} <small className="roadmap-muted">{part.file} · {part.count} {part.count === 1 ? 'version' : 'versions'}</small></h2>
          {part.lines.length === 0 ? <p className="roadmap-muted">No push sent it yet.</p> : (
            <ul className="roadmap-lines">
              {part.lines.map((line) => (
                <li key={line.id} className="roadmap-line">
                  <a href={line.href} aria-current={line.current ? 'true' : undefined}>{line.label}</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {shown ? (
        <section className="board-card roadmap-version-text" aria-label="Version shown">
          <h2>{shown.label} · v{shown.number}</h2>
          {shown.text === null ? <p className="ask-problem" role="alert">This version could not be read.</p> : <pre className="dossier-diff">{shown.text}</pre>}
        </section>
      ) : null}
    </div>
  );
}
