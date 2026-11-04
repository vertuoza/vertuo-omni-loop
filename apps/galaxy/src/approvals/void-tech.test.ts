import { describe, expect, it } from 'vitest';
import type { Channels } from '../notify/notify';
import { voidReachRepository, voidRepository } from './void.repository';
import { tellVoids } from './void.service';

// A push that voids a PRD's Tech Approval too (PRD 2608 s3): each approver hears once, of their own
// approval, and only a product approval holds an approved label to remove.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const VOID_PRODUCT = '22222222-2222-4222-8222-222222222222';
const VOID_TECH = '55555555-5555-4555-8555-555555555555';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const PAUL = '00000000-0000-4000-8000-0000000000a5';

const voidOf = (id: string, approver: string, approvalKind?: 'product' | 'tech') => ({
  id, dossier: DOSSIER, repo: 'acme/mobile', prd: 7, title: 'Team inbox', kind: 'spec', from: 'a'.repeat(64), to: 'b'.repeat(64),
  pusher: 'ada-gh', approver, ...(approvalKind ? { approvalKind } : {}),
});

const REACHED: Record<string, unknown> = {
  [VOID_PRODUCT]: [{ user: IRISA, email: 'irisa@acme.test', devices: [] }],
  [VOID_TECH]: [{ user: PAUL, email: 'paul@acme.test', devices: [] }],
};

function world(voids: unknown[]) {
  const asked: unknown[] = [];
  const emailed: Array<{ to: string; subject: string }> = [];
  const unlabelled: string[] = [];
  const lines: string[] = [];
  const channels = (): Channels => ({
    push: () => Promise.resolve('sent'),
    email: (email) => { emailed.push(email); return Promise.resolve(true); },
    forget: () => Promise.resolve(),
  });
  const tell = () => tellVoids({
    voids: voidRepository({ rpc: () => Promise.resolve({ data: voids, error: null }) }),
    reach: voidReachRepository({
      rpc: (_fn, args) => {
        asked.push(args);
        return Promise.resolve({ data: REACHED[String(args.p_void)], error: null });
      },
    }),
    channels,
    log: (line) => { lines.push(line); },
    unlabel: (repo, prd) => { unlabelled.push(`${repo}#${Number(prd)}`); return Promise.resolve(); },
  }, DOSSIER, 'https://omni.example');
  return { asked, emailed, unlabelled, lines, tell };
}

describe('tellVoids, a Tech Approval voided too', () => {
  it('reaches each approver once, the named person told of their tech approval', async () => {
    const w = world([voidOf(VOID_PRODUCT, 'irisa', 'product'), voidOf(VOID_TECH, 'paul', 'tech')]);
    await w.tell();
    expect(w.asked).toEqual([{ p_void: VOID_PRODUCT }, { p_void: VOID_TECH }]);
    expect(w.emailed.map((e) => [e.to, e.subject])).toEqual([
      ['irisa@acme.test', "PRD 7: approval voided by ada-gh's push"],
      ['paul@acme.test', "PRD 7: tech approval voided by ada-gh's push"],
    ]);
    expect(w.unlabelled).toEqual(['acme/mobile#7']);
    expect(w.lines).toEqual([]);
  });

  it('removes no approved label when only a tech approval was voided: only a product approval adds one', async () => {
    const w = world([voidOf(VOID_TECH, 'paul', 'tech')]);
    await w.tell();
    expect(w.unlabelled).toEqual([]);
    expect(w.emailed.map((e) => e.to)).toEqual(['paul@acme.test']);
  });

  it('reads a void that names no kind as a product one, as an older database answers', async () => {
    const w = world([voidOf(VOID_PRODUCT, 'irisa')]);
    await w.tell();
    expect(w.unlabelled).toEqual(['acme/mobile#7']);
    expect(w.emailed.map((e) => e.subject)).toEqual(["PRD 7: approval voided by ada-gh's push"]);
  });
});
