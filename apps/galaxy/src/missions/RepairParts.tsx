'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demoMissionsPort, httpMissionsPort, type MissionsPort } from './page/missions-tab.client';
import { REPAIR_WORDS, type Linked, type RepairLine } from './repair';
import './repair.css';

// What a mission's repairs look like on the Operation room and the Missions tab (PRD 2980 s6, the `fleet-room` screen): a link,
// the sentence under a Repairing or Waits line, and the Stopped block, with its one action, Resume.

/** A linked label, or nothing. */
function LinkedWords({ link }: { link: Linked | null }) {
  return link === null ? null : <a href={link.href}>{link.label}</a>;
}

/** The sentence under a Repairing or Waits line: its cause, then its link, and what is left. */
export function RepairDetail({ line }: { line: RepairLine }) {
  return (
    <small className="repair-detail">
      {line.cause !== null && <>{line.cause}{line.fingerprint === null ? '' : ` ${REPAIR_WORDS.cause} ${line.fingerprint}.`}{' '}</>}
      <LinkedWords link={line.link} />
    </small>
  );
}

/** The Stopped block of a PRD: cause, repairs tried, proposed fix, what is left, Resume and Take it by hand. */
export function StoppedBlock({ line, demo }: { line: RepairLine; demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const port: MissionsPort = useMemo(() => (demo ? demoMissionsPort : httpMissionsPort()), [demo]);
  async function resume() {
    setBusy(true);
    setProblem(null);
    const done = await port.move(line.mission, 'resume');
    setBusy(false);
    if (done.ok) router.refresh();
    else setProblem(done.message);
  }
  return (
    <div className="repair-stopped" aria-label={line.headline}>
      <h3>{line.headline}</h3>
      <dl className="repair-facts">
        <dt>{REPAIR_WORDS.cause}</dt>
        <dd>{line.cause ?? 'No record that could be read.'}{line.fingerprint !== null && <> <span className="repair-mono">{line.fingerprint}</span></>}</dd>
        <dt>{REPAIR_WORDS.tried}</dt>
        <dd>
          <ol className="repair-tried">
            {line.tried.map((one, n) => <li key={n}>{one.fix === null ? 'No fix' : <LinkedWords link={one.fix} />} · {one.words}</li>)}
          </ol>
        </dd>
        {line.proposedFix !== null && <><dt>{REPAIR_WORDS.fix}</dt><dd>{line.proposedFix}</dd></>}
        <dt>{REPAIR_WORDS.left}</dt>
        <dd>{line.left}</dd>
      </dl>
      <div className="repair-actions">
        <button type="button" className="ask-button" data-primary="" disabled={busy} onClick={() => { void resume(); }}>{REPAIR_WORDS.resume}</button>
        {line.byHand !== null && <a href={line.byHand}>{REPAIR_WORDS.byHand}</a>}
      </div>
      {line.resume !== null && <p className="ask-muted repair-note">{line.resume}</p>}
      {problem !== null && <p className="repair-problem" role="alert">{problem}</p>}
    </div>
  );
}
