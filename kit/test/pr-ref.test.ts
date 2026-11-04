// PRD 2648, slice s2: `/omni:pr` titles a feature, landing or standalone pull request that has an issue with
// what `omni ref` prints, at point `pr.open`: through `gh pr create` with no `replace`, through `gh pr edit
// --title` after a `replace` opened it. A sub-PR's claim never runs `omni ref`. Read from the skill's text.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SKILL = readFileSync(new URL('../plugin/skills/pr/SKILL.md', import.meta.url), 'utf8');
const GUIDE = readFileSync(new URL('../../docs/guide/flow.md', import.meta.url), 'utf8');

/** The part of `text` from the heading `## <name>` to the next `## `. */
function section(text: string, name: string): string {
  const start = text.indexOf(`\n## ${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

describe('/omni:pr titles a pull request with its issue\'s external reference', () => {
  const opening = section(SKILL, 'Opening: point `pr.open`');

  it('runs omni ref on the title for a feature, landing or standalone pull request with an issue', () => {
    expect(opening).toMatch(/omni\.mjs ref <issue> --title "<title>"/);
    expect(opening).toMatch(/feature, landing or standalone/);
    expect(opening).toMatch(/`--issue`/);
  });

  it('passes the printed title to gh pr create when there is no replace', () => {
    expect(opening).toMatch(/title[^\n]*`gh pr create`/);
  });

  it('after a replace, sets the title with gh pr edit when it differs, and adds the link line to the body', () => {
    expect(opening).toMatch(/gh pr edit <n> --title/);
    expect(opening).toMatch(/differs/);
    expect(opening).toMatch(/link[^\n]*line[^\n]*omni ref|omni ref[^\n]*link[^\n]*line/i);
  });

  it('opens with the title unchanged and says so when omni ref exits 1', () => {
    expect(opening).toMatch(/exiting 1/);
    expect(opening).toMatch(/unchanged/);
  });

  it('never runs omni ref for a sub-PR\'s claim', () => {
    expect(opening).toMatch(/sub-PR[^\n]*never[^\n]*omni ref|omni ref[^\n]*never[^\n]*sub-PR/i);
  });

  it('the guide documents the marker, pr.ref and omni ref beside pr.openWith', () => {
    expect(GUIDE).toContain('<!-- omni-ref: <ref> -->');
    expect(GUIDE).toMatch(/pr\.ref/);
    expect(GUIDE).toMatch(/omni ref/);
  });
});
