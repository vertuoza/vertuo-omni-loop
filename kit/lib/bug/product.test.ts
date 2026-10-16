// PRD 2011, slice s6: a bug record born on the server is graded against the product's repositories and
// pushed as `<key>-B<n>`.
import { describe, expect, it } from 'vitest';
import { AskCallError } from '../ask/client.ts';
import { parseProductBugId, productBugId, productBugParts, ProductBugIdSchema } from '../ids.ts';
import { bugSeqArg, gradeProductBug, gradeBugFile, parseProductBug, bugPushedLines, pushProductBug } from './product.ts';

const REPOSITORIES = [
  { repository: 'acme/app', readOnly: false },
  { repository: 'acme/api', readOnly: false },
  { repository: 'acme/docs', readOnly: true },
];

const RECORD = `# Sign-in loops

## Fixes

| order | repository | pull request | what changes |
| --- | --- | --- | --- |
| 1 | acme/api | acme/api#41 | the token is read once |
| 2 | app | #7 | the app stops retrying |

## Reproduction

- **acme/api:** \`api.test.ts\` — red
- **app:** \`app.test.ts\` — red

## Guard

- **api:** api.test.ts
- **app:** none — the api guard covers it
`;

function graded(record = RECORD) {
  const parsed = parseProductBug(record);
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return { parsed, grade: gradeProductBug(parsed.bug, parsed.sections, { key: 'mobile', repositories: REPOSITORIES }) };
}

describe('<key>-B<n> ids', () => {
  it('reads and builds a product bug id, apart from PRD and roadmap ids', () => {
    expect(productBugParts(parseProductBugId('mobile-B74'))).toEqual({ key: 'mobile', seq: 74 });
    expect(productBugParts(parseProductBugId('my-app-B3'))).toEqual({ key: 'my-app', seq: 3 });
    expect(productBugId('mobile', 5)).toBe('mobile-B5');
    for (const other of ['mobile-12', 'mobile-R3', 'mobile-B0', 'Mobile-B1', 'mobile-b1', 'B1']) {
      expect(ProductBugIdSchema.safeParse(other).success, other).toBe(false);
    }
  });
});

describe('parseProductBug', () => {
  it('reads the title and the Fixes rows', () => {
    const { parsed } = graded();
    expect(parsed.bug.title).toBe('Sign-in loops');
    expect(parsed.bug.rows).toEqual([
      { order: '1', repository: 'acme/api', pull: 'acme/api#41', changes: 'the token is read once' },
      { order: '2', repository: 'app', pull: '#7', changes: 'the app stops retrying' },
    ]);
  });

  it('stops on a record with no title or no rows', () => {
    expect(parseProductBug('## Fixes\n')).toEqual({ ok: false, errors: ['the record has no "# <title>" heading.', 'the "## Fixes" table has no rows.'] });
  });
});

describe('gradeProductBug', () => {
  it('turns each row into the full repository, its pull request and its lines', () => {
    expect(graded().grade).toEqual({
      violations: [],
      rows: [
        { repo: 'acme/api', pull: 41, changes: 'the token is read once', reproduction: '`api.test.ts` — red', guard: 'api.test.ts' },
        { repo: 'acme/app', pull: 7, changes: 'the app stops retrying', reproduction: '`app.test.ts` — red', guard: 'none — the api guard covers it' },
      ],
    });
  });

  it('names a row whose repository is outside the product', () => {
    const { grade } = graded(RECORD.replace('| 2 | app |', '| 2 | other/site |'));
    expect(grade.violations).toEqual(['Fixes row 2: other/site is not a repository of product mobile (acme/app, acme/api, acme/docs).']);
  });

  it('names a read-only repository, a foreign pull request, a repeat, a wrong order and a missing line', () => {
    const record = RECORD
      .replace('| 1 | acme/api | acme/api#41 |', '| 1 | docs | #2 |')
      .replace('| 2 | app | #7 |', '| 3 | app | acme/api#9 |')
      .replace('- **app:** none — the api guard covers it\n', '');
    const { grade } = graded(record);
    expect(grade.violations).toEqual([
      'Fixes row 1 (acme/docs): the repository is read-only in the product.',
      'Fixes row 1 (acme/docs): the Reproduction has no line for it.',
      'Fixes row 1 (acme/docs): the Guard has no line for it.',
      'Fixes row 2 (acme/app): order "3", where 2 is next.',
      'Fixes row 2 (acme/app): the pull request acme/api#9 is not in acme/app.',
      'Fixes row 2 (acme/app): the Guard has no line for it.',
    ]);
  });

  it('takes a row with no pull request yet', () => {
    const { grade } = graded(RECORD.replace('acme/api#41', '—'));
    expect(grade.violations).toEqual([]);
    expect(grade.rows[0]?.pull).toBeNull();
  });
});

describe('the calls', () => {
  const check = { checked: true, product: { key: 'mobile', name: 'Mobile' }, repositories: REPOSITORIES };

  it('grades a record against what the check answers, and sends a check that writes nothing', async () => {
    const sent: unknown[] = [];
    const result = await gradeBugFile({ key: 'mobile', repo: null, record: RECORD, client: { pushBug: (body) => { sent.push(body); return Promise.resolve(check); } } });
    expect(result).toMatchObject({ ok: true, title: 'Sign-in loops', violations: [] });
    expect(sent).toEqual([{ productKey: 'mobile', new: true, check: true, title: 'Sign-in loops', record: RECORD, rows: [] }]);
  });

  it('stops with a line when the repositories cannot be read', async () => {
    const down = { pushBug: () => Promise.reject(new AskCallError('x', { status: null })) };
    expect(await gradeBugFile({ key: 'mobile', repo: null, record: RECORD, client: down })).toEqual({ ok: false, lines: ['the repositories of product mobile could not be read: unreachable'] });
  });

  it('pushes a graded record and reads the bug\'s id and page', async () => {
    const sent: unknown[] = [];
    const reply = { dossierId: 'd1', bug: 'mobile-B74', created: true, rows: [{ position: 1, repository: 'acme/api', pull: 41, state: 'open' }], added: [{ kind: 'bug-record', version: 1 }], unchanged: [] };
    const { grade } = graded();
    const result = await pushProductBug({
      key: 'mobile', seq: null, repo: null, graded: { title: 'Sign-in loops', record: RECORD, rows: grade.rows }, askUrl: 'https://omni.example/',
      client: { pushBug: (body) => { sent.push(body); return Promise.resolve(reply); } },
    });
    expect(result.ok && bugPushedLines(result.pushed)).toBe('mobile-B74\ncreated · 1 row(s) · added bug-record v1 — https://omni.example/bugs/d1');
    expect(sent).toEqual([{ productKey: 'mobile', new: true, title: 'Sign-in loops', record: RECORD, rows: grade.rows }]);
  });

  it('reports a refusal in the app\'s words', async () => {
    const refused = { pushBug: () => Promise.reject(new AskCallError('x', { status: 400, reason: 'Not a repository of Mobile: other/site.' })) };
    const { grade } = graded();
    expect(await pushProductBug({ key: 'mobile', seq: 3, repo: null, graded: { title: 't', record: RECORD, rows: grade.rows }, askUrl: 'https://omni.example', client: refused }))
      .toEqual({ ok: false, line: 'refused (400): Not a repository of Mobile: other/site.' });
  });

  it('reads --bug as 74 or mobile-B74 of the same product only', () => {
    expect([bugSeqArg('mobile', '74'), bugSeqArg('mobile', 'mobile-B74'), bugSeqArg('mobile', 'web-B74'), bugSeqArg('mobile', 'mobile-12')]).toEqual([74, 74, null, null]);
  });
});
