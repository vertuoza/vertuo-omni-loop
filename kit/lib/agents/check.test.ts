// PRD 1890, slice s5: the grade of `.agents/skills/omni-*` against the manifest that owns them.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gradeAgents, REWRITE_LINE } from './check.ts';
import { AGENTS_MANIFEST, syncAgentSkills } from './write.ts';

const SKILLS: Record<string, string> = {
  'yolo/SKILL.md': '---\nname: yolo\ndescription: Build a whole PRD.\n---\n\n# Yolo\n',
  'pixel-perfect/SKILL.md': '---\nname: pixel-perfect\ndescription: Screens.\n---\n\nRead [review](reference/review.md).\n',
  'pixel-perfect/reference/review.md': '# Review\n',
};

function tempRepo(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'omni-agents-check-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** A repository the writer installed for `agents`. */
function installed(agents: string[] = ['codex']): string {
  const root = tempRepo();
  syncAgentSkills({ root, agents, version: '0.0.404', skills: SKILLS });
  return root;
}

describe('gradeAgents', () => {
  it('is green when every owned file matches its hash', () => {
    const grade = gradeAgents({ root: installed(), agents: ['codex'] });
    expect(grade.violations).toEqual([]);
    expect(grade.files).toBe(3);
    expect(grade.folders).toBe(2);
  });

  it('is green with agents [claude] and no manifest: nothing installed, nothing to grade', () => {
    const grade = gradeAgents({ root: tempRepo(), agents: ['claude'] });
    expect(grade).toEqual({ violations: [], folders: 0, files: 0, installed: false });
  });

  it('is red on a hand-edited copy, naming it and omni update', () => {
    const root = installed();
    writeFileSync(join(root, '.agents/skills/omni-yolo/SKILL.md'), 'edited by hand\n');
    const { violations } = gradeAgents({ root, agents: ['codex'] });
    expect(violations).toEqual([`.agents/skills/omni-yolo/SKILL.md: edited by hand, it no longer matches ${AGENTS_MANIFEST} — ${REWRITE_LINE}`]);
    expect(REWRITE_LINE).toBe('run omni update to rewrite the copies');
  });

  it('is red on a missing copy, naming it', () => {
    const root = installed();
    rmSync(join(root, '.agents/skills/omni-pixel-perfect/reference/review.md'));
    const { violations } = gradeAgents({ root, agents: ['cursor'] });
    expect(violations).toEqual([`.agents/skills/omni-pixel-perfect/reference/review.md: missing — ${REWRITE_LINE}`]);
  });

  it('names every file that moved, in path order', () => {
    const root = installed();
    rmSync(join(root, '.agents/skills/omni-yolo/SKILL.md'));
    writeFileSync(join(root, '.agents/skills/omni-pixel-perfect/SKILL.md'), 'x');
    const { violations } = gradeAgents({ root, agents: ['codex'] });
    expect(violations.map((line) => line.split(':')[0])).toEqual(['.agents/skills/omni-pixel-perfect/SKILL.md', '.agents/skills/omni-yolo/SKILL.md']);
  });

  it('is red when a non-Claude agent is listed and no manifest exists, naming the agents', () => {
    const { violations } = gradeAgents({ root: tempRepo(), agents: ['claude', 'codex', 'gemini'] });
    expect(violations).toEqual([`${AGENTS_MANIFEST}: missing, but agents lists codex, gemini — the skills were never installed for them; ${REWRITE_LINE}`]);
  });

  it('is red, not a crash, on a manifest it cannot trust', () => {
    const root = tempRepo({ [AGENTS_MANIFEST]: 'not json' });
    const { violations } = gradeAgents({ root, agents: ['codex'] });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/^\.omni-loop\/agents\.json is not the manifest omni writes/);
  });

  it('leaves a foreign skill beside the copies alone', () => {
    const root = installed();
    writeFileSync(join(root, '.agents/skills/omni-yolo/NOTES.md'), 'mine\n');
    mkdirSync(join(root, '.agents/skills/my-skill'), { recursive: true });
    writeFileSync(join(root, '.agents/skills/my-skill/SKILL.md'), 'mine\n');
    expect(gradeAgents({ root, agents: ['codex'] }).violations).toEqual([]);
  });

  it('grades the copies a manifest still owns after agents went back to [claude]', () => {
    const root = installed();
    expect(gradeAgents({ root, agents: ['claude'] }).violations).toEqual([]);
    writeFileSync(join(root, '.agents/skills/omni-yolo/SKILL.md'), 'edited\n');
    expect(gradeAgents({ root, agents: ['claude'] }).violations).toHaveLength(1);
  });
});
