// PRD 1890, slice s5: `omni check agents`, and `omni check all` running it, through `main()` on a
// fixture repository.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncAgentSkills } from '../lib/agents/write.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const SKILLS: Record<string, string> = {
  'yolo/SKILL.md': '---\nname: yolo\ndescription: Build a whole PRD.\n---\n\n# Yolo\n',
  'wave/SKILL.md': '---\nname: wave\ndescription: One wave.\n---\n\n# Wave\n',
};
const REWRITE = 'run omni update to rewrite the copies';

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

/** A fixture repository whose config lists `agents`, the copies installed when `install` is set. */
function repo(agents: string | null, install = true): string {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': agents === null ? HEAD : `${HEAD}agents: ${agents}\n` } });
  if (install) syncAgentSkills({ root, agents: ['codex'], version: '0.0.404', skills: SKILLS });
  return root;
}

describe('omni check agents', () => {
  it('is green on copies that match the manifest', async () => {
    expect(await omni(repo('[claude, codex]'), ['check', 'agents'])).toEqual({
      code: 0,
      out: 'check agents — 2 folder(s), 2 file(s), every copy as omni wrote it.\n',
      err: '',
    });
  });

  it('is green with agents [claude] (the default) and no manifest', async () => {
    expect(await omni(repo(null, false), ['check', 'agents'])).toEqual({
      code: 0,
      out: 'check agents — agents lists claude alone; no copies to check.\n',
      err: '',
    });
  });

  it('is red on a hand-edited copy, naming it and omni update', async () => {
    const root = repo('[codex]');
    writeFileSync(join(root, '.agents/skills/omni-yolo/SKILL.md'), 'mine now\n');
    const { code, out } = await omni(root, ['check', 'agents']);
    expect(code).toBe(1);
    expect(out).toContain('check agents — a skill copy does not hold what omni wrote:');
    expect(out).toContain(`  .agents/skills/omni-yolo/SKILL.md: edited by hand, it no longer matches .omni-loop/agents.json — ${REWRITE}\n`);
  });

  it('is red on a missing copy', async () => {
    const root = repo('[cursor]');
    rmSync(join(root, '.agents/skills/omni-wave/SKILL.md'));
    const { code, out } = await omni(root, ['check', 'agents']);
    expect(code).toBe(1);
    expect(out).toContain(`  .agents/skills/omni-wave/SKILL.md: missing — ${REWRITE}\n`);
  });

  it('is red when a non-Claude agent is listed but the copies were never installed', async () => {
    const { code, out } = await omni(repo('[claude, gemini]', false), ['check', 'agents']);
    expect(code).toBe(1);
    expect(out).toContain(`  .omni-loop/agents.json: missing, but agents lists gemini — the skills were never installed for them; ${REWRITE}\n`);
  });

  it('is run by omni check all, which goes red on a hand-edited copy', async () => {
    const green = await omni(repo('[codex]'), ['check', 'all']);
    expect(green.code).toBe(0);
    expect(green.out).toMatch(/^check agents — 2 folder\(s\), 2 file\(s\), every copy as omni wrote it\.$/m);

    const red = repo('[codex]');
    writeFileSync(join(red, '.agents/skills/omni-wave/SKILL.md'), 'mine\n');
    const refused = await omni(red, ['check', 'all']);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain(`  .agents/skills/omni-wave/SKILL.md: edited by hand`);
  });

  it('names agents among the guards in its usage', async () => {
    const { code, err } = await omni(repo(null, false), ['check', 'nope']);
    expect(code).toBe(2);
    expect(err).toMatch(/omni check \[[^\]]*\|agents\|/);
  });
});
