import { describe, expect, it } from 'vitest';
import type { Channels } from '../notify/notify';
import { voidReachRepository, voidRepository } from './void.repository';
import { tellVoids, type TellDeps } from './void.service';

// Telling an approver their approval is voided (PRD 1322 s6), on a stubbed database and fake channels:
// which functions it calls with what, one message per push naming the pusher and each changed kind,
// nothing sent when the push voided nothing, and every failure a log line, never a throw.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const VOID_PLAN = '22222222-2222-4222-8222-222222222222';
const VOID_SPEC = '33333333-3333-4333-8333-333333333333';
const IRISA = '00000000-0000-4000-8000-0000000000a4';

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

function stub(answers: Record<string, Raw | Error>) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    db: {
      rpc(fn: string, args: Record<string, unknown>): PromiseLike<Raw> {
        calls.push({ fn, args });
        const answer = answers[fn] ?? { data: null, error: { code: 'P0001', message: `no stub for ${fn}` } };
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
      },
    },
  };
}

const voidOf = (id: string, kind: string, from: string, to: string) => ({
  id, dossier: DOSSIER, repo: 'acme/mobile', prd: 7, title: 'Team inbox', kind, from: from.repeat(64), to: to.repeat(64),
  pusher: 'ada-gh', approver: 'irisa',
});

const REACHED = [{ user: IRISA, email: 'irisa@acme.test', devices: [{ id: VOID_PLAN, endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a' }] }];

function world(answers: Record<string, Raw | Error>, { reach = true } = {}) {
  const caller = stub(answers);
  const service = stub(answers);
  const pushed: Array<{ endpoint: string; payload: string }> = [];
  const emailed: Array<{ to: string; subject: string; text: string; html: string }> = [];
  const contacts: string[] = [];
  const lines: string[] = [];
  const channels = (contact: string): Channels => {
    contacts.push(contact);
    return {
      push: (device, payload) => { pushed.push({ endpoint: device.endpoint, payload }); return Promise.resolve('sent'); },
      email: (email) => { emailed.push(email); return Promise.resolve(true); },
      forget: () => Promise.resolve(),
    };
  };
  const deps: TellDeps = {
    voids: voidRepository(caller.db),
    reach: reach ? voidReachRepository(service.db) : null,
    channels,
    log: (line) => { lines.push(line); },
  };
  return { deps, caller, service, pushed, emailed, contacts, lines, tell: () => tellVoids(deps, DOSSIER, 'https://omni.example') };
}

describe('tellVoids', () => {
  it('reaches the approver once by push and email, naming the pusher and each changed kind', async () => {
    const w = world({
      approval_voids_of_push: { data: [voidOf(VOID_SPEC, 'spec', 'a', 'b'), voidOf(VOID_PLAN, 'plan', 'c', 'd')], error: null },
      approval_void_recipients: { data: REACHED, error: null },
    });
    await w.tell();
    expect(w.caller.calls).toEqual([{ fn: 'approval_voids_of_push', args: { p_dossier: DOSSIER } }]);
    expect(w.service.calls).toEqual([{ fn: 'approval_void_recipients', args: { p_void: VOID_SPEC } }]);
    expect(w.contacts).toEqual(['https://omni.example']);
    expect(w.pushed).toHaveLength(1);
    expect(JSON.parse(w.pushed[0]?.payload ?? '')).toEqual({
      title: "approval voided by ada-gh's push",
      body: 'PRD 7 · Team inbox\nspec aaaaaaa→bbbbbbb · plan ccccccc→ddddddd',
      url: `/prd/${DOSSIER}`,
    });
    expect(w.emailed).toHaveLength(1);
    expect(w.emailed[0]).toMatchObject({ to: 'irisa@acme.test', subject: "PRD 7: approval voided by ada-gh's push" });
    expect(w.emailed[0]?.text).toContain('spec aaaaaaa→bbbbbbb');
    expect(w.emailed[0]?.text).toContain(`Open it to approve again: https://omni.example/prd/${DOSSIER}`);
    expect(w.emailed[0]?.html).toContain('approval voided by ada-gh&#39;s push');
    expect(w.lines).toEqual([]);
  });

  it('sends nothing when the push voided nothing', async () => {
    const w = world({ approval_voids_of_push: { data: [], error: null } });
    await w.tell();
    expect(w.service.calls).toEqual([]);
    expect([w.pushed, w.emailed, w.lines]).toEqual([[], [], []]);
  });

  it('logs, and sends nothing, when the voids cannot be read or come out of shape', async () => {
    const refused = world({ approval_voids_of_push: { data: null, error: { code: '42501', message: 'Sign in first.' } } });
    await refused.tell();
    expect(refused.lines).toEqual([`approvals: the voids of a push of dossier ${DOSSIER} could not be read: Sign in first.`]);
    const odd = world({ approval_voids_of_push: { data: [{ ...voidOf(VOID_PLAN, 'plan', 'a', 'b'), from: 'short' }], error: null } });
    await odd.tell();
    expect(odd.lines).toEqual([`approvals: the voids of a push of dossier ${DOSSIER} could not be read: approval_voids_of_push() answered out of shape`]);
    expect(odd.pushed).toEqual([]);
  });

  it('logs without a service key, or when the approver\'s channels cannot be read', async () => {
    const voided = { approval_voids_of_push: { data: [voidOf(VOID_PLAN, 'plan', 'a', 'b')], error: null } };
    const keyless = world(voided, { reach: false });
    await keyless.tell();
    expect(keyless.lines).toEqual(["approvals: PRD #7 of acme/mobile's approval is voided, but irisa is not told: SUPABASE_SERVICE_ROLE_KEY is not set"]);
    const unread = world({ ...voided, approval_void_recipients: { data: null, error: {} } });
    await unread.tell();
    expect(unread.lines).toEqual(['approvals: how irisa is reached could not be read: the database failed']);
    expect([...keyless.pushed, ...unread.pushed, ...unread.emailed]).toEqual([]);
  });

  it('never throws: a failed call is a log line', async () => {
    const w = world({ approval_voids_of_push: new Error('connection reset') });
    await expect(w.tell()).resolves.toBeUndefined();
    expect(w.lines).toEqual([`approvals: telling the approver of dossier ${DOSSIER}'s void failed: connection reset`]);
  });
});
