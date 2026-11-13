// PRD 2746, slice s3: `/omni:pr`, `/omni:ultra-yolo`, `/omni:mega-bug-fix` and `/omni:mega-pr-care` run
// `omni hold` before `gh pr ready`, follow each probe it names through the point `merge-after.served`,
// keep a held pull request a draft with its waiting line, and raise one high item on a `fail`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe.each(['pr', 'ultra-yolo', 'mega-bug-fix', 'mega-pr-care'])('/omni:%s holds a consumer until its provider is served', (name) => {
  const text = flat(read(name));

  it('runs omni hold, before it marks a pull request ready', () => {
    expect(text).toMatch(/`node \.omni-loop\/bin\/omni\.mjs hold <owner\/repo>#<n> --json`.{0,600}?before (`gh pr ready`|it marks one)/);
  });

  it('follows each probe through the point merge-after.served and its verdict', () => {
    expect(text).toContain('flow show merge-after.served');
    expect(text).toContain('flow verdict merge-after.served');
  });

  it('keeps a held pull request a draft, its status comment saying what it waits for', () => {
    expect(text).toContain('stays a draft');
    expect(text).toContain('`waiting for <owner/repo>#<n> to be served: <why>`');
  });

  it('raises one high outbox item naming both pull requests on a fail', () => {
    expect(text).toMatch(/`fail`.{0,300}?one high outbox item naming both pull requests/);
  });
});

describe("/omni:pr's Held by a provider", () => {
  const text = flat(read('pr'));

  it('marks ready only when every row is clear or every hook of it passes, and reads wait as not yet', () => {
    expect(text).toContain('Mark it ready only when every row is `clear` or every hook of it passes.');
    expect(text).toContain('`wait merge-after.served <why>` and `not ok merge-after.served <why>` do not');
    expect(text).toMatch(/`held`, `not judged`, or a probe's `wait`: it \*\*stays a draft\*\*/);
  });

  it('marks a standalone PR ready at its Done row only once the hold lets it', () => {
    expect(text).toContain('A standalone PR gets `gh pr ready <n>` if it is still a draft, once **Held by a provider** lets it');
  });

  it('never moves a ready pull request back, and gives an agent no override', () => {
    expect(text).toContain('A pull request already ready is never moved back to draft by the hold.');
    expect(text).toContain('only a person marks a held pull request ready');
  });
});

it.each(['pr', 'ultra-yolo', 'mega-bug-fix'])('/omni:%s runs omni hold before gh pr ready', (name) => {
  expect(flat(read(name))).toMatch(/`node \.omni-loop\/bin\/omni\.mjs hold <owner\/repo>#<n> --json`.{0,600}?before `gh pr ready`/);
});

describe('/omni:mega-pr-care, which never marks ready', () => {
  it('reads the hold each round, keeps its guardrail and names no gh pr ready', () => {
    const text = flat(read('mega-pr-care'));
    expect(text).toContain('each round runs `node .omni-loop/bin/omni.mjs hold <owner/repo>#<n> --json`');
    expect(text).toContain('never mark a pull request ready or back to draft');
    expect(text).not.toContain('gh pr ready');
  });
});
