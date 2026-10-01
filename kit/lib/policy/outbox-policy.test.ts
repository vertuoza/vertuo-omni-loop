// @ts-nocheck
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COMMANDS } from '../commands.ts';
import { compare, parseAccount } from '../outbox/account.ts';
import { floorRank, parseOutboxItem, RANK_VALUES } from '../outbox/outbox.ts';
import { AnswerSchema, adoptItem } from '../outbox/settle.ts';
import { gateResult } from '../outbox/status.ts';
import { flatCtx } from '../../test/flat-layout.ts';
import {
  ACCOUNT_FORMS,
  asksAbout,
  AUTHOR_MARK,
  consult,
  consultationPolicy,
  CONSULTATION_POLICIES,
  decideRecording,
  planAccount,
  proposeRank,
  renderAccount,
  renderOutboxItem,
  SLICE_STATUSES,
  SLICE_TIME_GUARD,
  sliceTimeGuardCommand,
  unknowable,
} from './outbox-policy.ts';

const COMMAND_NAMES = Object.keys(CONSULTATION_POLICIES);

/**
 * The laws every test in this file injects — same shape and same regex as the stub
 * `kit/lib/outbox/outbox.test.ts` uses (Task 5): `floorsHigh` reproduces upstream's own
 * `bearsOnFloorsHigh` regex so the pure decideRecording/proposeRank/renderOutboxItem cases below
 * need no filesystem. `source: 'knowledge'` is what makes the `principlesConflict` stop apply, per
 * this task's own clarification (see `kit/porting/policy--outbox-policy.md`).
 */
const laws = {
  source: 'knowledge',
  floorsHigh: (b) => /^(N\d+|(?:P|BR|N)-[A-Z0-9]+-\d+|X-[A-Z0-9]+-[A-Z0-9]+-\d+)$/.test(b),
};

/** A ctx whose `root` is never touched by disk — `planAccount`/`accountFile` only build a path
 * string from `ctx.layout.outboxDir(prd)`, and `flatLayout`'s `outboxDir` never reads the tree. */
const ctx = flatCtx('/virtual-repo');

/** The fields `renderOutboxItem` needs that no test below cares about. */
function itemFields(overrides = {}) {
  return {
    id: 's7-01-default-country',
    prd: 985,
    slice: 's7',
    wave: 4,
    raised: '2026-09-22',
    bearsOn: 'none',
    rank: 'medium',
    questionPlain: 'Which country should we save for a contact that has none of its own?',
    decisionPlain: "We use the tenant's own country as the default.",
    decide: 'Which country a contact with no country of its own is saved under.',
    meanwhile: 'The tenant’s own country, because a different answer is one constant away.',
    cost: 'One constant in the builder, and a re-read of the contacts already saved.',
    gaps: ['the PRD names no country for a contact that carries none'],
    options: [
      "Use the tenant's own country as the default, the option built.",
      'Leave the country empty until the contact sets one.',
    ],
    laws,
    ...overrides,
  };
}

describe('An agent records instead of stopping', () => {
  it('a product question does not stop the wave — the most reversible option, an item, and the slice carries on', () => {
    const decision = decideRecording({ bearsOn: 'none', laws });

    expect(decision.outcome).toBe('record');
    expect(decision.sliceStatus).toBe('done');
    expect(decision.writesItem).toBe(true);
    expect(decision.stopsTheWave).toBe(false);
    expect(decision.rank).toBe('medium');
    expect(decision.rule).toBeNull();
  });

  // PRD #1166, slice s5 — "A medium item is adopted when it is raised".
  it('a medium record is adopted straight to the ledger, never written as an open item', () => {
    const decision = decideRecording({ bearsOn: 'none', laws });

    expect(decision.rank).toBe('medium');
    expect(decision.settleAsAdopted).toBe(true);
  });

  it('end to end: a medium record adopts through adoptItem, and the gate stays green with no open file', () => {
    const decision = decideRecording({ bearsOn: 'none', laws });
    expect(decision.settleAsAdopted).toBe(true);

    const text = renderOutboxItem(itemFields({ rank: decision.rank }));
    const root = mkdtempSync(join(tmpdir(), 'outbox-policy-adopt-'));
    try {
      const tctx = flatCtx(root);
      const adopted = adoptItem({ ctx: tctx, itemText: text });
      expect(adopted.ok).toBe(true);

      expect(existsSync(join(root, 'docs/outbox/985/s7-01-default-country.md'))).toBe(false);
      expect(gateResult('985', { ctx: tctx })).toEqual({
        ok: true,
        items: [],
        overridden: false,
        unreworked: [],
        overrideLabel: 'omni:outbox-go',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a high record still writes an open item file — only medium is adopted', () => {
    const decision = decideRecording({ bearsOn: 'none', hardToRevert: true, laws });

    expect(decision.rank).toBe('high');
    expect(decision.settleAsAdopted).toBe(false);
  });

  it('the item it writes for that question is one the outbox guard accepts', () => {
    const decision = decideRecording({ bearsOn: 'none', laws });
    const text = renderOutboxItem(itemFields({ rank: decision.rank }));

    const parsed = parseOutboxItem(text, { file: 'docs/outbox/985/s7-01-default-country.md' });
    expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
    expect(parsed.item.rank).toBe('medium');
    expect(parsed.item.bearsOn).toBe('none');
  });

  it('a breach it can name stops that slice, names the rule, and takes no sibling with it', () => {
    const decision = decideRecording({ bearsOn: 'BR-ACCESS-1', breaksNamedLaw: true, laws });

    expect(decision.outcome).toBe('stop');
    expect(decision.sliceStatus).toBe('stopped');
    expect(decision.rule).toBe('BR-ACCESS-1');
    expect(decision.stopsTheWave).toBe(false);
    expect(decision.writesItem).toBe(false);
  });

  it('an invariant is a law too', () => {
    expect(decideRecording({ bearsOn: 'N3', breaksNamedLaw: true, laws }).outcome).toBe('stop');
    expect(decideRecording({ bearsOn: 'N3', breaksNamedLaw: true, laws }).rule).toBe('N3');
  });

  it('a breach it cannot name is not a stop — it is recorded, high', () => {
    const decision = decideRecording({ bearsOn: 'none', breaksNamedLaw: true, laws });

    expect(decision.outcome).toBe('record');
    expect(decision.rank).toBe('high');
    expect(decision.rule).toBeNull();
    expect(decision.reason).toMatch(/name/i);
    expect(decision.settleAsAdopted).toBe(false);
  });

  it('a needed human action writes a human-action item and returns blocked', () => {
    const decision = decideRecording({ bearsOn: 'none', needsHumanAction: true, laws });

    expect(decision.outcome).toBe('blocked');
    expect(decision.sliceStatus).toBe('blocked');
    expect(decision.rank).toBe('human-action');
    expect(decision.writesItem).toBe(true);
    expect(decision.stopsTheWave).toBe(false);
    expect(decision.settleAsAdopted).toBe(false);
  });

  it('a human action outranks everything — even a law it could name', () => {
    const decision = decideRecording({
      bearsOn: 'BR-ACCESS-1',
      breaksNamedLaw: true,
      needsHumanAction: true,
      laws,
    });
    expect(decision.outcome).toBe('blocked');
  });

  describe('Two principles in conflict stop the slice (PRD #1081)', () => {
    it('two principles in conflict stop the slice', () => {
      // Given a slice whose decision is pulled apart by "P-ADVISOR-2" and "P-PRODUCT-1"
      const decision = decideRecording({
        principlesConflict: ['P-ADVISOR-2', 'P-PRODUCT-1'],
        laws,
      });

      // Then the slice stops
      expect(decision.outcome).toBe('stop');
      expect(decision.sliceStatus).toBe('stopped');
      expect(decision.stopsTheWave).toBe(false);
      // And the item is ranked "high" naming both principles
      expect(decision.writesItem).toBe(true);
      expect(decision.rank).toBe('high');
      expect(decision.principles).toEqual(['P-ADVISOR-2', 'P-PRODUCT-1']);
      expect(decision.reason).toContain('P-ADVISOR-2');
      expect(decision.reason).toContain('P-PRODUCT-1');
    });

    it('every principle in the conflict is named, not just the first two', () => {
      const decision = decideRecording({
        principlesConflict: ['P-ADVISOR-2', 'P-PRODUCT-1', 'P-CREDITS-1'],
        laws,
      });
      expect(decision.principles).toEqual(['P-ADVISOR-2', 'P-PRODUCT-1', 'P-CREDITS-1']);
      for (const id of decision.principles) expect(decision.reason).toContain(id);
    });

    it('a conflict stops the slice even when nothing else is remarkable', () => {
      const decision = decideRecording({
        bearsOn: 'none',
        principlesConflict: ['P-ADVISOR-2', 'P-PRODUCT-1'],
        laws,
      });
      expect(decision.outcome).toBe('stop');
    });

    it('a single principle is not a conflict — naming only one is refused', () => {
      expect(() => decideRecording({ principlesConflict: ['P-ADVISOR-2'], laws })).toThrow(/two/);
    });

    it('only principles can conflict — a rule or an invariant id is refused', () => {
      expect(() =>
        decideRecording({ principlesConflict: ['P-ADVISOR-2', 'BR-ERPWRITE-1'], laws }),
      ).toThrow(/BR-ERPWRITE-1/);
    });

    it('an empty list is no conflict — the slice records and carries on', () => {
      expect(decideRecording({ principlesConflict: [], laws }).outcome).toBe('record');
    });

    it('a human action still outranks a conflict', () => {
      const decision = decideRecording({
        principlesConflict: ['P-ADVISOR-2', 'P-PRODUCT-1'],
        needsHumanAction: true,
        laws,
      });
      expect(decision.outcome).toBe('blocked');
    });

    it('the consultation policies are unchanged', () => {
      expect(CONSULTATION_POLICIES[COMMANDS.deliver].asksAbout).toEqual(['high', 'human-action']);
      expect(CONSULTATION_POLICIES[COMMANDS.yolo].asksAbout).toEqual([]);
    });

    // This task's own clarification: a `principlesConflict` only ever stops the slice where a
    // `P-…` id can resolve at all — a repository with no knowledge register has no principles.
    it('a conflict is read as none at all where laws.source is not "knowledge"', () => {
      const noKnowledge = { source: 'none', floorsHigh: () => false };
      const decision = decideRecording({
        bearsOn: 'none',
        principlesConflict: ['P-ADVISOR-2', 'P-PRODUCT-1'],
        laws: noKnowledge,
      });
      expect(decision.outcome).toBe('record');
    });
  });

  describe('An ADR is not a law', () => {
    it('the slice carries on, and the item is ranked high', () => {
      const decision = decideRecording({ bearsOn: 'ADR-0069', breaksNamedLaw: true, laws });

      expect(decision.outcome).toBe('record');
      expect(decision.sliceStatus).toBe('done');
      expect(decision.rank).toBe('high');
      expect(decision.rule).toBeNull();
    });

    it('contradicting an ADR is high even when nothing else is remarkable about it', () => {
      expect(proposeRank({ bearsOn: 'ADR-0037', laws })).toBe('high');
    });

    it('the policy proposes that high ITSELF — the register floor never sees an ADR', () => {
      // The seam this rule exists for: `floorRank` floors only on an id `laws.floorsHigh`
      // recognizes, exactly as the plan's Durable decisions say it should. An ADR id passes
      // straight through it. So a policy that proposed `medium` and leaned on the floor would ship
      // a `medium` item for an ADR contradiction and nothing would ever say so.
      expect(floorRank('ADR-0069', 'medium', laws)).toBe('medium');
      expect(proposeRank({ bearsOn: 'ADR-0069', laws })).toBe('high');
    });
  });

  describe('The agent does not invent a reason', () => {
    it('the gap is stated and attributed to the author', () => {
      const note = unknowable(['the PRD names no country for a contact that carries none']);

      expect(note.startsWith(AUTHOR_MARK)).toBe(true);
      expect(note).toContain('the PRD names no country for a contact that carries none');
      expect(note).toMatch(/do not settle/i);
    });

    it('with nothing to say it refuses rather than drafting a because nobody said', () => {
      expect(() => unknowable([])).toThrow(/never invent/i);
      expect(() => renderOutboxItem(itemFields({ gaps: [] }))).toThrow(/never invent/i);
    });

    it('the rendered item carries the attribution in its own section', () => {
      const parsed = parseOutboxItem(renderOutboxItem(itemFields()));
      expect(parsed.ok).toBe(true);
      expect(parsed.item.sections.whatICouldNotKnow.startsWith(AUTHOR_MARK)).toBe(true);
    });
  });

  describe('Every item carries its plain words (PRD #1071)', () => {
    it('renders the two plain-words sections first, before the four existing ones', () => {
      const parsed = parseOutboxItem(renderOutboxItem(itemFields()));
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.item.sections.questionPlain).toBe(
        'Which country should we save for a contact that has none of its own?',
      );
      expect(parsed.item.sections.decisionPlain).toBe(
        "We use the tenant's own country as the default.",
      );
    });

    it('refuses to render without a plain question or a plain decision', () => {
      expect(() => renderOutboxItem(itemFields({ questionPlain: '' }))).toThrow(/plain words/i);
      expect(() => renderOutboxItem(itemFields({ decisionPlain: '  ' }))).toThrow(/plain words/i);
    });
  });

  describe('Every question carries its options (PRD #1166, slice s4)', () => {
    it('letters the options A, B… itself, right after the plain decision', () => {
      const parsed = parseOutboxItem(renderOutboxItem(itemFields()));
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.item.sections.options).toEqual([
        { letter: 'A', text: "Use the tenant's own country as the default, the option built." },
        { letter: 'B', text: 'Leave the country empty until the contact sets one.' },
      ]);
      expect(parsed.item.sections.personSteps).toBeUndefined();
    });

    it('refuses to render with fewer than two options, or more than four', () => {
      expect(() => renderOutboxItem(itemFields({ options: ['Only one'] }))).toThrow(/two to four/i);
      expect(() => renderOutboxItem(itemFields({ options: ['a', 'b', 'c', 'd', 'e'] }))).toThrow(
        /two to four/i,
      );
    });

    it('a human-action item carries "what a person must do" instead, and no options', () => {
      const text = renderOutboxItem(
        itemFields({
          rank: 'human-action',
          options: undefined,
          personSteps: 'Add the missing secret to the console, then re-run the job.',
        }),
      );
      const parsed = parseOutboxItem(text);
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.item.rank).toBe('human-action');
      expect(parsed.item.sections.personSteps).toBe(
        'Add the missing secret to the console, then re-run the job.',
      );
      expect(parsed.item.sections.options).toBeUndefined();
    });

    it('refuses to render a human-action item with no person steps', () => {
      expect(() =>
        renderOutboxItem(itemFields({ rank: 'human-action', options: undefined, personSteps: '' })),
      ).toThrow(/what a person must do/i);
    });
  });

  describe('An item may carry an intro and a punchline (PRD #50, slice s1)', () => {
    const fun = {
      introFun: 'A contact with no country is a contact on a very long holiday.',
      punchlineFun: 'The tenant has a passport, so the contact borrows it.',
    };

    it('renders both right after the plain decision, before the options', () => {
      const text = renderOutboxItem(itemFields(fun));
      const parsed = parseOutboxItem(text);
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.item.sections.introFun).toBe(fun.introFun);
      expect(parsed.item.sections.punchlineFun).toBe(fun.punchlineFun);
      const at = (heading) => text.indexOf(`## ${heading}`);
      expect(at('The decision, in plain words')).toBeLessThan(at('The intro, for fun'));
      expect(at('The intro, for fun')).toBeLessThan(at('The punchline, for fun'));
      expect(at('The punchline, for fun')).toBeLessThan(at('The options, in plain words'));
    });

    it('renders both before the person steps of a human-action item', () => {
      const parsed = parseOutboxItem(
        renderOutboxItem(
          itemFields({
            ...fun,
            rank: 'human-action',
            options: undefined,
            personSteps: 'Add the missing secret to the console, then re-run the job.',
          }),
        ),
      );
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.item.sections.introFun).toBe(fun.introFun);
      expect(parsed.item.sections.personSteps).toMatch(/missing secret/);
    });

    it('renders neither when given neither, exactly as before', () => {
      const text = renderOutboxItem(itemFields());
      expect(text).not.toMatch(/for fun/);
      expect(renderOutboxItem(itemFields({ introFun: '  ', punchlineFun: null }))).toBe(text);
    });

    it('refuses to render one without the other', () => {
      expect(() => renderOutboxItem(itemFields({ introFun: fun.introFun }))).toThrow(
        /intro and (its|the) punchline/i,
      );
      expect(() => renderOutboxItem(itemFields({ punchlineFun: fun.punchlineFun }))).toThrow(
        /intro and (its|the) punchline/i,
      );
    });

    it('an adopted item embeds both in its settled entry', () => {
      const root = mkdtempSync(join(tmpdir(), 'outbox-policy-fun-'));
      try {
        const adopted = adoptItem({
          ctx: flatCtx(root),
          itemText: renderOutboxItem(itemFields(fun)),
        });
        expect(adopted.ok, adopted.ok ? '' : adopted.errors.join('\n')).toBe(true);
        expect(adopted.entry).toContain(`## The intro, for fun\n\n${fun.introFun}`);
        expect(adopted.entry).toContain(`## The punchline, for fun\n\n${fun.punchlineFun}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it('judgement may still escalate a decision that bears on nothing', () => {
    expect(decideRecording({ bearsOn: 'none', hardToRevert: true, laws }).rank).toBe('high');
  });

  it('the register floor is reused, never restated', () => {
    expect(proposeRank({ bearsOn: 'N1', laws })).toBe('high');
    expect(proposeRank({ bearsOn: 'BR-QUOTE-4', laws })).toBe('high');
  });
});

describe('Two commands ask at two different moments', () => {
  it('the policy is data — each command declares the ranks it asks about', () => {
    expect(CONSULTATION_POLICIES[COMMANDS.deliver].asksAbout).toEqual(['high', 'human-action']);
    expect(CONSULTATION_POLICIES[COMMANDS.yolo].asksAbout).toEqual([]);
  });

  it('an unknown command has no policy to guess at', () => {
    expect(() => consultationPolicy('/omni-ship-it')).toThrow(/omni-ship-it/);
  });

  describe('Delivery asks about a risky call while I am here', () => {
    it('a high item is asked about in the prompt', () => {
      expect(asksAbout(COMMANDS.deliver, 'high')).toBe(true);
      expect(asksAbout(COMMANDS.deliver, 'human-action')).toBe(true);
    });

    it('the answer settles the item at once, with the session named as the approver', () => {
      const outcome = consult({
        command: COMMANDS.deliver,
        rank: 'high',
        prd: 985,
        answer: 'Yes — the tenant’s country is right.',
        session: 'claude-opus-5 session 3f92cf00',
        at: '2026-09-22T09:15:00Z',
      });

      expect(outcome.asked).toBe(true);
      expect(outcome.settled).toBe(true);
      expect(outcome.answer.approvedBy).toContain('claude-opus-5 session 3f92cf00');
      expect(outcome.answer.text).toBe('Yes — the tenant’s country is right.');
      expect(outcome.answer.channel).toEqual({ kind: 'prd-issue', number: 985 });

      const parsed = AnswerSchema.safeParse(outcome.answer);
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
    });

    it('an answer with no session to attribute it to is refused rather than attributed to nobody', () => {
      expect(() =>
        consult({ command: COMMANDS.deliver, rank: 'high', prd: 985, answer: 'Yes.' }),
      ).toThrow(/session/i);
    });
  });

  describe('Delivery never interrupts for a medium call', () => {
    it('a medium item is not asked about, and is still recorded', () => {
      expect(asksAbout(COMMANDS.deliver, 'medium')).toBe(false);

      const outcome = consult({ command: COMMANDS.deliver, rank: 'medium', prd: 985 });
      expect(outcome.asked).toBe(false);
      expect(outcome.settled).toBe(false);
      expect(outcome.recorded).toBe(true);
    });
  });

  describe('Yolo asks nothing until the end', () => {
    it('no rank is asked about during the run, and the item is left open', () => {
      for (const rank of RANK_VALUES) {
        expect(asksAbout(COMMANDS.yolo, rank)).toBe(false);
      }

      const outcome = consult({ command: COMMANDS.yolo, rank: 'high', prd: 985 });
      expect(outcome.asked).toBe(false);
      expect(outcome.settled).toBe(false);
      expect(outcome.recorded).toBe(true);
    });
  });

  describe('Nobody is at the keyboard', () => {
    it('an unanswered question falls back to recording and the item stays open', () => {
      const outcome = consult({
        command: COMMANDS.deliver,
        rank: 'high',
        prd: 985,
        answer: '   ',
        session: 'claude-opus-5 session 3f92cf00',
      });

      expect(outcome.asked).toBe(true);
      expect(outcome.settled).toBe(false);
      expect(outcome.fellBackToRecording).toBe(true);
      expect(outcome.recorded).toBe(true);
      expect(outcome.stopped).toBe(false);
    });
  });

  it('an unanswered question is never a stop, whatever the command and whatever the rank', () => {
    for (const command of COMMAND_NAMES) {
      for (const rank of RANK_VALUES) {
        const outcome = consult({ command, rank, prd: 985 });
        expect(outcome.stopped, `${command} · ${rank}`).toBe(false);
        expect(outcome.recorded, `${command} · ${rank}`).toBe(true);
      }
    }
  });

  it('the recording path underneath is the same in both — consultation never touches the rank', () => {
    for (const command of COMMAND_NAMES) {
      for (const rank of RANK_VALUES) {
        expect(consult({ command, rank, prd: 985 }).rank).toBe(rank);
      }
    }
  });

  it('the three slice statuses a recording run can end on are named once', () => {
    expect(SLICE_STATUSES).toEqual(['done', 'stopped', 'blocked']);
  });
});

describe('The guard runs on the agent and on the branch', () => {
  /** A risky change in the shape `riskyChanges` hands over: the diff's status letter, and the rule. */
  function risky(path, rule, status = 'M') {
    return { path, status, rule };
  }

  const STORED_SHAPE = risky('libs/vertuo-ai-credit/src/server/migrations.ts', 'stored-shape');
  const SHARED_CONTRACT = risky('libs/system-api-contract/src/account.ts', 'shared-contract');

  describe('The agent is told before it opens its sub-pull-request', () => {
    it('names every risky change it owes an account for, keyed on the path AND the rule', () => {
      const plan = planAccount({
        prd: 1044,
        slice: 's6',
        graded: '2026-09-23',
        risky: [
          STORED_SHAPE,
          risky('libs/vertuo-ai-credit/src/server/migrations.ts', 'law-proof'),
          STORED_SHAPE,
        ],
        accountFor: () => ({ kind: 'spec', where: 'Scope > In' }),
        ctx,
      });

      expect(plan.owed).toEqual([
        { path: 'libs/vertuo-ai-credit/src/server/migrations.ts', rule: 'stored-shape' },
        { path: 'libs/vertuo-ai-credit/src/server/migrations.ts', rule: 'law-proof' },
      ]);
    });

    it('runs before the sub-pull-request is opened, over the slice’s own diff', () => {
      expect(SLICE_TIME_GUARD.runsBefore).toBe('the sub-pull-request is opened');
      expect(SLICE_TIME_GUARD.range).toBe(
        'the slice branch against the feature branch it was cut from',
      );
    });

    it('spells the base and the PRD out, because a bare run grades no range at all', () => {
      expect(SLICE_TIME_GUARD.needsExplicitArguments).toBe(true);
      expect(sliceTimeGuardCommand({ base: 'origin/feat/decision-coverage', prd: 1044 })).toBe(
        'node .omni-loop/bin/omni.mjs check coverage --base origin/feat/decision-coverage --prd 1044',
      );
      expect(() => sliceTimeGuardCommand({ base: 'origin/feat/x' })).toThrow(/prd/i);
      expect(() => sliceTimeGuardCommand({ prd: 1044 })).toThrow(/base/i);
    });

    it('accounts for them before opening: what it writes leaves nothing unaccounted', () => {
      const plan = planAccount({
        prd: 1044,
        slice: 's6',
        graded: '2026-09-23',
        risky: [STORED_SHAPE, SHARED_CONTRACT],
        accountFor: (change) =>
          change.rule === 'stored-shape'
            ? { kind: 'item', id: 's6-01-credit-ledger-shape' }
            : { kind: 'spec', where: 'Scope > In — the shared contract' },
        ctx,
      });

      expect(plan.writesFile).toBe(true);
      expect(plan.file).toBe('docs/outbox/1044/accounts/s6.md');

      const parsed = parseAccount(plan.text, { file: plan.file });
      expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true);
      expect(parsed.account.slice).toBe('s6');

      expect(compare([STORED_SHAPE, SHARED_CONTRACT], [parsed.account])).toEqual({
        accounted: [STORED_SHAPE, SHARED_CONTRACT],
        unaccounted: [],
        stale: [],
      });
    });

    it('writes no file at all when nothing fired — silence stays free where nothing was risky', () => {
      const plan = planAccount({
        prd: 1044,
        slice: 's6',
        graded: '2026-09-23',
        risky: [],
        accountFor: () => ({ kind: 'spec', where: 'never asked' }),
        ctx,
      });

      expect(plan.writesFile).toBe(false);
      expect(plan.file).toBeNull();
      expect(plan.text).toBeNull();
      expect(plan.owed).toEqual([]);
    });
  });

  describe('A skipped account is caught by the branch', () => {
    const dirs = [];

    afterEach(() => {
      while (dirs.length > 0) rmSync(dirs.pop(), { recursive: true, force: true });
    });

    /** A fixture repo whose `risk.storedShape` reproduces the upstream literal `riskyChanges`
     * used to hard-code, so `STORED_SHAPE`'s path still fires the `stored-shape` rule (Task 8's
     * own `decision-coverage.mjs` reads this from `ctx.config.risk` rather than a module constant). */
    function fixtureCtx() {
      const root = mkdtempSync(join(tmpdir(), 'do-work-accounts-'));
      dirs.push(root);
      const tctx = flatCtx(root, {
        risk: {
          storedShape: ['^libs/[^/]+/src/server/migrations\\.ts$'],
          sharedContract: ['libs/system-api-contract/'],
        },
      });
      return tctx;
    }

    it('the branch-level run turns the gate red on the change the slice left unwritten', () => {
      const tctx = fixtureCtx();
      const changes = [{ path: STORED_SHAPE.path, status: 'M' }];

      const result = gateResult(1044, { ctx: tctx, changes });

      expect(result.ok).toBe(false);
      expect(result.items).toEqual([]);
      expect(result.unaccounted).toEqual([STORED_SHAPE]);
    });

    it('and the slice’s own run is not what reported it — that run never fails a slice', () => {
      const plan = planAccount({
        prd: 1044,
        slice: 's6',
        graded: '2026-09-23',
        risky: [STORED_SHAPE],
        accountFor: () => null,
        ctx,
      });

      expect(plan.sliceStatus).toBe('done');
      expect(plan.opensSubPr).toBe(true);
      expect(SLICE_TIME_GUARD.stopsTheSlice).toBe(false);
      expect(SLICE_TIME_GUARD.exitCodeIsAdvisory).toBe(true);
      expect(SLICE_TIME_GUARD.caughtBy).toContain('outbox');
    });
  });

  describe('A slice is never stopped', () => {
    it('a change it cannot account for still opens the sub-pull-request, and no sibling falls', () => {
      const plan = planAccount({
        prd: 1044,
        slice: 's6',
        graded: '2026-09-23',
        risky: [STORED_SHAPE, SHARED_CONTRACT],
        accountFor: (change) =>
          change.rule === 'shared-contract' ? { kind: 'spec', where: 'Scope > In' } : null,
        ctx,
      });

      expect(plan.opensSubPr).toBe(true);
      expect(plan.stopsTheWave).toBe(false);
      expect(plan.sliceStatus).toBe('done');
      expect(plan.unaccounted).toEqual([{ path: STORED_SHAPE.path, rule: 'stored-shape' }]);
      expect(plan.writesFile).toBe(true);
      expect(plan.text).not.toContain(STORED_SHAPE.path);
    });

    it('and it never invents a third kind of account to quiet the guard', () => {
      expect(Object.keys(ACCOUNT_FORMS)).toEqual(['item', 'spec']);
      expect(() =>
        renderAccount({
          prd: 1044,
          slice: 's6',
          graded: '2026-09-23',
          entries: [{ ...STORED_SHAPE, account: { kind: 'fine', why: 'it is fine' } }],
        }),
      ).toThrow(/item.*spec|spec.*item/);
    });

    it('a rendered account with no entry is refused — the empty file the spec calls ceremony', () => {
      expect(() =>
        renderAccount({ prd: 1044, slice: 's6', graded: '2026-09-23', entries: [] }),
      ).toThrow(/no risky change/i);
    });
  });
});
