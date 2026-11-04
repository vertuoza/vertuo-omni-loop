'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { refusalOf } from './refusal';

// Request a Tech Approval, on a ◆ PRD's page (PRD 2608 s4), shown to the PRD's author while it is not yet
// approved and holds no request: a picker of the workspace's other members (GET
// /api/dossiers/approval/tech) and a button that names the chosen one (POST), then re-renders the page. A
// refusal shows the route's own words. The request cannot be withdrawn; the page says so.

const TECH_ROUTE = '/api/dossiers/approval/tech';

const Members = z.object({ members: z.array(z.object({ login: z.string().min(1), name: z.string().nullable().optional() })) });

export function RequestTechApproval({ dossier }: { dossier: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<Array<{ login: string; name?: string | null | undefined }> | null>(null);
  const [login, setLogin] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetch(`${TECH_ROUTE}?dossier=${encodeURIComponent(dossier)}`, { cache: 'no-store' })
      .then(async (answer) => (answer.ok ? Members.parse(await answer.json()).members : null))
      .catch(() => null)
      .then((found) => { if (live) { setMembers(found); if (found === null) setProblem('The members could not be read. Reload the page in a moment.'); } });
    return () => { live = false; };
  }, [dossier]);

  async function request() {
    if (busy || !login) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await fetch(TECH_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dossier, login }) });
      if (answer.ok) {
        router.refresh();
      } else {
        setProblem(await refusalOf(answer, `The Tech Approval was not requested (${answer.status}). Try again.`));
      }
    } catch {
      setProblem('The Tech Approval was not requested. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <section className="dossier-request-tech" aria-label="Request a Tech Approval">
      <h2>Request a Tech Approval</h2>
      <p className="ask-hint">One engineer reads the plan with you before the product approvers are asked. It cannot be withdrawn.</p>
      <select aria-label="Who should give the Tech Approval" value={login} disabled={members === null || busy} onChange={(event) => setLogin(event.target.value)}>
        <option value="">Choose a member</option>
        {members?.map((m) => <option key={m.login} value={m.login}>{m.name ? `${m.name} (@${m.login})` : `@${m.login}`}</option>)}
      </select>
      <button type="button" className="ask-button" disabled={busy || !login} onClick={() => void request()}>{busy ? 'Requesting…' : 'Request a Tech Approval'}</button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </section>
  );
}
