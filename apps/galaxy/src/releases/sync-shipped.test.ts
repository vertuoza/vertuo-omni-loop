// What a checkout says has shipped, read through the kit (its config, its layout, its note and spec
// parsers) and git, on a throwaway checkout built here.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { readShipped } from './sync-shipped';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const spec = (prd: number, title: string) => `---\nprd: ${prd}\ntitle: ${title}\nblocked-by: none\nspec: file\n---\n\n# ${title}\n`;
const note = (prd: number, title: string, description: string, version?: string) =>
  `---\nprd: ${prd}\ntitle: ${title}\n${version ? `version: ${version}\n` : ''}---\n${description}\n`;

/** A checkout holding `files`, committed on main at `date`, with the delivery folder where `delivery` says. */
function checkout(files: Record<string, string>, { date = '2026-09-27T18:00:00+02:00', delivery = '.omni-loop/delivery' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-releases-shipped-'));
  roots.push(root);
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('.omni-loop/config.yml', `kit: 1\nrepo:\n  slug: acme/widgets\npaths:\n  delivery: ${delivery}\n`);
  for (const [path, text] of Object.entries(files)) write(path, text);
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: root, stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  return { root, write };
}

const SHIPPED = 'docs/delivery/shipped';

describe('readShipped — every PRD the checkout has shipped', () => {
  it('reads each shipped folder\'s note, or its spec title with no description, and the date it reached main', () => {
    const { root, write } = checkout({
      [`${SHIPPED}/0003-omni-loop-kit/spec.md`]: spec(3, 'Omni Loop kit — terraform any repository'),
      [`${SHIPPED}/0003-omni-loop-kit/release.md`]: note(3, 'Install the delivery loop in any repository', 'The kit packages the loop.', '0.0.1'),
      [`${SHIPPED}/0262-release-notes/spec.md`]: spec(262, 'Release notes — every shipped PRD, versioned'),
      [`${SHIPPED}/0262-release-notes/release.md`]: note(262, 'Know what shipped, week by week', 'A public page lists every release,\nnewest first.'),
      [`${SHIPPED}/0142-ask-tabs/spec.md`]: spec(142, 'Ask tabs: one per terminal'),
      'docs/delivery/inbox/0300-next/spec.md': spec(300, 'Not shipped yet'),
      [`${SHIPPED}/not-a-prd/spec.md`]: 'ignored',
    }, { delivery: 'docs/delivery' });
    write(`${SHIPPED}/0400-local-only/spec.md`, spec(400, 'Shipped here, not on main'));

    const reading = readShipped(root);

    expect(reading.shipped).toEqual([
      { prd: 3, releasedAt: '2026-09-27T18:00:00+02:00', title: 'Install the delivery loop in any repository', description: 'The kit packages the loop.', pinned: true },
      { prd: 142, releasedAt: '2026-09-27T18:00:00+02:00', title: 'Ask tabs: one per terminal', description: '', pinned: false },
      { prd: 262, releasedAt: '2026-09-27T18:00:00+02:00', title: 'Know what shipped, week by week', description: 'A public page lists every release, newest first.', pinned: false },
    ]);
    expect(reading.waiting).toEqual([`${SHIPPED}/0400-local-only: not on main yet — its spec.md is in no commit of this checkout`]);
    expect(reading.refused).toEqual([]);
  });

  it('refuses, naming the file and the rule, a note that breaks the rules, a folder with no spec, and a spec it cannot read', () => {
    const shipped = '.omni-loop/delivery/shipped';
    const { root } = checkout({
      [`${shipped}/0007-skills/spec.md`]: spec(7, 'Skills'),
      [`${shipped}/0007-skills/release.md`]: note(7, 'See https://example.com.', 'Fine.', '0.0.2'),
      [`${shipped}/0028-app/plan.md`]: '# Plan\n',
      [`${shipped}/0039-init/spec.md`]: '---\nprd: 39\n---\n',
      [`${shipped}/0045-forms/spec.md`]: spec(45, 'Forms'),
    });

    const reading = readShipped(root);

    // In folder order, each file's rules in the order the kit states them.
    expect(reading.refused).toEqual([
      `${shipped}/0007-skills/release.md: version 0.0.2 is not 0.0.1 — only the initial release's notes carry a version`,
      `${shipped}/0007-skills/release.md: title ends with a full stop`,
      `${shipped}/0007-skills/release.md: title holds a URL ("https://")`,
      `${shipped}/0028-app: no spec.md`,
      `${shipped}/0039-init/spec.md: title: Required`,
      `${shipped}/0039-init/spec.md: blocked-by: Required`,
      `${shipped}/0039-init/spec.md: spec: spec must be one of: file, issue`,
    ]);
    expect(reading.shipped.map((prd) => prd.prd)).toEqual([45]);
  });

  it('reads nothing from a checkout that has shipped nothing', () => {
    const { root } = checkout({ '.omni-loop/delivery/inbox/0001-first/spec.md': spec(1, 'First') });
    expect(readShipped(root)).toEqual({ shipped: [], waiting: [], refused: [] });
  });
});
