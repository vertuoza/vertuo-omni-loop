import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { refusedWordsIn } from '../rules.ts';
import { afterMerge } from './after-merge.ts';
import { handles } from './test/handles.ts';
import { FEATURE, MERGED_AT, MERGE_SHA, OWNER, REPO } from './after-merge.fixtures/day-14.ts';
import { AT_MERGE, PLAN, TARGETS, megaGitHub, type MegaMissing } from './after-merge.fixtures/mega.ts';

const { gather, detect, section } = handles(afterMerge);

const config = parseConfig('kit: 1\n');
const prd = { number: 7, topic: 'widget' };
const pr = { number: 12, url: FEATURE.html_url, mergedAt: MERGED_AT, mergeSha: MERGE_SHA };
const planIssue = (n: number) => `https://github.com/${PLAN}/issues/${n}`;
const backendFix = 'https://github.com/acme/backend/pull/12';
const frontendFix = 'https://github.com/acme/frontend/pull/34';

const scope = (over = {}) => ({ owner: OWNER, repo: REPO, mergeSha: MERGE_SHA, mergedAt: MERGED_AT, pr, prd, config, pulls: [], atMerge: AT_MERGE, targets: TARGETS, ...over });

async function run({ missing, comments, over }: { missing?: MegaMissing; comments?: string[]; over?: object } = {}) {
  const stubs = megaGitHub({ ...(missing ? { missing } : {}), ...(comments ? { comments } : {}) });
  const records = await gather(stubs.octokit, scope(over));
  return { stubs, records, ...detect(records, { pr, prd, config, pulls: [] }) };
}

describe('after-merge — the bugs of a multi-repository PRD', () => {
  it('counts the plan repository’s `For PRD #<n>` bugs beside the ones naming `#<n>`, as today', async () => {
    const { records, stubs } = await run();
    expect(records.bugs.map((bug) => bug.number)).toEqual([40, 41, 60]);
    const listed = stubs.plan.state.requests.filter((r) => r.route === 'GET /repos/{owner}/{repo}/issues').map((r) => r.labels);
    expect(listed).toEqual(['bug', 'omni:bug']);
  });

  it('reads each fix PR its fix plan names in its own repository, and hands on each target’s churn ranges', async () => {
    const { records, stubs } = await run();
    expect(records.mega).toEqual({
      plan: PLAN,
      bugs: [60],
      planned: [
        {
          bug: 60,
          repo: 'acme/backend',
          number: 12,
          url: backendFix,
          mergedAt: '2026-09-28T08:00:00Z',
          files: [{ path: 'src/store/colour.ts', previous: null, blocks: [[12, 2, 12, 2]] }],
        },
        { bug: 60, repo: 'acme/frontend', number: 34, url: frontendFix, mergedAt: '2026-09-29T08:00:00Z', files: [{ path: 'src/show/colour.tsx', previous: null, blocks: null }] },
      ],
      targets: [
        { repo: 'acme/backend', name: 'backend', ranges: [{ path: 'src/store/colour.ts', from: 10, to: 20 }] },
        { repo: 'acme/frontend', name: 'frontend', ranges: [{ path: 'src/show/colour.tsx', from: 1, to: 5 }] },
        { repo: 'acme/mobile', name: 'mobile', ranges: [] },
      ],
      unread: [{ read: 'fix', repo: 'acme/mobile', number: 5, status: 404 }],
    });
    expect(stubs.backend.state.requests.map((r) => [r.owner, r.repo])).toEqual([
      ['acme', 'backend'],
      ['acme', 'backend'],
    ]);
  });

  it('places each fix against its own repository’s churn at the merge', async () => {
    const { facts } = await run();
    expect(facts).toMatchObject({ total: 3, fixed: 2, linked: 2 });
    expect(facts.bugs.at(-1)).toEqual({
      number: 60,
      url: planIssue(60),
      daysAfterMerge: 4,
      closed: true,
      fixes: [],
      planned: [
        { repo: 'acme/backend', number: 12, url: backendFix },
        { repo: 'acme/frontend', number: 34, url: frontendFix },
      ],
      linked: [
        { fix: 12, repo: 'acme/backend', path: 'src/store/colour.ts', from: 10, to: 20, finding: 'backend/churn:src/store/colour.ts:10-20', byFile: false },
        { fix: 34, repo: 'acme/frontend', path: 'src/show/colour.tsx', from: 1, to: 5, finding: 'frontend/churn:src/show/colour.tsx:1-5', byFile: true },
      ],
    });
  });

  it('writes the mega bug in the After merge section, and the fix PR it could not read', async () => {
    const { facts } = await run();
    const lines = section(facts);
    expect(lines[0]).toBe('- 3 `bug` issues naming #7 were opened within 14 days of the merge: 2 fixed within those days, 2 linked to churn.');
    expect(lines).toContain('- 1 of them carries `For PRD #7`: the pull requests of its fix plan were read in their own repositories.');
    expect(lines).toContain(
      `- [#60](${planIssue(60)}): opened 4 days after the merge, closed; fixed by [acme/backend#12](${backendFix}) and [acme/frontend#34](${frontendFix}); linked to \`backend/churn:src/store/colour.ts:10-20\` (acme/backend#12) and \`frontend/churn:src/show/colour.tsx:1-5\` (acme/frontend#34, by its file).`,
    );
    expect(lines.at(-1)).toBe('- acme/mobile#5 was not read (GitHub answered 404), so it is not counted.');
  });

  it('finds the mega bug with its fixes in every repository as evidence', async () => {
    const { findings } = await run();
    const found = findings.find((finding) => finding.id === 'bug:60');
    expect(found?.evidence).toEqual([
      { label: 'Bug #60', url: planIssue(60) },
      { label: 'Fix acme/backend#12', url: backendFix },
      { label: 'Fix acme/frontend#34', url: frontendFix },
    ]);
    expect(found?.happened).toBe(
      'Issue #60 carries `For PRD #7` and was opened 4 days after the merge. It was closed within 14 days of the merge, fixed by acme/backend#12 and acme/frontend#34. A fix touched code rewritten again and again before the merge, so the bug is linked to that churn: acme/backend#12 touched `backend/churn:src/store/colour.ts:10-20`, and acme/frontend#34 changed `src/show/colour.tsx`, which holds `frontend/churn:src/show/colour.tsx:1-5`, without a patch to place its lines.',
    );
  });

  it('names a fix PR, its files or a fix plan it could not read', async () => {
    const { records, facts } = await run({ missing: { 'acme/frontend#34': 403, 'acme/backend#12/files': 404 } });
    expect(records.mega?.unread).toEqual([
      { read: 'files', repo: 'acme/backend', number: 12, status: 404 },
      { read: 'fix', repo: 'acme/frontend', number: 34, status: 403 },
      { read: 'fix', repo: 'acme/mobile', number: 5, status: 404 },
    ]);
    expect(section(facts).slice(-3)).toEqual([
      '- The files of acme/backend#12 were not read (GitHub answered 404), so it is not placed against the churn ranges of acme/backend.',
      '- acme/frontend#34 was not read (GitHub answered 403), so it is not counted.',
      '- acme/mobile#5 was not read (GitHub answered 404), so it is not counted.',
    ]);
  });

  it('counts a mega bug without a fix plan, with no fix', async () => {
    const { facts } = await run({ comments: [] });
    expect(facts.bugs.at(-1)).toMatchObject({ number: 60, fixes: [], planned: [], linked: [] });
    expect(facts).toMatchObject({ total: 3, fixed: 1 });
  });

  it('reads nothing more for a PRD of one repository', async () => {
    const { records, stubs } = await run({ over: { targets: undefined } });
    expect(records).not.toHaveProperty('mega');
    expect(records.bugs.map((bug) => bug.number)).toEqual([40, 41]);
    expect(stubs.plan.state.requests.filter((r) => r.route === 'GET /repos/{owner}/{repo}/issues').map((r) => r.labels)).toEqual(['bug']);
  });

  it('writes no number its facts and findings do not hold, and no word the rules refuse', async () => {
    const { facts, findings } = await run();
    const held = new Set(JSON.stringify({ facts, findings, days: 14 }).match(/\d+/g));
    const written = [...section(facts), ...findings.flatMap((finding) => [finding.title, finding.happened])].join('\n');
    expect((written.match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
    expect(refusedWordsIn(written)).toEqual([]);
  });
});
