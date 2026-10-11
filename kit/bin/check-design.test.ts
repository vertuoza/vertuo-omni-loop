// `omni check design` (PRD 1407, s3): a locked screen or a locked law of the `design` form changes
// only with a new, dated amendment line — graded against the default branch, at its merge base with
// HEAD — a screen whose front matter does not read is named, and so is a `superseded` screen no other
// screen names. A draft changes freely. On a temporary git repository.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\ndesign:\n  enabled: true\n';
const DIR = '.omni-loop/knowledge/design/screens';
const FORM = '.omni-loop/knowledge/playbook/design.md';

function screen({ name = 'quote-editor', status = 'locked', supersedes = 'null', body = 'Edits one quote.', amendments = [] as string[] } = {}) {
  const lock = status === 'draft' ? '' : 'locked-by: "@ana"\nlocked-on: 2026-10-10\nquote: "this is the editor, build it"\n';
  const amended = amendments.length ? `\n${amendments.join('\n')}\n` : '';
  return `---\nscreen: ${name}\nstatus: ${status}\n${lock}implements: [src/quotes/]\nroutes: [/quotes/:id]\nsupersedes: ${supersedes}\n---\n${amended}\n## Purpose\n\n${body}\n`;
}

const AMEND = '> Amended 2026-10-12 · @ana · "the total goes on top": the total moved above the lines';

function form(laws: string) {
  return [
    '---',
    'form: design',
    'form-version: 1',
    'state: filled',
    'points-to: null',
    'evidence: []',
    'invaded: null',
    '---',
    '',
    '# Design',
    '',
    '## Product',
    '<!-- slot: product · required -->',
    'Builders on a phone, on site.',
    '',
    '## System',
    '<!-- slot: system · required -->',
    'Tokens in `packages/design/`.',
    '',
    '## Language',
    '<!-- slot: language · optional -->',
    '<!-- The shape, as the template shows it:',
    '  ### <the law>',
    '  🔒 <YYYY-MM-DD> · @<login> · "<their words>"',
    '-->',
    laws,
    '',
  ].join('\n');
}

const LAW = '### One primary action per place\n🔒 2026-10-10 · @ana · "only one blue button, ever"\n\nA place holds one primary action and at most one quiet one.\n';
const LAW_AMENDED = `${LAW}\n#### Amended 2026-11-02 · @ana · "dialogs may have two"\n`;

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const commit = (root: string, message: string) => {
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', message);
};

/** A repository whose `main` holds `files`, checked out on a branch `work`. */
function repoOn(files: Record<string, string>) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, ...files } });
  git(repo.root, 'checkout', '-q', '-b', 'work');
  return repo;
}

async function checkDesign(root: string, args: string[] = ['--base', 'main']) {
  const s = io();
  const code = await main(['check', 'design', ...args], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni check design — the screen library', () => {
  it('passes, saying so, while design.enabled is false', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n', [`${DIR}/x.md`]: 'not a screen' } });
    const { code, out } = await checkDesign(root, []);
    expect(code).toBe(0);
    expect(out).toContain('check design — design is off');
  });

  it('refuses a locked screen whose text changed without a new amendment line', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    write(`${DIR}/quote-editor.md`, screen({ body: 'Edits one quote, and its total.' }));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${DIR}/quote-editor.md: the locked screen "quote-editor" changed without an amendment`);
    expect(out).toContain('@ana');
  });

  it('passes the same change with a new amendment line under its front matter', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    write(`${DIR}/quote-editor.md`, screen({ body: 'Edits one quote, and its total.', amendments: [AMEND] }));
    const { code, out } = await checkDesign(root);
    expect(out).not.toContain('changed without');
    expect(code).toBe(0);
    expect(out).toMatch(/check design — 1 screen\(s\), 1 locked; 0 locked law\(s\); compared with main/);
  });

  it('refuses a new amendment line that does not read as a date, a login and a quote', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    write(`${DIR}/quote-editor.md`, screen({ body: 'Edits one quote, and its total.', amendments: ['> Amended today: moved the total'] }));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain('the amendment "> Amended today: moved the total" does not read');
  });

  it('refuses a locked screen that lost an amendment line', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen({ amendments: [AMEND] }) });
    write(`${DIR}/quote-editor.md`, screen());
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain('an amendment line was removed');
  });

  it('refuses a locked screen deleted, rather than superseded', async () => {
    const { root } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    rmSync(join(root, DIR, 'quote-editor.md'));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${DIR}/quote-editor.md: the locked screen "quote-editor" was removed`);
  });

  it('refuses a locked screen turned back into a draft without an amendment', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    write(`${DIR}/quote-editor.md`, screen({ status: 'draft' }));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain('changed without an amendment');
  });

  it('lets a locked screen be superseded by a screen that names it', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    write(`${DIR}/quote-editor.md`, screen({ status: 'superseded' }));
    write(`${DIR}/quote-editor-2.md`, screen({ name: 'quote-editor-2', status: 'draft', supersedes: 'quote-editor' }));
    const { code, out } = await checkDesign(root);
    expect(out).not.toContain('does not hold');
    expect(code).toBe(0);
  });

  it('lets a draft change freely', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-list.md`]: screen({ name: 'quote-list', status: 'draft' }) });
    write(`${DIR}/quote-list.md`, screen({ name: 'quote-list', status: 'draft', body: 'Something else entirely.' }));
    expect((await checkDesign(root)).code).toBe(0);
  });

  it('names a screen whose front matter does not read', async () => {
    const { root, write } = repoOn({});
    write(`${DIR}/broken.md`, '---\nscreen: broken\nstatus: done\n---\n');
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${DIR}/broken.md: status must be one of: draft, locked, superseded`);
  });

  it('names a superseded screen no other screen names', async () => {
    const { root, write } = repoOn({});
    write(`${DIR}/old.md`, screen({ name: 'old', status: 'superseded' }));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${DIR}/old.md: "old" is superseded, but no screen names it in supersedes`);
  });

  it('compares against the merge base, so a lock made on main after the branch was cut is not this branch’s change', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-list.md`]: screen({ name: 'quote-list', status: 'draft' }) });
    write(`${DIR}/quote-list.md`, screen({ name: 'quote-list', status: 'draft', body: 'The branch’s draft.' }));
    commit(root, 'branch draft');
    git(root, 'checkout', '-q', 'main');
    write(`${DIR}/quote-list.md`, screen({ name: 'quote-list' }));
    commit(root, 'lock on main');
    git(root, 'checkout', '-q', 'work');
    expect((await checkDesign(root)).code).toBe(0);
  });

  it('still grades the library when the default branch cannot be read, and says the locks were not compared', async () => {
    const { root, write } = repoOn({});
    write(`${DIR}/quote-editor.md`, screen());
    const { code, out } = await checkDesign(root, []);
    expect(code).toBe(0);
    expect(out).toContain('locks not compared — no origin/main');
  });
});

describe('omni check design — the laws of the design form', () => {
  it('refuses a locked law whose text changed without an amendment', async () => {
    const { root, write } = repoOn({ [FORM]: form(LAW) });
    write(FORM, form(LAW.replace('at most one quiet one', 'two quiet ones')));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${FORM}: the locked law "One primary action per place" changed without an amendment`);
  });

  it('passes it with a new "#### Amended" line below the law', async () => {
    const { root, write } = repoOn({ [FORM]: form(LAW) });
    write(FORM, form(LAW_AMENDED.replace('at most one quiet one', 'two quiet ones')));
    const { code, out } = await checkDesign(root);
    expect(out).not.toContain('does not hold');
    expect(code).toBe(0);
    expect(out).toContain('1 locked law(s)');
  });

  it('refuses a locked law removed or renamed', async () => {
    const { root, write } = repoOn({ [FORM]: form(LAW) });
    write(FORM, form(LAW.replace('One primary action per place', 'One primary action')));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain('the locked law "One primary action per place" was removed or renamed');
  });

  it('refuses a locked law that lost an amendment line', async () => {
    const { root, write } = repoOn({ [FORM]: form(LAW_AMENDED) });
    write(FORM, form(LAW));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain('an amendment line was removed');
  });

  it('names a lock line that does not read', async () => {
    const { root, write } = repoOn({});
    write(FORM, form('### Calm screens\n🔒 yesterday · ana · they said so\n\nNo spinner at rest.\n'));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(1);
    expect(out).toContain(`${FORM}: the law "Calm screens": its lock line "🔒 yesterday · ana · they said so" does not read`);
  });

  it('lets an unlocked law change, and reads no law from the template’s comment', async () => {
    const { root, write } = repoOn({ [FORM]: form('### Calm screens\n\nNo spinner at rest.\n') });
    write(FORM, form('### Calm screens\n\nNo spinner at rest, ever.\n'));
    const { code, out } = await checkDesign(root);
    expect(code).toBe(0);
    expect(out).toContain('0 locked law(s)');
  });
});

describe('omni check all', () => {
  it('runs the design guard', async () => {
    const { root, write } = repoOn({ [`${DIR}/quote-editor.md`]: screen() });
    git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
    write(`${DIR}/quote-editor.md`, screen({ body: 'Changed.' }));
    const s = io();
    const code = await main(['check', 'all'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toContain('the locked screen "quote-editor" changed without an amendment');
  });
});
