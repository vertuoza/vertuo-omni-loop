'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button, Card, Notice, SectionHeading, Select, Stack, Text } from '@omni/ui';
import { refusalOf } from './refusal';

// Request a Tech Approval, on a ◆ PRD's page (PRD 2608 s4), offered to any member while it is not yet
// approved and holds no request (bug #2992): since omni-loop-20 s6 it is picked in the head's Actions
// menu, which opens this panel under the head: a picker of the workspace's other members (GET
// /api/dossiers/approval/tech) and a button that names the chosen one (POST), then re-renders the page. A
// refusal shows the route's own words. The request cannot be withdrawn; the panel says so.

const TECH_ROUTE = '/api/dossiers/approval/tech';

const Members = z.object({ members: z.array(z.object({ login: z.string().min(1), name: z.string().nullable().optional() })) });

type Member = { login: string; name?: string | null | undefined };

/** The picker's options: a prompt, then each member by name and login. */
const memberOptions = (members: readonly Member[] | null) => [
  { value: '', label: 'Choose a member' },
  ...(members ?? []).map((m) => ({ value: m.login, label: m.name ? `${m.name} (@${m.login})` : `@${m.login}` })),
];

export function RequestTechApproval({ dossier }: { dossier: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
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
        setProblem(await refusalOf(answer, `The Tech Approval was not requested (${String(answer.status)}). Try again.`));
      }
    } catch {
      setProblem('The Tech Approval was not requested. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <section className="dossier-request-tech" aria-label="Request a Tech Approval">
      <Card padding="4">
        <Stack gap="3">
          <SectionHeading level="3">Request a Tech Approval</SectionHeading>
          <Text size="small" tone="secondary">One engineer reads the plan with you before the product approvers are asked. It cannot be withdrawn.</Text>
          <Stack direction="row" gap="2" align="center" wrap>
            <Select label="Who should give the Tech Approval" options={memberOptions(members)} value={login} disabled={members === null || busy} onValueChange={setLogin} />
            <Button variant="secondary" disabled={busy || !login} onClick={() => void request()}>{busy ? 'Requesting…' : 'Request a Tech Approval'}</Button>
          </Stack>
          {problem && <Notice tone="danger">{problem}</Notice>}
        </Stack>
      </Card>
    </section>
  );
}
