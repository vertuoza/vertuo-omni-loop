// `restoreDrift` (PRD 1612, s1): each drifted file written back from the pinned version's content the
// server sent, after checking it hashes to its sha256; one line per file; a version it cannot read, or
// one that does not hash, says approve again and writes nothing for that file.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { sha256 } from '../dossier/folder.ts';
import { parsePrd } from '../ids.ts';
import { readApproval } from './approval.ts';
import { checkoutWriter, restoreDrift } from './restore.ts';

const PRD = parsePrd(1612);
const URL_ = 'https://omni.test/prd/acme/widgets/1612';
const INBOX = '.omni-loop/delivery/inbox/1612-approved-gate';
const SPEC = '---\nprd: 1612\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const PLAN = '# Plan\n\n| id | slice |\n';

const pinned = (kind: string, content: string, extra: Record<string, unknown> = {}) =>
  ({ kind, path: `${INBOX}/${kind === 'spec' ? 'spec.md' : 'plan.md'}`, sha256: sha256(content), versionId: `v-${kind}`, content, ...extra });

const reply = (files: unknown[], more: Record<string, unknown> = {}) =>
  ({ url: URL_, approval: { approver: { login: 'ada', member: true }, approvedAt: 't', files, ...more } });

async function restore(tree: Record<string, string>, body: unknown) {
  const { ctx, read } = makeRepo({ files: tree });
  const reading = await readApproval(ctx, PRD, () => Promise.resolve(body));
  return { result: restoreDrift(reading, checkoutWriter(ctx, PRD)), read, again: await readApproval(ctx, PRD, () => Promise.resolve(body)) };
}

describe('restoreDrift', () => {
  it('writes each drifted file back to its pinned content, one line per file, and the judge reads approved again', async () => {
    const { result, read, again } = await restore(
      { [`${INBOX}/spec.md`]: `${SPEC}\n\n`, [`${INBOX}/plan.md`]: 'another plan' },
      reply([pinned('spec', SPEC), pinned('plan', PLAN)]),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        `restored ${INBOX}/spec.md · whitespace only · sha256 ${sha256(SPEC).slice(0, 7)}`,
        `restored ${INBOX}/plan.md · content · sha256 ${sha256(PLAN).slice(0, 7)}`,
      ],
    });
    expect(read(`${INBOX}/spec.md`)).toBe(SPEC);
    expect(read(`${INBOX}/plan.md`)).toBe(PLAN);
    expect(again.state).toBe('approved');
  });

  it('writes back a missing file', async () => {
    const { result, read } = await restore({ [`${INBOX}/spec.md`]: SPEC }, reply([pinned('spec', SPEC), pinned('plan', PLAN)]));
    expect(result.lines).toEqual([`restored ${INBOX}/plan.md · missing · sha256 ${sha256(PLAN).slice(0, 7)}`]);
    expect(read(`${INBOX}/plan.md`)).toBe(PLAN);
  });

  it('refuses a version whose content does not hash to its sha256, and writes nothing for it', async () => {
    const { result, read } = await restore(
      { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: 'another plan' },
      reply([pinned('spec', SPEC), pinned('plan', PLAN, { content: 'tampered' })]),
    );
    expect(result).toEqual({
      ok: false,
      lines: [`refused ${INBOX}/plan.md · the pinned version does not hash to ${sha256(PLAN).slice(0, 7)} · approve again: ${URL_}`],
    });
    expect(read(`${INBOX}/plan.md`)).toBe('another plan');
  });

  it('says approve again when the pinned version cannot be read', async () => {
    const { content: _content, ...unread } = pinned('plan', PLAN);
    const { result, read } = await restore({ [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: 'another plan' }, reply([pinned('spec', SPEC), unread]));
    expect(result).toEqual({ ok: false, lines: [`cannot restore ${INBOX}/plan.md · the pinned version cannot be read · approve again: ${URL_}`] });
    expect(read(`${INBOX}/plan.md`)).toBe('another plan');
  });

  it('cannot restore a voided approval: only approving again does', async () => {
    const voids = [{ pusher: 'ada', kind: 'plan', from: 'a'.repeat(64), to: 'b'.repeat(64), voidedAt: 't' }];
    const { result } = await restore({ [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: PLAN }, reply([pinned('spec', SPEC), pinned('plan', PLAN)], { voids }));
    expect(result).toEqual({ ok: false, lines: [`cannot restore ${INBOX}/plan.md · the approval was voided · approve again: ${URL_}`] });
  });

  it('has nothing to restore when approved, and prints the reading when nothing was judged', async () => {
    const files = { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: PLAN };
    expect((await restore(files, reply([pinned('spec', SPEC), pinned('plan', PLAN)]))).result).toEqual({ ok: true, lines: ['nothing to restore · approved by ada · t'] });
    expect((await restore(files, { url: URL_, approval: null })).result).toEqual({ ok: false, lines: [`PRD 1612 waits for approval: ${URL_}`] });
  });
});
