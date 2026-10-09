// The approval in force against the tree being read (PRD 1299, s4): the five states, their lines,
// files paired by kind (so a folder `omni ship` moved still matches), and a drift told apart as
// content, whitespace only or missing.
import { rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { sha256 } from '../dossier/folder.ts';
import { AskCallError } from '../ask/client.ts';
import { parsePrd } from '../ids.ts';
import { failedReading, judgeApproval, parseApprovalReply, readApproval, treeFileOf } from './approval.ts';

const PRD = parsePrd(1299);
const URL_ = 'https://omni.test/prd/acme/widgets/1299';
const SPEC = '---\nprd: 1299\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const PLAN = '# Plan\n\n| id | slice |\n';
const PAGE = '<html>before after</html>\n';
const INBOX = '.omni-loop/delivery/inbox/1299-server-approval';
const SHIPPED = '.omni-loop/delivery/shipped/1299-server-approval';

const pinned = (kind: string, path: string, content: string, extra: Record<string, unknown> = {}) =>
  ({ kind, path, sha256: sha256(content), versionId: `v-${kind}`, ...extra });

const PINNED = [pinned('spec', `${INBOX}/spec.md`, SPEC), pinned('plan', `${INBOX}/plan.md`, PLAN), pinned('before-after', `${INBOX}/before-after.html`, PAGE)];

const reply = (approval: unknown = { approver: { login: 'ada', member: true }, approvedAt: '2026-10-09T10:00:00Z', files: PINNED }) =>
  ({ url: URL_, approval });

function repo(files: Record<string, string> = {}, dir = INBOX) {
  return makeRepo({ files: { [`${dir}/spec.md`]: SPEC, [`${dir}/plan.md`]: PLAN, [`${dir}/before-after.html`]: PAGE, ...files } });
}

describe('parseApprovalReply', () => {
  it('reads the approval in force, and a dossier with none yet', () => {
    expect(parseApprovalReply(reply())).toEqual(reply());
    expect(parseApprovalReply({ url: URL_, approval: null })).toEqual({ url: URL_, approval: null });
  });

  it('keeps a pinned file\'s content when the server sends it', () => {
    const files = [pinned('plan', 'p/plan.md', PLAN, { content: PLAN })];
    expect(parseApprovalReply(reply({ approver: { login: 'ada', member: true }, approvedAt: 't', files }))?.approval?.files).toEqual(files);
  });

  it('refuses anything else', () => {
    expect(parseApprovalReply(null)).toBeNull();
    expect(parseApprovalReply({ approval: null })).toBeNull();
    expect(parseApprovalReply({ url: URL_ })).toBeNull();
    expect(parseApprovalReply(reply({ approver: { login: 'ada' }, approvedAt: 't', files: [] }))).toBeNull();
    expect(parseApprovalReply(reply({ approver: { login: 'ada', member: true }, approvedAt: 't', files: [{ kind: 'plan' }] }))).toBeNull();
  });
});

describe('judgeApproval', () => {
  it('is approved when the approver is a member and every pinned file matches', () => {
    const { ctx } = repo();
    const reading = judgeApproval(ctx, PRD, reply());
    expect(reading).toMatchObject({ state: 'approved', lines: ['approved by ada · 2026-10-09T10:00:00Z'], url: URL_, drift: [] });
    expect(reading.approval?.files).toHaveLength(3);
  });

  it('pairs files by kind, so a folder moved to shipped still matches', () => {
    const { ctx } = repo({}, SHIPPED);
    expect(judgeApproval(ctx, PRD, reply()).state).toBe('approved');
  });

  it('is pending with the dossier link when nothing is approved yet', () => {
    const { ctx } = repo();
    expect(judgeApproval(ctx, PRD, reply(null))).toMatchObject({
      state: 'pending', lines: ['PRD 1299 waits for approval: https://omni.test/prd/acme/widgets/1299'], approval: null,
    });
  });

  it('is refused when the approver is no longer a workspace member, before any file is compared', () => {
    const { ctx } = repo({ [`${INBOX}/plan.md`]: 'changed' });
    expect(judgeApproval(ctx, PRD, reply({ approver: { login: 'ada', member: false }, approvedAt: 't', files: PINNED }))).toMatchObject({
      state: 'refused', lines: ['approver ada is not a workspace member'], drift: [],
    });
  });

  it('is drifted when a pinned file changed, saying content', () => {
    const { ctx } = repo({ [`${INBOX}/plan.md`]: `${PLAN}| s9 | more |\n` });
    expect(judgeApproval(ctx, PRD, reply())).toMatchObject({
      state: 'drifted',
      lines: ['≠ plan.md · content · ✗ refuse · restore it, or approve again: https://omni.test/prd/acme/widgets/1299'],
      drift: [{ kind: 'plan', file: `${INBOX}/plan.md`, how: 'content' }],
    });
  });

  it('says whitespace only when the server sent the approved text and only spacing differs, and still refuses', () => {
    const { ctx } = repo({ [`${INBOX}/plan.md`]: `${PLAN}\n\n` });
    const files = [pinned('plan', `${INBOX}/plan.md`, PLAN, { content: PLAN })];
    const reading = judgeApproval(ctx, PRD, reply({ approver: { login: 'ada', member: true }, approvedAt: 't', files }));
    expect(reading.state).toBe('drifted');
    expect(reading.lines).toEqual(['≠ plan.md · whitespace only · ✗ refuse · restore it, or approve again: https://omni.test/prd/acme/widgets/1299']);
  });

  it('says content when the approved text the server sent differs beyond spacing', () => {
    const { ctx } = repo({ [`${INBOX}/plan.md`]: 'another plan' });
    const files = [pinned('plan', `${INBOX}/plan.md`, PLAN, { content: PLAN })];
    expect(judgeApproval(ctx, PRD, reply({ approver: { login: 'ada', member: true }, approvedAt: 't', files })).drift).toEqual([
      { kind: 'plan', file: `${INBOX}/plan.md`, how: 'content' },
    ]);
  });

  it('is drifted when a pinned file is missing, one line per file', () => {
    const { ctx, root } = repo();
    rmSync(`${root}/${INBOX}/before-after.html`);
    const reading = judgeApproval(ctx, PRD, reply({
      approver: { login: 'ada', member: true }, approvedAt: 't',
      files: [...PINNED, pinned('voice', `${INBOX}/voice.json`, '{}')],
    }));
    expect(reading.state).toBe('drifted');
    expect(reading.lines).toEqual([
      '≠ before-after.html · missing · ✗ refuse · restore it, or approve again: https://omni.test/prd/acme/widgets/1299',
      '≠ voice.json · missing · ✗ refuse · restore it, or approve again: https://omni.test/prd/acme/widgets/1299',
    ]);
  });

  it('reads a kind the folder does not keep (a scenario) at its pinned path', () => {
    const scenario = 'Feature: approve\n';
    const path = 'features/approve.feature';
    const { ctx } = repo({ [path]: scenario });
    const files = [...PINNED, pinned('scenario', path, scenario)];
    expect(judgeApproval(ctx, PRD, reply({ approver: { login: 'ada', member: true }, approvedAt: 't', files })).state).toBe('approved');
  });

  it('is drifted for every pinned file when the PRD has no folder at all', () => {
    const { ctx } = makeRepo();
    expect(judgeApproval(ctx, PRD, reply()).drift.map((d) => d.how)).toEqual(['missing', 'missing', 'missing']);
  });
});

describe('treeFileOf', () => {
  it('names the layout\'s file for a kind the folder keeps, and the pinned path for any other', () => {
    const { ctx } = repo({}, SHIPPED);
    expect(treeFileOf(ctx, PRD, { kind: 'plan', path: `${INBOX}/plan.md` })).toBe(`${SHIPPED}/plan.md`);
    expect(treeFileOf(ctx, PRD, { kind: 'voice', path: `${INBOX}/voice.json` })).toBe(`${SHIPPED}/voice.json`);
    expect(treeFileOf(ctx, PRD, { kind: 'scenario', path: 'features/a.feature' })).toBe('features/a.feature');
  });

  it('falls back to the pinned path when the PRD has no folder', () => {
    const { ctx } = makeRepo();
    expect(treeFileOf(ctx, PRD, { kind: 'plan', path: `${INBOX}/plan.md` })).toBe(`${INBOX}/plan.md`);
  });
});

describe('failedReading', () => {
  it('holds an unanswered call as unreachable, never failed', () => {
    expect(failedReading(new AskCallError('GET x: timed out'))).toMatchObject({
      state: 'unreachable', lines: ['server unreachable · held, not failed'], url: null, approval: null, drift: [],
    });
  });

  it('refuses an error the page answered, naming its status', () => {
    expect(failedReading(new AskCallError('GET x: 404', { status: 404 }))).toMatchObject({ state: 'refused', lines: ['refused (404)'] });
    expect(failedReading(new AskCallError('GET x: sign-in refused', { status: 401 }))).toMatchObject({ state: 'refused', lines: ['refused (401)'] });
  });

  it('throws anything that is not a failed call', () => {
    expect(() => failedReading(new Error('boom'))).toThrow('boom');
  });
});

describe('readApproval', () => {
  it('judges the reply the call answered', async () => {
    const { ctx } = repo();
    expect((await readApproval(ctx, PRD, async () => reply())).state).toBe('approved');
  });

  it('refuses a reply that is not an approval', async () => {
    const { ctx } = repo();
    expect(await readApproval(ctx, PRD, async () => ({ nope: true }))).toMatchObject({ state: 'refused', lines: ['refused (malformed reply)'] });
  });

  it('holds a call that failed to answer, and refuses one the page refused', async () => {
    const { ctx } = repo();
    expect((await readApproval(ctx, PRD, async () => { throw new AskCallError('down'); })).state).toBe('unreachable');
    expect((await readApproval(ctx, PRD, async () => { throw new AskCallError('no', { status: 500 }); })).lines).toEqual(['refused (500)']);
  });
});
