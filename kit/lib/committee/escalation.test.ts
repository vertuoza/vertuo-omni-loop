// PRD 2896 s9: the escalation list, pure, read by code before any member runs. PRD omni-loop-21 s2: each of its lines now
// goes to the members, then to a person at landing (a carried or deferred decision stays open for them on the mission
// pull request), but a PRD approved by its phase-0 pull request, which only a person merges.
import { describe, expect, it } from 'vitest';
import { bearsOn, decide, decisionLine, escalations, itemFacts, jevScore, rewritesData, routes, type ApprovalFacts, type AnswerFacts } from './escalation.ts';
import { COMMITTEE_ROLES, type MemberVerdict } from './vote.ts';

const approval = (over: Partial<ApprovalFacts> = {}): ApprovalFacts => ({
  kind: 'approve', phase0: 'server', lockedLaws: [], legal: [], redBusinessLaws: [], dataMigrations: [], ...over,
});
const answer = (over: Partial<AnswerFacts> = {}): AnswerFacts => ({
  kind: 'answer', rank: 'high', lockedLaws: [], legal: [], redBusinessLaws: [], dataMigrations: [], hardToRevert: 0.2, bound: 0.6, ...over,
});
const threeYes: MemberVerdict[] = COMMITTEE_ROLES.map((role) => ({ role, answer: 'yes', sentence: 'In scope.' }));

describe('the escalation list', () => {
  it('lets through a PRD born on the server that bears on no law, no Legal entry, no red business law and no data migration', () => {
    expect(escalations(approval())).toEqual([]);
  });

  it('lists a PRD approved by its phase-0 pull request: only a person merges that', () => {
    expect(escalations(approval({ phase0: 'pr' }))).toEqual(['it is approved by its phase-0 pull request, which only a person merges']);
  });

  it('lists a PRD bearing on a locked law, naming it', () => {
    expect(escalations(approval({ lockedLaws: ['N-PRODUCT-15', 'BR-PRODUCT-5'] }))).toEqual(['it bears on the locked laws N-PRODUCT-15, BR-PRODUCT-5: their owners decide']);
    expect(escalations(approval({ lockedLaws: ['N-PRODUCT-15'] }))).toEqual(['it bears on the locked law N-PRODUCT-15: its owner decides']);
  });

  it('lists a PRD bearing on a Legal entry', () => {
    expect(escalations(approval({ legal: ['L-GDPR-4'] }))).toEqual(['it bears on the Legal entry L-GDPR-4']);
  });

  it('lists a PRD whose spec a business law judged red', () => {
    expect(escalations(approval({ redBusinessLaws: ['BL-APPROVALS-1'] }))).toEqual(['its spec breaks the business law BL-APPROVALS-1']);
  });

  it('lists a migration that drops or rewrites data', () => {
    expect(escalations(approval({ dataMigrations: ['supabase/migrations/1_x.sql'] }))).toEqual(['the migration supabase/migrations/1_x.sql drops or rewrites data']);
  });

  it('lists a human-action item', () => {
    expect(escalations(answer({ rank: 'human-action' }))).toEqual(['it is a human-action item: only a person can act on it']);
  });

  it('lists an item at or above the mission\'s hard-to-revert bound, and lets one below it through', () => {
    expect(escalations(answer({ hardToRevert: 0.6 }))).toEqual(['its hard-to-revert score 0.6 is at or above the mission\'s bound 0.6']);
    expect(escalations(answer({ hardToRevert: 0.59 }))).toEqual([]);
  });

  it('lists an item with no hard-to-revert score: unknown is never under the bound', () => {
    expect(escalations(answer({ hardToRevert: null }))).toEqual(['its hard-to-revert score is unknown']);
  });

  it('names every line that applies, in the list\'s order', () => {
    expect(escalations(approval({ phase0: 'pr', legal: ['L-GDPR-3'], lockedLaws: ['N-PRODUCT-15'] }))).toEqual([
      'it is approved by its phase-0 pull request, which only a person merges',
      'it bears on the locked law N-PRODUCT-15: its owner decides',
      'it bears on the Legal entry L-GDPR-3',
    ]);
  });
});

describe('the routing (PRD omni-loop-21 s2)', () => {
  it('sends every case of the list to the members, then to a person at landing, naming the case', () => {
    for (const facts of [
      approval({ lockedLaws: ['N-PRODUCT-15'] }),
      approval({ legal: ['L-AIACT-1'] }),
      approval({ redBusinessLaws: ['BL-GATE-1'] }),
      approval({ dataMigrations: ['m.sql'] }),
      answer({ rank: 'human-action' }),
      answer({ lockedLaws: ['BR-PRODUCT-5'] }),
      answer({ legal: ['L-GDPR-4'] }),
      answer({ businessLaws: ['BL-GATE-1'] }),
      answer({ hardToRevert: 0.9 }),
      answer({ hardToRevert: null }),
      answer({ dataMigrations: ['m.sql'] }),
    ]) {
      const [only, ...rest] = routes(facts);
      expect(rest, JSON.stringify(facts)).toEqual([]);
      expect(only, JSON.stringify(facts)).toEqual({ case: escalations(facts)[0], to: 'to the members, then to a person at landing' });
    }
  });

  it('keeps a PRD approved by its phase-0 pull request a person\'s: only a person merges that', () => {
    expect(routes(approval({ phase0: 'pr' }))).toEqual([{ case: 'it is approved by its phase-0 pull request, which only a person merges', to: 'to a person' }]);
  });

  it('routes each line that applies, in the list\'s order, and none for a case on no line', () => {
    expect(routes(approval({ phase0: 'pr', legal: ['L-GDPR-3'] })).map((route) => route.to)).toEqual(['to a person', 'to the members, then to a person at landing']);
    expect(routes(approval())).toEqual([]);
    expect(routes(answer())).toEqual([]);
  });
});

describe('the decision', () => {
  const no: MemberVerdict = { role: 'reviewer', answer: 'no', sentence: 'Out of scope.' };
  const twoYesAnd = (last: MemberVerdict): MemberVerdict[] => [...threeYes.slice(0, 2), last];

  it('carries on three yes when the list lets it through', () => {
    expect(decide(approval(), threeYes, null)).toEqual({ outcome: 'carried', listed: [], why: [], verdicts: threeYes, option: null });
    expect(decisionLine(decide(approval(), threeYes, null))).toBe('carried');
  });

  it('AC-5: carries an item bearing on a business law on three yes, recorded on the escalation list', () => {
    const decided = decide(answer({ businessLaws: ['BL-GATE-1'] }), threeYes, null);
    expect(decided).toEqual({
      outcome: 'carried',
      listed: ['it bears on the business law BL-GATE-1: a person decides'],
      why: ['on the escalation list: it bears on the business law BL-GATE-1: a person decides'],
      verdicts: threeYes,
      option: null,
    });
    expect(decisionLine(decided)).toBe('carried · on the escalation list');
  });

  it('AC-5: defers an item bearing on a business law on a no, with option A, the most reversible, and the reasons', () => {
    const decided = decide(answer({ businessLaws: ['BL-GATE-1'] }), twoYesAnd(no), null);
    expect(decided).toEqual({
      outcome: 'deferred',
      listed: ['it bears on the business law BL-GATE-1: a person decides'],
      why: ['on the escalation list: it bears on the business law BL-GATE-1: a person decides', 'the Reviewer answered no: Out of scope.'],
      verdicts: twoYesAnd(no),
      option: 'A',
    });
    expect(decisionLine(decided)).toBe('deferred · option A');
  });

  it('defers an item on an unsure, a failed or a timed-out member, and on a vote that does not read whole', () => {
    for (const last of [
      { role: 'reviewer', answer: 'unsure', sentence: 'Cannot tell.' },
      { role: 'reviewer', answer: 'failed', sentence: 'Its agent failed: boom' },
      { role: 'reviewer', answer: 'timeout', sentence: 'No verdict within 20 minutes.' },
      { role: 'architect', answer: 'yes', sentence: 'Again.' },
    ] satisfies MemberVerdict[]) {
      expect(decide(answer({ hardToRevert: 0.9 }), twoYesAnd(last), null), JSON.stringify(last)).toMatchObject({ outcome: 'deferred', option: 'A' });
    }
    expect(decide(answer({ hardToRevert: 0.9 }), threeYes, 'pm')).toMatchObject({
      outcome: 'deferred',
      why: ["on the escalation list: its hard-to-revert score 0.9 is at or above the mission's bound 0.6", 'the PM wrote it and may not vote on it'],
    });
  });

  it('carries every case of the list on every sitting yes, the author sitting out, and defers it on a no', () => {
    for (const facts of [
      answer({ rank: 'human-action' }),
      answer({ lockedLaws: ['N-PRODUCT-15'] }),
      answer({ legal: ['L-AIACT-1'] }),
      answer({ hardToRevert: null }),
      answer({ dataMigrations: ['m.sql'] }),
    ]) {
      expect(decide(facts, threeYes, null), JSON.stringify(facts)).toMatchObject({ outcome: 'carried', listed: escalations(facts), option: null });
      expect(decide(facts, threeYes.filter((verdict) => verdict.role !== 'architect'), 'architect'), JSON.stringify(facts)).toMatchObject({ outcome: 'carried' });
      expect(decide(facts, twoYesAnd(no), null), JSON.stringify(facts)).toMatchObject({ outcome: 'deferred', listed: escalations(facts), option: 'A' });
    }
  });

  it('defers by vote an item the list lets through: the mission carries on', () => {
    expect(decide(answer(), twoYesAnd(no), null)).toEqual({ outcome: 'deferred', listed: [], why: ['the Reviewer answered no: Out of scope.'], verdicts: twoYesAnd(no), option: 'A' });
  });

  it('carries a PRD on the list on three yes, and never approves one without them: a no escalates it', () => {
    for (const facts of [approval({ lockedLaws: ['N-PRODUCT-15'] }), approval({ legal: ['L-AIACT-1'] }), approval({ redBusinessLaws: ['BL-GATE-1'] }), approval({ dataMigrations: ['m.sql'] })]) {
      const carried = decide(facts, threeYes, null);
      expect(carried, JSON.stringify(facts)).toMatchObject({ outcome: 'carried', listed: escalations(facts), option: null });
      expect(decisionLine(carried)).toBe('carried · on the escalation list');
      expect(decide(facts, twoYesAnd(no), null), JSON.stringify(facts)).toMatchObject({
        outcome: 'escalated',
        option: null,
        why: [`on the escalation list: ${escalations(facts).join('')}`, 'the Reviewer answered no: Out of scope.'],
      });
    }
  });

  it('escalates by vote a PRD the list lets through', () => {
    const decided = decide(approval(), twoYesAnd(no), null);
    expect(decided).toMatchObject({ outcome: 'escalated', listed: [], why: ['the Reviewer answered no: Out of scope.'], option: null });
    expect(decisionLine(decided)).toBe('escalated');
  });

  it('escalates by rule a PRD approved by its phase-0 pull request although three members answer yes, the vote only recorded', () => {
    expect(decide(approval({ phase0: 'pr', legal: ['L-GDPR-4'] }), threeYes, null)).toEqual({
      outcome: 'escalated',
      listed: ['it is approved by its phase-0 pull request, which only a person merges', 'it bears on the Legal entry L-GDPR-4'],
      why: ['it is approved by its phase-0 pull request, which only a person merges'],
      verdicts: threeYes,
      option: null,
    });
  });
});

describe('what a PRD bears on', () => {
  it('names each locked law the text names as a word, and each Legal entry', () => {
    const text = 'Keeps N-PRODUCT-15 and BR-PRODUCT-5; L-GDPR-4 and L-AIACT-1 too. N-PRODUCT-150 is no law here.';
    expect(bearsOn(text, ['N-PRODUCT-15', 'BR-PRODUCT-5', 'BR-PRODUCT-12'])).toEqual({ lockedLaws: ['N-PRODUCT-15', 'BR-PRODUCT-5'], legal: ['L-GDPR-4', 'L-AIACT-1'] });
  });

  it('names nothing in a text that names no id', () => {
    expect(bearsOn('A plain change.', ['N-PRODUCT-15'])).toEqual({ lockedLaws: [], legal: [] });
  });
});

describe('a migration that drops or rewrites data', () => {
  it('is one that drops a table or a column, truncates, deletes, updates rows or changes a column\'s type', () => {
    for (const sql of [
      'drop table public.x;',
      'alter table public.x drop column y;',
      'truncate public.x;',
      'delete from public.x where true;',
      'update public.virtual_heroes h set skills = array[]::text[];',
      'alter table public.x alter column y type bigint;',
    ]) expect(rewritesData(sql), sql).toBe(true);
  });

  it('is not one that only adds, nor one whose words are in a comment', () => {
    for (const sql of [
      'create table public.x (id uuid);',
      'alter table public.x add column y text;',
      'alter table public.x drop constraint if exists x_check;',
      '-- drop table public.x;\ncreate index x on public.y (z);',
      'create or replace function f() returns void language sql as $$ select 1 $$;',
    ]) expect(rewritesData(sql), sql).toBe(false);
  });
});

// PRD 2896 s10: what the list reads of a high outbox item, from the item's own text.
describe('an item\'s facts', () => {
  const itemText = (over: { rank?: string; bearsOn?: string; decide?: string; body?: string } = {}): string =>
    [
      '---',
      'id: s3-01-keep-the-cap',
      'prd: 2896',
      'slice: s3',
      `rank: ${over.rank ?? 'high'}`,
      `bears-on: ${over.bearsOn ?? 'none'}`,
      'raised: 2026-11-16',
      'wave: 3',
      '---',
      '',
      '## The question, in plain words',
      '',
      over.body ?? 'Should the cap stay at five?',
      '',
      '## What I had to decide',
      '',
      over.decide ?? 'Whether the cap is five.',
      '',
    ].join('\n');

  it('reads its rank, the mission\'s bound and the migrations it was handed', () => {
    expect(itemFacts({ text: itemText(), rank: 'high', locked: [], bound: 0.6, dataMigrations: ['m.sql'] })).toEqual({
      kind: 'answer', rank: 'high', lockedLaws: [], legal: [], redBusinessLaws: [], businessLaws: [], dataMigrations: ['m.sql'], hardToRevert: null, bound: 0.6,
    });
  });

  it('reads the locked law, the Legal entry and the business law it bears on, in its front matter or its words', () => {
    const facts = itemFacts({ text: itemText({ bearsOn: 'BR-PRODUCT-5', body: 'Keeps L-GDPR-4 and BL-GATE-1.' }), rank: 'high', locked: ['BR-PRODUCT-5', 'N-PRODUCT-15'], bound: 0.6, dataMigrations: [] });
    expect(facts).toMatchObject({ lockedLaws: ['BR-PRODUCT-5'], legal: ['L-GDPR-4'], businessLaws: ['BL-GATE-1'] });
  });

  it('reads its hard-to-revert score from Jev\'s line, and none without it', () => {
    expect(jevScore(itemText({ decide: 'Whether.\nDecided by: Jev (hardToRevert 0.55) · agent said true' }))).toBe(0.55);
    expect(jevScore(itemText({ decide: 'Decided by: Jev (hardToRevert 1) · agent said false' }))).toBe(1);
    expect(jevScore(itemText())).toBeNull();
    expect(jevScore(itemText({ decide: 'Decided by: Jev (hardToRevert 1.5) · agent said true' }))).toBeNull();
  });

  it('lists an item bearing on a business law: the committee cannot tell whether it breaks it', () => {
    expect(escalations(answer({ businessLaws: ['BL-GATE-1'] }))).toEqual(['it bears on the business law BL-GATE-1: a person decides']);
    expect(escalations(answer({ businessLaws: ['BL-GATE-1', 'BL-ASK-1'] }))).toEqual(['it bears on the business laws BL-GATE-1, BL-ASK-1: a person decides']);
  });

  it('lets through an item Jev scored under the bound that bears on nothing, and carries it on three yes', () => {
    const facts = itemFacts({ text: itemText({ decide: 'Decided by: Jev (hardToRevert 0.3) · agent said true' }), rank: 'high', locked: [], bound: 0.6, dataMigrations: [] });
    expect(escalations(facts)).toEqual([]);
    expect(decide(facts, threeYes, null)).toMatchObject({ outcome: 'carried' });
  });
});
