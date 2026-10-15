import type { ApprovalSeal } from './approval';
import { SealScroll } from './SealScroll';

// The seal of an approval in force (#1351), shared by a PRD's page and a product roadmap's (PRD 2011).

/** The seal of an approval in force (#1351): stamped with the PRD's number and APPROVED · PINNED, then who
 * approved it and when, and each pinned file with its short hash. */
export function SealCard({ seal, dossier }: { seal: Pick<ApprovalSeal, 'approver' | 'at' | 'files'> & { name: string; mark: string }; dossier: string }) {
  const hashes = seal.files.flatMap((file) => (file.hash ? [file.hash.slice(0, 4)] : [])).join(' ');
  return (
    <section id="approval" className="dossier-seal-card" aria-label="Approved">
      <svg className="dossier-seal" viewBox="0 0 100 100" role="img" aria-label={`Seal of ${seal.name}: approved and pinned`}>
        <defs><path id="dossier-seal-ring" d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0" /></defs>
        <circle cx="50" cy="50" r="47" className="dossier-seal-disc" />
        <circle cx="50" cy="50" r="41" className="dossier-seal-line" />
        <circle cx="50" cy="50" r="29" className="dossier-seal-line dossier-seal-dash" />
        <text className="dossier-seal-ring"><textPath href="#dossier-seal-ring">{`APPROVED · PINNED · ${hashes} ·`}</textPath></text>
        <text x="50" y="59" textAnchor="middle" className="dossier-seal-number">{seal.mark}</text>
      </svg>
      <p className="dossier-seal-who">Approved by {seal.approver}</p>
      <p className="ask-hint">{seal.at} · {seal.files.length} {seal.files.length === 1 ? 'file' : 'files'} pinned</p>
      <ul className="dossier-seal-files">
        {seal.files.map((file) => <li key={file.path}><span>{file.path}</span><code>{file.hash ?? '—'}</code></li>)}
      </ul>
      <SealScroll dossier={dossier} />
    </section>
  );
}
