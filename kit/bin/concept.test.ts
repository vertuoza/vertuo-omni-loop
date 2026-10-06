// `omni concept <n>` (PRD 686), shaped like `omni visual`: run on a concept branch, it grades the
// concept's one folder under `<paths.delivery>/inbox/concepts/`, what the branch changed, and every
// commit's signature. Each failure the spec's test seams list is named alone.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const CONCEPT = 712;
const DIR = '.omni-loop/delivery/inbox/concepts/0712-team-agenda';
const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const CLAUDE = 'Co-Authored-By: Claude <noreply@anthropic.com>';
const PAGE = '<!doctype html><title>Agenda</title><img src="data:image/svg+xml;base64,PHN2Zy8+"><a href="https://example.com">ref</a>\n';

function conceptMd({ concept = CONCEPT, kind = 'product' } = {}) {
  return [
    '---',
    `concept: ${concept}`,
    'title: One agenda for every employee',
    `kind: ${kind}`,
    'scale: vast',
    '---',
    '',
    '## The brief', '', 'An agenda for every employee.', '',
    '## The vision', '', 'The living day.', '',
    '## Why this one', '', 'Wow 5.', '',
    '## Killed and why', '', '- B: too safe.', '',
    '## Fuel', '', '- the calendar screen.', '',
    '## Areas', '',
    '| id | area | brief | PRD |',
    '|---|---|---|---|',
    '| day-view | The living day view | One screen for the day | |',
    '| crew-sync | Crew sync | The crew sees the same day | |',
    '',
  ].join('\n');
}

/** A valid concept folder's files, keyed by repository path. */
function validFolder(dir = DIR) {
  return {
    [`${dir}/concept.md`]: conceptMd(),
    [`${dir}/vision.html`]: PAGE,
    [`${dir}/debate.md`]: '# Debate\n',
    [`${dir}/board-r1.html`]: PAGE,
    [`${dir}/board-r2.html`]: PAGE,
  };
}

/** Commits everything, signed as a skill signs it unless `signed` is false. Returns the short sha. */
function commit(root: string, message: string, { signed = true } = {}) {
  const text = signed ? `${message}\n\n${CLAUDE}\n${TRAILER}\n` : message;
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', text], { cwd: root, stdio: 'ignore' });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

/** A repository whose config is committed (`base`, the default branch), on a concept branch. */
function setup(configText = CONFIG_TEXT) {
  const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': configText } });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  execFileSync('git', ['switch', '-q', '-c', 'docs/concept-712-team-agenda'], { cwd: root });
  const writeAll = (files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) write(path, text);
  };
  return { root, write, writeAll, base };
}

async function run(root: string, base: string | undefined, concept: number | string = CONCEPT) {
  const s = io();
  const argv = base === undefined ? ['concept', String(concept)] : ['concept', String(concept), '--base', base];
  const code = await main(argv, { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

/** The lines after `not ok` that name a failed check. */
function failures(out: string) {
  return out.split('\n').filter((line: string) => line.startsWith('- '));
}

/** A valid concept, committed signed, then `change` applied and committed: its run's result. */
async function withChange(change: (repo: ReturnType<typeof setup>) => unknown, { configText, signed = true }: { configText?: string; signed?: boolean } = {}) {
  const repo = setup(configText);
  repo.writeAll(validFolder());
  change(repo);
  const sha = commit(repo.root, 'docs(concept): team-agenda', { signed });
  return { ...(await run(repo.root, repo.base)), sha, repo };
}

describe('omni concept', () => {
  it('is ok, exit 0, for one valid folder on a signed branch, a followable link and an SVG image included', async () => {
    const { code, out } = await withChange(() => {});
    expect(failures(out)).toEqual([]);
    expect(out).toBe('ok\n');
    expect(code).toBe(0);
  });

  it('reads --base from the remote default branch when it is not given', async () => {
    const { root, writeAll, base } = setup();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', base], { cwd: root });
    writeAll(validFolder());
    commit(root, 'docs(concept): team-agenda');
    expect(await run(root, undefined)).toMatchObject({ code: 0, out: 'ok\n' });
  });

  it('is not ok, exit 1, when no folder is there for the concept', async () => {
    const { root, writeAll, base } = setup();
    writeAll(validFolder('.omni-loop/delivery/inbox/concepts/0713-other'));
    commit(root, 'docs(concept): other');
    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(out).toMatch(/^not ok$/m);
    expect(failures(out)).toEqual(['- no folder .omni-loop/delivery/inbox/concepts/0712-<slug>/ for issue 712.']);
  });

  it('is not ok, exit 1, when two folders are there for the concept', async () => {
    const { code, out } = await withChange(({ writeAll }) => { writeAll(validFolder('.omni-loop/delivery/inbox/concepts/0712-again')); });
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(/^- 2 folders for issue 712, one expected: .*0712-again.*0712-team-agenda/);
  });

  it.each(['concept.md', 'vision.html', 'debate.md', 'board-r1.html'])('is not ok, exit 1, naming a missing %s alone', async (file: string) => {
    const { code, out } = await withChange(({ root }) => {
      rmSync(join(root, DIR, file));
      if (file === 'board-r1.html') rmSync(join(root, DIR, 'board-r2.html'));
    });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/${file}: missing.`]);
  });

  it('is not ok, exit 1, naming a gap in the rounds', async () => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/board-r4.html`, PAGE); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/board-r3.html: missing; the rounds are numbered from 1 with no gap.`]);
  });

  it('is not ok, exit 1, naming a stray file, and a board named off the pattern', async () => {
    const stray = await withChange(({ write }) => { write(`${DIR}/notes.md`, 'notes\n'); });
    expect(stray.code).toBe(1);
    expect(failures(stray.out)).toEqual([
      `- ${DIR}/notes.md: not part of a concept; the folder holds concept.md, vision.html, debate.md and board-r<k>.html only.`,
    ]);
    const misnamed = await withChange(({ write }) => { write(`${DIR}/board-r03.html`, PAGE); });
    expect(failures(misnamed.out)).toEqual([`- ${DIR}/board-r03.html: a round's board is named board-r<k>.html, k from 1.`]);
  });

  it('is not ok, exit 1, naming an invalid concept.md', async () => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/concept.md`, conceptMd({ kind: 'feature' })); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/concept.md: front matter: kind is "feature", not one of product, identity, platform.`]);
  });

  it('is not ok, exit 1, when concept.md names another concept', async () => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/concept.md`, conceptMd({ concept: 713 })); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/concept.md: concept is 713, not 712.`]);
  });

  it('is not ok, exit 1, naming a page over limits.beforeAfterMaxBytes', async () => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/board-r2.html`, `${PAGE}${'x'.repeat(400)}`); }, {
      configText: `${CONFIG_TEXT}limits:\n  beforeAfterMaxBytes: 300\n`,
    });
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(new RegExp(`^- ${DIR}/board-r2\\.html: is \\d+ bytes, over the 300-byte cap\\.$`));
  });

  it('is not ok, exit 1, naming a page holding a base64 PNG', async () => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/vision.html`, '<img src="data:image/png;base64,iVBORw0KGgo=">\n'); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/vision.html: holds a base64 raster image (a data:image/ URL that is not SVG); draw it in SVG or CSS.`]);
  });

  it.each([
    ['a script', '<script src="https://cdn.example.com/app.js"></script>', '<script src> https://cdn.example.com/app.js'],
    ['a stylesheet', '<link rel="stylesheet" href="https://fonts.example.com/css">', '<link href> https://fonts.example.com/css'],
  ])('is not ok, exit 1, naming a page loading %s from the network', async (_what: string, tag: string, load: string) => {
    const { code, out } = await withChange(({ write }) => { write(`${DIR}/board-r1.html`, `${PAGE}${tag}\n`); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/board-r1.html: loads from the network: ${load}; inline it, and keep only links a person follows.`]);
  });

  it('is not ok, exit 1, naming a file the branch changed outside the folder', async () => {
    const { code, out } = await withChange(({ write }) => { write('app/agenda.ts', 'export {};\n'); });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- app/agenda.ts: changed outside ${DIR}/; a concept branch changes its own folder only.`]);
  });

  it('is not ok, exit 1, naming the unsigned commit', async () => {
    const { code, out, sha } = await withChange(() => {}, { signed: false });
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- unsigned: ${sha} docs(concept): team-agenda has no "${TRAILER}" line.`]);
  });

  it('does not check the signature with signature: null', async () => {
    const { code } = await withChange(() => {}, { configText: `${CONFIG_TEXT}signature: null\n`, signed: false });
    expect(code).toBe(0);
  });

  it('names every failure at once', async () => {
    const { code, out } = await withChange(({ write, root }) => {
      rmSync(join(root, DIR, 'debate.md'));
      write('README.md', 'changed\n');
    }, { signed: false });
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(3);
  });

  it('refuses a --base that does not resolve, exit 2', async () => {
    const { root } = setup();
    const { code, err } = await run(root, 'nope-ref');
    expect(code).toBe(2);
    expect(err).toMatch(/nope-ref/);
  });

  it('refuses a concept that is not a positive integer, exit 2', async () => {
    const { root, base } = setup();
    expect((await run(root, base, 'seven')).code).toBe(2);
  });

  it('exits 2 outside an installed repository', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-bare-'));
    const s = io();
    expect(await main(['concept', String(CONCEPT)], { cwd: root, ...s })).toBe(2);
  });
});
