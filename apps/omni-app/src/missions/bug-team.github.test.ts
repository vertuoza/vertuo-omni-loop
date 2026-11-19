// The bug team's GitHub read (PRD 3088 s3), against a stubbed client: no call reaches GitHub.
import { describe, expect, it } from 'vitest';
import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import { ISSUES_READ, issuesOf, issuesQuery, missionBugIssues } from './bug-team.github.ts';

const i = parseIssue;
const linked = (...nodes: { number: number; state: string }[]) => ({ nodes });

describe('the bug team\'s read of its issues', () => {
  it('asks for each issue under its own alias, with its open closing pull requests', () => {
    expect(issuesQuery([i(3101), i(3102)])).toBe(
      'query BugIssues($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ' +
        'i3101: issue(number: 3101) { state closedByPullRequestsReferences(first: 10, includeClosedPrs: false) { nodes { number state } } } ' +
        'i3102: issue(number: 3102) { state closedByPullRequestsReferences(first: 10, includeClosedPrs: false) { nodes { number state } } } } }',
    );
  });

  it('reads each issue open or closed, its first open closing pull request, and leaves out one GitHub did not answer', () => {
    const data = {
      data: {
        repository: {
          i3101: { state: 'OPEN', closedByPullRequestsReferences: linked() },
          i3102: { state: 'OPEN', closedByPullRequestsReferences: linked({ number: 3150, state: 'MERGED' }, { number: 3151, state: 'OPEN' }) },
          i3103: { state: 'CLOSED', closedByPullRequestsReferences: null },
          i3104: null,
        },
      },
    };
    expect(issuesOf([i(3101), i(3102), i(3103), i(3104), i(3105)], data)).toEqual(
      new Map([
        [3101, { open: true, openFix: null }],
        [3102, { open: true, openFix: 3151 }],
        [3103, { open: false, openFix: null }],
      ]),
    );
    expect(issuesOf([i(3101)], { data: null, errors: [{ message: 'gone' }] })).toEqual(new Map());
  });

  it('asks GitHub once, as the installation, for the first issues only, and nothing for none', async () => {
    const calls: { installation: number; route: string; params: unknown }[] = [];
    const port = missionBugIssues({
      octokitFor: (installation) => ({
        request: (route, params) => {
          calls.push({ installation, route, params });
          return Promise.resolve({ data: { data: { repository: { i3101: { state: 'OPEN', closedByPullRequestsReferences: linked() } } } } });
        },
      }),
    });
    const issues = Array.from({ length: ISSUES_READ + 5 }, (_, n) => i(3101 + n));
    expect(await port.read({ installation: 7, repo: 'vertuoza/vertuo-omni-loop', issues })).toEqual(new Map([[3101, { open: true, openFix: null }]]));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ installation: 7, route: 'POST /graphql', params: { variables: { owner: 'vertuoza', name: 'vertuo-omni-loop' } } });
    expect(String((calls[0]?.params as { query: string }).query.match(/issue\(/g)?.length)).toBe(String(ISSUES_READ));
    expect(await port.read({ installation: 7, repo: 'vertuoza/vertuo-omni-loop', issues: [] })).toEqual(new Map());
    expect(calls).toHaveLength(1);
  });
});
