import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { Attestation } from './Attestation';
import { attestationRepository, type ApprovalInForce, type AttestationDb, type AttestationVersion } from './Attestation.repository';
import { attestationOf, attestationView, readAttestation, type AttestationView } from './Attestation.service';

// The attestation of a product PRD (PRD 1548 s4): who approved it, the member and approver ticks, the
// time, and each pinned hash beside today's, with Restore and Ask again when drifted. No test calls Supabase.

const hash = (c: string) => c.repeat(64);
const PAGE = '/prd/d-1';
const APPROVAL: ApprovalInForce = {
  id: 'ap-1',
  approved_by: 'u-irisa',
  approver_login: 'irisa',
  approved_at: '2026-10-08T14:02:00+00:00',
  files: [
    { kind: 'spec', path: 'spec.md', version_id: 'v-spec-1', sha256: hash('a') },
    { kind: 'plan', path: 'plan.md', version_id: 'v-plan-1', sha256: hash('b') },
    { kind: 'voice', path: 'voice.json', version_id: 'v-voice-1', sha256: hash('c') },
  ],
};
const version = (id: string, kind: string, sha: string, at: string): AttestationVersion => ({ id, kind, sha256: hash(sha), created_at: at });
const PINNED = [
  version('v-spec-1', 'spec', 'a', '2026-10-08T10:00:00Z'),
  version('v-plan-1', 'plan', 'b', '2026-10-08T10:00:00Z'),
  version('v-voice-1', 'voice', 'c', '2026-10-08T10:00:00Z'),
];
const READ = { approval: APPROVAL, voids: [], versions: PINNED, member: true, asked: ['u-irisa'] };

describe('attestationView', () => {
  it('reads building with the approver, both ticks, the time and every pinned hash beside today\'s', () => {
    expect(attestationView(READ, PAGE)).toEqual({
      state: 'building',
      approver: 'irisa',
      member: true,
      approverTick: 'asked',
      at: '8 Oct 2026, 14:02 UTC',
      files: [
        { path: 'spec.md', pinned: 'aaaaaaa', today: 'aaaaaaa', same: true, restore: null },
        { path: 'plan.md', pinned: 'bbbbbbb', today: 'bbbbbbb', same: true, restore: null },
        { path: 'voice.json', pinned: 'ccccccc', today: 'ccccccc', same: true, restore: null },
      ],
      voided: null,
      askAgain: null,
    });
  });

  it('reads drifted once a newer version replaced a pinned one, with Restore on the pinned version and Ask again', () => {
    const view = attestationView({ ...READ, versions: [...PINNED, version('v-plan-2', 'plan', 'e', '2026-10-09T10:00:00Z')] }, PAGE);
    expect(view.state).toBe('drifted');
    expect(view.files[1]).toEqual({ path: 'plan.md', pinned: 'bbbbbbb', today: 'eeeeeee', same: false, restore: '/prd/d-1?tab=plan&v=1' });
    expect(view.files[0]?.same).toBe(true);
    expect(view.askAgain).toBe('/prd/d-1#approve');
  });

  it('reads drifted after a void, naming who pushed and when', () => {
    const voids = [{ kind: 'spec', from_sha256: hash('a'), to_sha256: hash('f'), pusher_login: 'dev', voided_at: '2026-10-09T08:00:00Z' }];
    const view = attestationView({ ...READ, voids }, PAGE);
    expect(view.state).toBe('drifted');
    expect(view.files[0]).toMatchObject({ path: 'spec.md', same: false, restore: '/prd/d-1?tab=spec&v=1' });
    expect(view.voided).toBe('voided by dev\'s push · 9 Oct 2026, 08:00 UTC');
  });

  it('never drifts on a newer voice: the personas\' rounds are appended after approval', () => {
    expect(attestationView({ ...READ, versions: [...PINNED, version('v-voice-2', 'voice', 'd', '2026-10-09T10:00:00Z')] }, PAGE).state).toBe('building');
  });

  it('ticks the approver for any member when the product asks nobody, and crosses one it does not ask or a member gone', () => {
    expect(attestationView({ ...READ, asked: [] }, PAGE).approverTick).toBe('any');
    expect(attestationView({ ...READ, asked: ['u-other'] }, PAGE).approverTick).toBe('not asked');
    expect(attestationView({ ...READ, member: false }, PAGE).member).toBe(false);
  });

  it('shows a dash for a pin with no hash, and no today for a kind with no version left', () => {
    const approval = { ...APPROVAL, files: [{ kind: 'spec', path: 'spec.md', version_id: 'v-gone' }] };
    expect(attestationView({ ...READ, approval, versions: [] }, PAGE).files).toEqual([{ path: 'spec.md', pinned: '—', today: null, same: false, restore: '/prd/d-1?tab=spec' }]);
  });
});

/** A member's client answering each table's reads from `tables`, in order; `null` is a refusal. */
function fakeDb(tables: Record<string, (unknown[] | null)[]>) {
  const asked: string[] = [];
  const from = (table: string) => {
    asked.push(table);
    const queue = tables[table] ?? [];
    const answer = queue.length > 0 ? queue.shift() : [];
    const raw = answer === null ? { data: null, error: { message: 'permission denied' } } : { data: answer, error: null };
    type Query = { select: () => Query; eq: () => Query; order: () => Query; limit: () => Query; then: PromiseLike<typeof raw>['then'] };
    const query: Query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      then: (resolve, reject) => Promise.resolve(raw).then(resolve, reject),
    };
    return query;
  };
  return { db: { from } as unknown as AttestationDb, asked };
}

const TABLES = () => ({
  approvals: [[APPROVAL]],
  approval_voids: [[]],
  dossier_versions: [PINNED],
  dossiers: [[{ workspace_id: 'w-1', product_id: 'p-1' }]],
  workspace_members: [[{ user_id: 'u-irisa' }]],
  product_approvers: [[{ user_id: 'u-irisa' }]],
});

describe('readAttestation and attestationOf — read as the member', () => {
  it('reads the approval in force, its voids, the hashes and both ticks into the view', async () => {
    const { db } = fakeDb(TABLES());
    expect(await readAttestation(attestationRepository(db), 'd-1', PAGE)).toEqual(attestationView(READ, PAGE));
  });

  it('reads null, and nothing more, while nobody approved the PRD', async () => {
    const { db, asked } = fakeDb({ ...TABLES(), approvals: [[]] });
    expect(await readAttestation(attestationRepository(db), 'd-1', PAGE)).toBeNull();
    expect(asked).toEqual(['approvals']);
  });

  it('reads no member and no approver asked for a dossier it cannot read, and none asked with no product', async () => {
    expect(await attestationRepository(fakeDb({ dossiers: [[]] }).db).approvers('d-1', 'u-irisa')).toEqual({ member: false, asked: [] });
    const { db, asked } = fakeDb({ dossiers: [[{ workspace_id: 'w-1', product_id: null }]], workspace_members: [[{ user_id: 'u-irisa' }]] });
    expect(await attestationRepository(db).approvers('d-1', 'u-irisa')).toEqual({ member: true, asked: [] });
    expect(asked).not.toContain('product_approvers');
  });

  it('is read only for a product PRD: a repository\'s PRD, a draft and a fix read nothing', async () => {
    const shown = { id: 'd-1', prd: null, kind: 'prd', birthplace: 'server' };
    expect(await attestationOf(fakeDb(TABLES()).db, shown)).toEqual(attestationView(READ, PAGE));
    for (const other of [{ ...shown, prd: parsePrd(12) }, { ...shown, birthplace: null }, { ...shown, birthplace: 'repo' }, { ...shown, kind: 'visual' }]) {
      const { db, asked } = fakeDb(TABLES());
      expect(await attestationOf(db, other)).toBeNull();
      expect(asked).toEqual([]);
    }
  });

  it('leaves the attestation out, never the page, when a read fails or answers out of shape', async () => {
    const shown = { id: 'd-1', prd: null, kind: 'prd', birthplace: 'server' };
    const errors: unknown[] = [];
    const error = console.error;
    console.error = (e: unknown) => { errors.push(e); };
    try {
      expect(await attestationOf(fakeDb({ ...TABLES(), dossier_versions: [null] }).db, shown)).toBeNull();
      expect(await attestationOf(fakeDb({ ...TABLES(), approvals: [[{ id: 'ap-1' }]] }).db, shown)).toBeNull();
    } finally {
      console.error = error;
    }
    expect(errors.map(String)).toEqual(['Error: read the versions\' hashes: permission denied', 'Error: read the approval: answered out of shape']);
  });
});

const render = (attestation: AttestationView) => renderToStaticMarkup(createElement(Attestation, { attestation }));

describe('Attestation — on the PRD page, where omni/approved\'s Details opens', () => {
  it('shows the approver, both ticks, the time and each pinned hash beside today\'s, at #attestation', () => {
    const html = render(attestationView(READ, PAGE));
    expect(html).toContain('id="attestation"');
    expect(html).toContain('Approved by irisa');
    expect(html).toContain('workspace member ✓ · product approver ✓ · 8 Oct 2026, 14:02 UTC');
    expect(html).toContain('building · every pinned hash matches');
    expect(html).toContain('<span>= plan.md</span><span><code>bbbbbbb</code> · <code>bbbbbbb</code></span>');
    expect(html).not.toContain('Restore');
    expect(html).not.toContain('Ask again');
  });

  it('drifted, offers Restore on each changed file and Ask again, as plain links', () => {
    const html = render(attestationView({ ...READ, member: false, asked: [], versions: [...PINNED, version('v-plan-2', 'plan', 'e', '2026-10-09T10:00:00Z')] }, PAGE));
    expect(html).toContain('no longer a member ✗ · any member may approve ✓');
    expect(html).toContain('drifted · a pinned file changed');
    expect(html).toContain('<span>≠ plan.md</span><span><code>bbbbbbb</code> · <code>eeeeeee</code> · <a href="/prd/d-1?tab=plan&amp;v=1">Restore</a></span>');
    expect(html).toContain('<a href="/prd/d-1#approve">Ask again</a>');
  });

  it('names a void, and a dash for a kind with no version today', () => {
    const voids = [{ kind: 'spec', from_sha256: hash('a'), to_sha256: hash('f'), pusher_login: 'dev', voided_at: '2026-10-09T08:00:00Z' }];
    const html = render(attestationView({ ...READ, voids, asked: ['u-other'], versions: PINNED.filter((v) => v.kind !== 'plan') }, PAGE));
    expect(html).toContain('not a product approver ✗');
    expect(html).toContain('voided by dev&#x27;s push · 9 Oct 2026, 08:00 UTC');
    expect(html).toContain('<code>bbbbbbb</code> · <code>—</code>');
  });
});
