// The briefing's files (PRD 1793, s1): the form at its own path, its `points-to` file, each
// section's `See:` file, read at `ctx.root`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formText, testContext } from '../../test/fixture.ts';
import { briefingFiles, briefingPath, isBriefingFile } from './briefing-files.ts';

const BRIEFING = '.omni-loop/knowledge/playbook/briefing.md';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function repo(files: Record<string, string>, overrides: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'briefing-files-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return testContext(root, overrides);
}

const briefing = ({ frontMatter = {}, body = '- Never merge.' }: { frontMatter?: Record<string, unknown>; body?: string } = {}) =>
  formText({ frontMatter: { form: 'briefing', state: 'filled', ...frontMatter }, title: 'Briefing', slots: [{ id: 'never', required: true, body }] });

describe('briefingPath', () => {
  it('is the briefing form under paths.playbook, the default and a custom one', () => {
    expect(briefingPath({ ctx: repo({}) })).toBe(BRIEFING);
    expect(briefingPath({ ctx: repo({}, { paths: { playbook: 'handbook/how-we-work' } }) })).toBe('handbook/how-we-work/briefing.md');
  });
});

describe('briefingFiles', () => {
  it('is the form alone when it points nowhere, or is missing', () => {
    expect(briefingFiles({ ctx: repo({ [BRIEFING]: briefing() }) })).toEqual([BRIEFING]);
    expect(briefingFiles({ ctx: repo({}) })).toEqual([BRIEFING]);
  });

  it("adds a pointer form's points-to file", () => {
    const ctx = repo({ [BRIEFING]: briefing({ frontMatter: { state: 'pointer', 'points-to': 'docs/agents/rules.md' }, body: '' }) });
    expect(briefingFiles({ ctx })).toEqual([BRIEFING, 'docs/agents/rules.md']);
  });

  it("adds each section's See: file, its anchor dropped, once", () => {
    const ctx = repo({ [BRIEFING]: briefing({ body: 'See: ./docs/README.md#never' }) });
    expect(briefingFiles({ ctx })).toEqual([BRIEFING, 'docs/README.md']);
  });

  it('reads no pointer from a briefing that does not parse', () => {
    expect(briefingFiles({ ctx: repo({ [BRIEFING]: 'no front matter\nSee: docs/README.md\n' }) })).toEqual([BRIEFING]);
  });
});

describe('isBriefingFile', () => {
  it('matches a file exactly, and a path under a folder the briefing points to', () => {
    const files = [BRIEFING, 'docs/agents'];
    expect(isBriefingFile(BRIEFING, files)).toBe(true);
    expect(isBriefingFile('docs/agents/never.md', files)).toBe(true);
    expect(isBriefingFile('docs/agents-old.md', files)).toBe(false);
    expect(isBriefingFile('.omni-loop/knowledge/playbook/testing.md', files)).toBe(false);
  });
});
