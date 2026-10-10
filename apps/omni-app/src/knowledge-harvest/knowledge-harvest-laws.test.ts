// Worth a law? in the App's knowledge harvest (PRD 1342 s5), end to end against the stubbed GitHub: a
// rule no changed test proves asks galaxy's law judge, a "yes" opens one law issue labelled `labels.law`
// and the knowledge PR holds the law `Enforced by: pending #<that issue>`, a "no" opens none and stays
// in the PRD's settled.md. A judge that refuses or fails leaves the classifier's answer to count.
import { InngestTestEngine } from '@inngest/test';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { describe, expect, it, vi } from 'vitest';
import { inngest } from '../inngest-client.ts';
import { FILES, K, KEY, LEDGER, REPLIES, fakeFetch, harvestEvent, harvestScenario } from '../../test/harvest-scenario.ts';
import { readEnv } from '../env.ts';
import { createKnowledgeHarvest } from './knowledge-harvest.ts';
import type { LawJudge, LawJudgement } from './law-judge.ts';

const RULES = `${K}/product/rules.md`;
const BRANCH = 'docs/knowledge-widgets';
const STATEMENT = REPLIES['s1-02-set-secret'].statement;
const KNOWLEDGE_CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n';

/** The scenario's replies, the rule saying whether it is worth a law. */
const replies = (worthALaw: boolean) => ({ ...REPLIES, 's1-02-set-secret': { ...REPLIES['s1-02-set-secret'], worthALaw } });

type Scenario = ReturnType<typeof harvestScenario>;

function run({ worthALaw, judge = null, config = KNOWLEDGE_CONFIG, github = harvestScenario({ files: { ...FILES, '.omni-loop/config.yml': config } }) }: {
  worthALaw: boolean;
  judge?: LawJudge | null;
  config?: string;
  github?: Scenario;
}) {
  const fn = createKnowledgeHarvest({
    client: inngest,
    // The merged pull request changed no file: no test proves the rule.
    octokitFor: () => ({
      request: async (route: string, params?: Record<string, unknown>) =>
        route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' ? { data: [] } : github.octokit.request(route, params),
    }),
    openrouter: readEnv({ OPENROUTER_API_KEY: KEY }).openrouter,
    fetch: fakeFetch(replies(worthALaw) as typeof REPLIES),
    now: () => '2026-09-27',
    lawJudge: judge,
  });
  return { github, engine: new InngestTestEngine({ function: fn, events: [harvestEvent()] }) };
}

/** A judge answering `judgement` every time, recording what it was asked. */
function judging(judgement: LawJudgement) {
  return vi.fn<LawJudge>(async () => judgement);
}

const lawIssues = (github: Scenario) => github.state.issues.filter((issue) => issue.labels.some((label) => label.name === 'omni:law'));

function rulesOn(github: Scenario): string {
  const text = github.filesAt(BRANCH, [RULES])[RULES];
  assertDefined(text, RULES);
  return text;
}

function ledgerOn(github: Scenario): string {
  const text = github.filesAt(BRANCH, [LEDGER])[LEDGER];
  assertDefined(text, LEDGER);
  return text;
}

describe('knowledge-harvest — worth a law?', () => {
  it('a yes opens one law issue labelled omni:law, and the knowledge PR holds the law pending that issue', async () => {
    const { github, engine } = run({ worthALaw: true });
    const { error, ctx } = await engine.execute();
    expect(error).toBeUndefined();
    const issues = lawIssues(github);
    expect(issues).toHaveLength(1);
    const [issue] = issues;
    assertDefined(issue, 'the law issue');
    expect(issue.title).toBe(`Law: ${STATEMENT}`);
    expect(String(issue.body)).toContain('- Register: ');
    const rules = rulesOn(github);
    expect(rules).toContain(STATEMENT);
    expect(rules).toContain(`Enforced by: pending #${issue.number}`);
    const pull = github.state.pulls.find((candidate) => candidate.head.ref === BRANCH && candidate.state === 'open');
    expect(String(pull?.body)).toContain(`Enforced by: pending #${issue.number}`);
    const ids = ctx.step.run.mock.calls.map(([id]) => id);
    expect(ids.slice(-4)).toEqual(['write', 'law-issue:s1-02-set-secret', 'write:laws', 'publish']);
  });

  it('a no opens no law issue, and the decision stays in settled.md, not worth a law', async () => {
    const { github, engine } = run({ worthALaw: false });
    const { error } = await engine.execute();
    expect(error).toBeUndefined();
    expect(lawIssues(github)).toEqual([]);
    expect(rulesOn(github)).not.toContain(STATEMENT);
    expect(ledgerOn(github)).toContain('not worth a law (classifier)');
  });

  it("asks galaxy's judge with the five-field state, and Jev's no counts over the classifier's yes", async () => {
    const judge = judging({ worth: { worth: false, decidedBy: 'Jev', confidence: 0.9 }, reason: null });
    const { github, engine } = run({ worthALaw: true, judge });
    const { error, ctx } = await engine.execute();
    expect(error).toBeUndefined();
    expect(judge).toHaveBeenCalledTimes(1);
    const [question, asked] = judge.mock.calls[0] ?? [];
    expect(asked).toEqual({ repo: 'acme/widgets', ref: 'PRD 42 s1-02-set-secret' });
    expect(question).toMatchObject({ id: 's1-02-set-secret', old: true, state: { statement: STATEMENT, domain: 'product', prdTitle: 'Widgets that remember' } });
    expect(Object.keys(question?.state ?? {}).sort()).toEqual(['domain', 'prdTitle', 'principle', 'statement', 'why']);
    expect(lawIssues(github)).toEqual([]);
    expect(ledgerOn(github)).toContain('not worth a law (Jev 0.90)');
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toContain('law-worth:s1-02-set-secret');
  });

  it("Jev's yes counts over the classifier's no", async () => {
    const judge = judging({ worth: { worth: true, decidedBy: 'Jev', confidence: 0.8 }, reason: null });
    const { github, engine } = run({ worthALaw: false, judge });
    expect((await engine.execute()).error).toBeUndefined();
    expect(lawIssues(github)).toHaveLength(1);
    expect(rulesOn(github)).toContain('Enforced by: pending #');
  });

  it("a refused or failing judge leaves the classifier's answer to count, and the harvest completes", async () => {
    for (const judge of [judging({ worth: null, reason: 'galaxy answered 401: Bad signature.' }), vi.fn<LawJudge>(() => Promise.reject(new Error('boom')))]) {
      const { github, engine } = run({ worthALaw: true, judge });
      const { error } = await engine.execute();
      expect(error).toBeUndefined();
      expect(lawIssues(github)).toHaveLength(1);
      expect(rulesOn(github)).toContain('Enforced by: pending #');
    }
  });

  it('reuses a law issue already open with the same title, never opening a second one', async () => {
    const github = harvestScenario({ files: { ...FILES, '.omni-loop/config.yml': KNOWLEDGE_CONFIG } });
    github.state.issues.push({ number: 900, title: `Law: ${STATEMENT}`, body: 'earlier', state: 'open', html_url: 'https://github.com/acme/widgets/issues/900', labels: [{ name: 'omni:law' }] });
    const { engine } = run({ worthALaw: true, github });
    expect((await engine.execute()).error).toBeUndefined();
    expect(lawIssues(github)).toHaveLength(1);
    expect(rulesOn(github)).toContain('Enforced by: pending #900');
  });

  it('with laws.source other than knowledge, asks no judge and opens no law issue', async () => {
    const judge = judging({ worth: { worth: true, decidedBy: 'Jev', confidence: 0.9 }, reason: null });
    const { github, engine } = run({ worthALaw: true, judge, config: FILES['.omni-loop/config.yml'] });
    expect((await engine.execute()).error).toBeUndefined();
    expect(judge).not.toHaveBeenCalled();
    expect(lawIssues(github)).toEqual([]);
    expect(rulesOn(github)).not.toContain('pending #');
  });
});
