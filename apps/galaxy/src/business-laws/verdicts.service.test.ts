import { describe, expect, it } from 'vitest';
import type { AskLaws, LawVerdict } from './judge.service';
import type { JudgeInput, KeptVerdict, Standing, VerdictsRepository } from './verdicts.repository';
import { verdictService } from './verdicts.service';

// A ◆ PRD's spec judged once per spec version and pack commit (PRD 2632 s4): the service on a fake repository
// and a fake model. Nothing here calls a database or a model; every law and spec is fictional.

const SHA = 'c'.repeat(40);
const ROOT = 'docs/knowledge';
const LAW = `## BL-QUOTES-1\nA quote is sent only with a total above zero.\nWhy: An empty quote loses the customer.\n`;
const INPUT: JudgeInput = {
  dossier: 'd-1',
  server: true,
  specVersion: 'v-1',
  spec: '---\nareas: [quotes]\n---\nA template can be sent with a zero total.\n',
  lawHome: 'acme/plan',
  pack: {
    sha: SHA,
    files: [
      { path: '.omni-loop/config.yml', content: `kit: 1\npaths:\n  knowledge: ${ROOT}\nlaws:\n  owners: [ana, { login: bo, delegate: cy }]\n` },
      { path: `${ROOT}/domains/quotes/business-laws.md`, content: LAW },
      { path: `.omni-loop/knowledge/domains/quotes/business-laws.md`, content: '## BL-QUOTES-2\nElsewhere.\nWhy: x\n' },
    ],
  },
  glossary: [],
  domains: [{ key: 'quotes', name: 'Quotes' }],
  verdict: null,
};

const kept = (verdict: Partial<KeptVerdict> = {}): KeptVerdict => ({
  specVersion: 'v-1', lawHome: 'acme/plan', packSha: SHA, state: 'green', reason: '1 judged', laws: ['BL-QUOTES-1'],
  domains: [{ key: 'quotes', reasons: ['areas'], name: 'Quotes' }], findings: [], judgedAt: '2026-12-01T09:00:00Z', ...verdict,
});

/** A repository whose judge input is `input`, recording each verdict put. */
function fakeRepository(input: JudgeInput | null | Error): { repo: VerdictsRepository; puts: { version: string; sha: string; verdict: LawVerdict }[] } {
  const puts: { version: string; sha: string; verdict: LawVerdict }[] = [];
  const repo: VerdictsRepository = {
    judgeInput: () => (input instanceof Error ? Promise.reject(input) : Promise.resolve(input)),
    put: (version, sha, verdict) => {
      puts.push({ version, sha, verdict });
      return Promise.resolve(kept({ ...verdict, specVersion: version, packSha: sha }));
    },
    standing: () => Promise.reject(new Error('the caller reads through lawsOf')),
  };
  return { repo, puts };
}

function fakeModel(reply: unknown): { ask: AskLaws; calls: string[] } {
  const calls: string[] = [];
  return { calls, ask: ({ user }) => { calls.push(user); return Promise.resolve({ ok: true, reply }); } };
}

describe('ensuring a verdict', () => {
  it('judges the latest spec against the pack\'s laws, under the root and owners its config names, and keeps it', async () => {
    const { repo, puts } = fakeRepository(INPUT);
    const { ask, calls } = fakeModel({ findings: [{ law: 'BL-QUOTES-1', quote: 'sent with a zero total' }] });
    const ensured = await verdictService({ service: repo, ask }).ensure('d-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('BL-QUOTES-2');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.version).toBe('v-1');
    expect(puts[0]?.sha).toBe(SHA);
    expect(puts[0]?.verdict).toMatchObject({ state: 'red', laws: ['BL-QUOTES-1'], domains: [{ key: 'quotes', reasons: ['areas'], name: 'Quotes' }] });
    expect(puts[0]?.verdict.findings[0]?.owners).toEqual(['ana', 'bo']);
    expect(ensured).toMatchObject({ kept: { state: 'red' } });
  });

  it('answers the verdict kept at the spec and pack, and never asks the model again', async () => {
    const { repo, puts } = fakeRepository({ ...INPUT, verdict: kept({ state: 'neutral', reason: 'no model key on this deployment' }) });
    const { ask, calls } = fakeModel({ findings: [] });
    expect(await verdictService({ service: repo, ask }).ensure('d-1')).toEqual({ kept: kept({ state: 'neutral', reason: 'no model key on this deployment' }) });
    expect(calls).toEqual([]);
    expect(puts).toEqual([]);
  });

  it('keeps a neutral, with why, when there is no model key', async () => {
    const { repo, puts } = fakeRepository(INPUT);
    await verdictService({ service: repo, ask: null }).ensure('d-1');
    expect(puts[0]?.verdict).toMatchObject({ state: 'neutral', reason: 'no model key on this deployment', findings: [] });
  });

  it('keeps nothing, saying why, for no ◆ PRD, no spec, no law home, no pack or no law', async () => {
    const { ask, calls } = fakeModel({ findings: [] });
    const cases: [JudgeInput | null, string][] = [
      [null, 'not-judged-here'],
      [{ ...INPUT, server: false }, 'not-judged-here'],
      [{ ...INPUT, specVersion: null, spec: null }, 'not-judged-here'],
      [{ ...INPUT, lawHome: null, pack: null }, 'no-law-home'],
      [{ ...INPUT, pack: null }, 'no-pack'],
      [{ ...INPUT, pack: { sha: SHA, files: [] } }, 'no-law'],
    ];
    for (const [input, none] of cases) {
      const { repo, puts } = fakeRepository(input);
      expect(await verdictService({ service: repo, ask }).ensure('d-1')).toEqual({ none });
      expect(puts).toEqual([]);
    }
    expect(calls).toEqual([]);
  });

  it('reads the default root and no owner from a pack with no config, or one that does not parse', async () => {
    const files = [{ path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: LAW }];
    for (const extra of [[], [{ path: '.omni-loop/config.yml', content: 'kit: [' }]]) {
      const { repo, puts } = fakeRepository({ ...INPUT, pack: { sha: SHA, files: [...files, ...extra] } });
      await verdictService({ service: repo, ask: fakeModel({ findings: [{ law: 'BL-QUOTES-1', quote: 'zero total' }] }).ask }).ensure('d-1');
      expect(puts[0]?.verdict.findings.map((f) => [f.law, f.owners])).toEqual([['BL-QUOTES-1', []]]);
    }
  });
});

describe('what the page shows', () => {
  const standing = (read: Partial<Standing> | null) => () => Promise.resolve(read === null ? null : { dossier: 'd-1', specVersion: 'v-1', lawHome: 'acme/plan', packSha: SHA, verdict: null, ...read });

  it('is nothing for a stranger, a product with no law home, or no spec', async () => {
    const { repo } = fakeRepository(INPUT);
    const { ask, calls } = fakeModel({ findings: [] });
    const service = verdictService({ service: repo, ask });
    expect(await service.lawsOf('d-1', standing(null))).toEqual({ show: 'nothing' });
    expect(await service.lawsOf('d-1', standing({ lawHome: null, packSha: null }))).toEqual({ show: 'nothing' });
    expect(await service.lawsOf('d-1', standing({ specVersion: null }))).toEqual({ show: 'nothing' });
    expect(calls).toEqual([]);
  });

  it('is the verdict the member reads, judged first when there is none at the newest pack', async () => {
    const { repo, puts } = fakeRepository(INPUT);
    const service = verdictService({ service: repo, ask: fakeModel({ findings: [] }).ask });
    expect(await service.lawsOf('d-1', standing({ verdict: kept({ state: 'red' }) }))).toEqual({ show: 'verdict', verdict: kept({ state: 'red' }) });
    expect(puts).toEqual([]);
    expect(await service.lawsOf('d-1', standing({}))).toMatchObject({ show: 'verdict', verdict: { state: 'green' } });
    expect(puts).toHaveLength(1);
  });

  it('says not judged when the law home has no pack yet', async () => {
    const service = verdictService({ service: fakeRepository(INPUT).repo, ask: null });
    expect(await service.lawsOf('d-1', standing({ packSha: null }))).toEqual({ show: 'not-judged', why: 'the law home has no knowledge pack yet' });
  });

  it('is nothing when the pack holds no law, and not judged when a read fails, never thrown', async () => {
    expect(await verdictService({ service: fakeRepository({ ...INPUT, pack: { sha: SHA, files: [] } }).repo, ask: null }).lawsOf('d-1', standing({}))).toEqual({ show: 'nothing' });
    const failing = verdictService({ service: fakeRepository(new Error('down')).repo, ask: null });
    expect(await failing.lawsOf('d-1', standing({}))).toEqual({ show: 'not-judged', why: 'the verdict could not be read' });
    expect(await failing.lawsOf('d-1', () => Promise.reject(new Error('down')))).toEqual({ show: 'not-judged', why: 'the verdict could not be read' });
  });
});
