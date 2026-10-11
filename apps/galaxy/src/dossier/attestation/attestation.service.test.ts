import { describe, expect, it, vi } from 'vitest';
import { sha256 } from 'vertuo-omni-plan/kit/lib/dossier/folder.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ApprovalRow, ApprovalVoid } from '../page/approval';
import type { HeadFiles, TargetPull } from './attestation-github';
import { attestationOf, headOf, readAttestation, shortHash, type AttestationPorts } from './attestation.service';
import type { AttestationFacts } from './attestation-facts';

// The Attestation page's rules (PRD 1612 s4): the seal, the approver, the policy line, each pinned file
// `=` / `≠` / `?` against the head, the target PRs, and on a drift the restore command and Approve again,
// judged by the kit's own `judgeApproval`, for each of the gate's four states.

const PRD = parsePrd(918);
const DOSSIER = '11111111-1111-4111-8111-111111111111';
const IRISA = 'user-irisa';
const ADA = 'user-ada';
const SPEC = '# Spec\n\nThe gate.\n';
const PLAN = '# Plan\n\n| s1 | the kit |\n';
const DIR = '.omni-loop/delivery/inbox/0918-gate';
const HEAD = '7d3e9a1c2b4f5e6d7c8b9a0f1e2d3c4b5a697887';

const row: ApprovalRow = {
  id: 'approval-1',
  approver_login: 'irisa',
  approved_at: '2026-10-08T14:02:00Z',
  files: [
    { kind: 'spec', path: `${DIR}/spec.md`, version_id: 'v-spec', sha256: sha256(SPEC) },
    { kind: 'plan', path: `${DIR}/plan.md`, version_id: 'v-plan', sha256: sha256(PLAN) },
  ],
};

const facts = (over: Partial<AttestationFacts> = {}): AttestationFacts => ({
  dossier: { id: DOSSIER, home_repo: 'vertuoza/mobile-plan', prd: PRD },
  approval: row,
  approvedBy: IRISA,
  voids: [],
  contents: new Map([['v-spec', SPEC], ['v-plan', PLAN]]),
  members: [IRISA, ADA],
  asked: [IRISA],
  workspace: 'vertuoza',
  product: { name: 'Mobile', repos: ['vertuoza/mobile-plan', 'vertuoza/vertuo-api'] },
  ...over,
});

const at = (files: Record<string, string | null>): HeadFiles => ({ kind: 'read', files: new Map(Object.entries(files)) });
const matching = at({ [`${DIR}/spec.md`]: SPEC, [`${DIR}/plan.md`]: PLAN });
const target: TargetPull = { repo: 'vertuoza/vertuo-api', number: 446, url: 'https://github.com/vertuoza/vertuo-api/pull/446', state: 'open', draft: false };

describe('the attestation of an approved PRD', () => {
  const view = attestationOf(facts(), ADA, HEAD, matching, [target, { ...target, number: 93, state: 'merged' }]);

  it('shows the seal, the approver with both ticks and when, and the policy line', () => {
    expect(view.verdict).toBe('approved');
    expect(view.title).toBe('Approved · pinned');
    expect(view.line).toBeNull();
    expect(view.who).toBe('irisa · member of vertuoza ✓ · Mobile approver ✓ · 8 Oct 2026, 14:02 UTC');
    expect(view.policy).toBe('Policy: Mobile approvers · vertuoza members.');
    expect(view.sealHash).toBe(sha256(SPEC).slice(0, 4));
  });

  it('marks every pinned file `=` with its short hash, and offers no fix', () => {
    expect(view.pins).toEqual([
      { mark: '=', path: `${DIR}/spec.md`, pinned: shortHash(sha256(SPEC)), now: null, how: null },
      { mark: '=', path: `${DIR}/plan.md`, pinned: shortHash(sha256(PLAN)), now: null, how: null },
    ]);
    expect(view.restore).toBeNull();
    expect(view.canApprove).toBe(false);
  });

  it('gives each open target PR the page state, a merged one `merged`', () => {
    expect(view.targets).toEqual([
      { repo: 'vertuoza/vertuo-api', number: 446, url: target.url, state: 'approved', draft: false },
      { repo: 'vertuoza/vertuo-api', number: 93, url: target.url, state: 'merged', draft: false },
    ]);
  });

  it('says any member may approve when the product asks nobody, and leaves the product tick out', () => {
    const open = attestationOf(facts({ asked: [] }), ADA, HEAD, matching, []);
    expect(open.policy).toBe('Policy: any of vertuoza members.');
    expect(open.who).toBe('irisa · member of vertuoza ✓ · 8 Oct 2026, 14:02 UTC');
  });
});

describe('the attestation of a drifted PRD', () => {
  it('shows a content change with both hashes, the restore command, and Approve again for an approver', () => {
    const changed = '# Plan\n\n| s1 | the kit, and more |\n';
    const view = attestationOf(facts(), IRISA, HEAD, at({ [`${DIR}/spec.md`]: SPEC, [`${DIR}/plan.md`]: changed }), []);
    expect(view.verdict).toBe('drifted');
    expect(view.title).toBe('Seal stands · build refused');
    expect(view.line).toBe('plan.md changed at head 7d3e9a1 · content');
    expect(view.pins[1]).toEqual({ mark: '≠', path: `${DIR}/plan.md`, pinned: shortHash(sha256(PLAN)), now: shortHash(sha256(changed)), how: 'content' });
    expect(view.pins[0]?.mark).toBe('=');
    expect(view.restore).toBe('omni approval restore 918');
    expect(view.canApprove).toBe(true);
  });

  it('says `whitespace only` when the approved text differs in spacing alone', () => {
    const view = attestationOf(facts(), IRISA, HEAD, at({ [`${DIR}/spec.md`]: SPEC, [`${DIR}/plan.md`]: `${PLAN}\n\n` }), []);
    expect(view.pins[1]?.how).toBe('whitespace only');
    expect(view.line).toBe('plan.md changed at head 7d3e9a1 · whitespace only');
  });

  it('marks a pinned file the head lacks as missing', () => {
    const view = attestationOf(facts(), IRISA, HEAD, at({ [`${DIR}/spec.md`]: SPEC }), []);
    expect(view.pins[1]).toMatchObject({ mark: '≠', now: 'missing', how: 'missing' });
  });

  it('gives no Approve again to a member the product does not ask', () => {
    const view = attestationOf(facts(), ADA, HEAD, at({ [`${DIR}/spec.md`]: 'changed', [`${DIR}/plan.md`]: PLAN }), []);
    expect(view.canApprove).toBe(false);
    expect(view.approvesAgain).toBe('a Mobile approver');
  });

  it('reads a void as drifted whatever the head holds, naming the push and its hashes', () => {
    const voided: ApprovalVoid = {
      approval_id: 'approval-1', kind: 'plan', from_sha256: 'a'.repeat(64), to_sha256: 'b'.repeat(64), pusher_login: 'ada', voided_at: '2026-10-09T09:00:00Z',
    };
    const view = attestationOf(facts({ voids: [voided] }), IRISA, null, { kind: 'unread' }, []);
    expect(view.verdict).toBe('drifted');
    expect(view.pins[1]).toEqual({ mark: '≠', path: `${DIR}/plan.md`, pinned: 'aaaa…aaaa', now: 'bbbb…bbbb', how: 'voided by ada\'s push' });
    expect(view.line).toBe('plan.md voided by ada\'s push');
  });

  it('ignores a void of an earlier approval', () => {
    const old: ApprovalVoid = {
      approval_id: 'approval-0', kind: 'plan', from_sha256: 'a'.repeat(64), to_sha256: 'b'.repeat(64), pusher_login: 'ada', voided_at: '2026-10-01T09:00:00Z',
    };
    expect(attestationOf(facts({ voids: [old] }), IRISA, HEAD, matching, []).verdict).toBe('approved');
  });
});

describe('the attestation of a PRD nobody approved', () => {
  it('waits, with no approver, no pinned file and no fix', () => {
    const view = attestationOf(facts({ approval: null, approvedBy: null }), ADA, HEAD, { kind: 'unread' }, [target]);
    expect(view).toMatchObject({ verdict: 'waiting', title: 'Waits for approval', line: 'Nobody approved PRD 918 yet.', approver: null, who: null, pins: [], restore: null });
    expect(view.targets).toEqual([{ ...target, state: 'waiting' }]);
  });
});

describe('a held attestation', () => {
  it('holds when no head is named, every file `?`', () => {
    const view = attestationOf(facts(), ADA, null, { kind: 'unread' }, null);
    expect(view.verdict).toBe('held');
    expect(view.title).toBe('Held · not failed');
    expect(view.line).toBe('No head named: open this page from a pull request\'s omni/approved check.');
    expect(view.pins.map((p) => p.mark)).toEqual(['?', '?']);
    expect(view.targets).toBe('unread');
  });

  it('holds when GitHub could not read the head', () => {
    const view = attestationOf(facts(), ADA, HEAD, { kind: 'unread' }, []);
    expect(view.line).toBe('Head 7d3e9a1 could not be read on GitHub: held, not failed.');
    expect(view.pins.every((p) => p.mark === '?')).toBe(true);
  });

  it('holds when the approver left the workspace', () => {
    const view = attestationOf(facts({ members: [ADA] }), ADA, HEAD, matching, []);
    expect(view.verdict).toBe('held');
    expect(view.line).toBe('irisa is no longer a member of the workspace: held, not failed.');
    expect(view.who).toContain('not a member of vertuoza ✗');
  });
});

describe('the head a query names', () => {
  it('is a commit sha, else none', () => {
    expect(headOf('7D3E9A1')).toBe('7d3e9a1');
    expect(headOf(HEAD)).toBe(HEAD);
    expect(headOf('main')).toBeNull();
    expect(headOf('7d3e')).toBeNull();
    expect(headOf(undefined)).toBeNull();
  });
});

describe('reading the attestation', () => {
  const github = () => ({
    headFiles: vi.fn<NonNullable<AttestationPorts['github']>['headFiles']>(() => Promise.resolve(matching)),
    targets: vi.fn<NonNullable<AttestationPorts['github']>['targets']>(() => Promise.resolve([target])),
  });

  it('reads the pinned paths at the head in the home repository, and the targets in the product\'s other repositories', async () => {
    const gh = github();
    const read = await readAttestation({ facts: () => Promise.resolve(facts()), github: gh }, DOSSIER, ADA, HEAD);
    expect(gh.headFiles).toHaveBeenCalledWith('vertuoza/mobile-plan', HEAD, [`${DIR}/spec.md`, `${DIR}/plan.md`]);
    expect(gh.targets).toHaveBeenCalledWith(['vertuoza/vertuo-api'], 'vertuoza/mobile-plan', PRD);
    expect(read.kind === 'attestation' && read.attestation.verdict).toBe('approved');
  });

  it('reads no file without a head, and holds without GitHub', async () => {
    const gh = github();
    await readAttestation({ facts: () => Promise.resolve(facts()), github: gh }, DOSSIER, ADA, null);
    expect(gh.headFiles).not.toHaveBeenCalled();
    const read = await readAttestation({ facts: () => Promise.resolve(facts()), github: null }, DOSSIER, ADA, HEAD);
    expect(read.kind === 'attestation' && read.attestation.verdict).toBe('held');
  });

  it('says not found, and sends a PRD approved in its repository to its page', async () => {
    expect(await readAttestation({ facts: () => Promise.resolve('not-found'), github: null }, DOSSIER, ADA, HEAD)).toEqual({ kind: 'not-found' });
    expect(await readAttestation({ facts: () => Promise.resolve({ repoBorn: PRD }), github: null }, DOSSIER, ADA, HEAD))
      .toEqual({ kind: 'repo-born', prd: PRD, page: `/prd/${DOSSIER}` });
  });
});
