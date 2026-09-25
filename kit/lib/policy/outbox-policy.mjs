/**
 * **Two commands ask at two different moments** (PRD #985, slice s7).
 *
 * Two policies, both as data rather than as branching prose, so that what a command does with a
 * decision can be asserted in a test with no model in the loop:
 *
 * - the **recording policy** — what a slice does when it meets a decision the PRD does not settle.
 *   It records and carries on. Exactly two stops remain: a law it can name would break, and a
 *   human action it cannot perform.
 * - the **consultation policy** — which ranks a command asks a human about, in the prompt, while
 *   the run is happening. `COMMANDS.deliver` asks about `high` and `human-action`; `COMMANDS.yolo`
 *   asks about nothing. The recording path underneath is identical in both, and an unanswered
 *   question is never a stop.
 * - the **accounting policy** (PRD #1044, slice s6, at the bottom of this file) — what a slice
 *   owes for the risky ground its own diff touched, before it opens its sub-pull-request. Same
 *   shape again: `SLICE_TIME_GUARD`, `ACCOUNT_FORMS`, `planAccount`, `renderAccount`.
 *
 * Nothing here is reimplemented from the rest of the kit: the rank floor, the item grammar and the
 * answer shape are owned by `outbox.mjs` and `settle.mjs`; what a `bears-on` id names as a law is
 * owned by `laws.mjs`, injected here as `laws` rather than assumed.
 *
 * **The seam that would fail silently.** `floorRank` floors only on an id `laws.floorsHigh`
 * recognizes — exactly as the plan's Durable decisions say, because an ADR is not a law. So
 * `floorRank('ADR-0069', 'medium', laws)` is `medium`, and a policy that proposed `medium` for an
 * ADR contradiction and leaned on the floor to raise it would ship a `medium` item and nothing
 * would ever say so. The scenario *An ADR is not a law* requires `high`, so {@link proposeRank}
 * proposes it here.
 */
// Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-do-work/outbox-policy.mjs — changes in kit/porting/policy--outbox-policy.md.
import { COMMANDS } from '../commands.mjs';
import { idParts } from '../knowledge/registers.mjs';
import { ACCOUNTS_DIR } from '../outbox/account.mjs';
import { floorRank, OPTION_LETTERS, RANK_VALUES } from '../outbox/outbox.mjs';

/** The three places a slice built under the recording policy can end. */
export const SLICE_STATUSES = /** @type {const} */ (['done', 'stopped', 'blocked']);

/**
 * What the recording policy decided to do. One outcome per slice status, same order:
 * `record` → the slice is `done`, `stop` → `stopped`, `blocked` → `blocked`.
 */
export const RECORDING_OUTCOMES = /** @type {const} */ (['record', 'stop', 'blocked']);

const STATUS_FOR_OUTCOME = { record: 'done', stop: 'stopped', blocked: 'blocked' };

/** The mark every stated gap carries, so a reader can tell a gap from a rationale. */
export const AUTHOR_MARK = '(author)';

const ADR_ID = /^ADR-\d{4}$/;

/**
 * The rank the agent proposes for a decision, before {@link floorRank} has its say.
 *
 * - a decision contradicting an **ADR** is `high` — contradicting one is proposing to supersede
 *   it, which is ordinary work the slice carries on with, but it is hard to revert once merged and
 *   the register floor does not reach it (see the module doc);
 * - a decision the agent judges **hard to revert** is `high` — judgement may escalate;
 * - anything else is `medium`.
 *
 * The result is then passed through `floorRank`, which raises it to `high` when the decision bears
 * on a law `laws` recognizes. The floor is never restated here.
 *
 * @param {{ bearsOn?: string, hardToRevert?: boolean, laws: { floorsHigh(bearsOn: string): boolean } }} input
 * @returns {'human-action' | 'high' | 'medium'}
 */
export function proposeRank({ bearsOn = 'none', hardToRevert = false, laws } = {}) {
  const proposed = ADR_ID.test(bearsOn) || hardToRevert ? 'high' : 'medium';
  return floorRank(bearsOn, proposed, laws);
}

/**
 * What a slice does with a decision it cannot settle from the PRD, the registers and the glossary.
 *
 * It records and carries on. The three stops:
 *
 * 1. `breaksNamedLaw` **and** `laws.floorsHigh(bearsOn)` (an id `laws` treats as floor-setting) →
 *    the slice stops and reports the rule. A claimed breach of something it cannot name is **not**
 *    a stop: it is recorded at `high`, because "it might break something" is a risk, not a rule.
 * 2. `needsHumanAction` → a `human-action` item is written and the slice returns `blocked`. This
 *    is read first: a slice that needs a secret cannot prove anything about the law either way.
 * 3. `principlesConflict` names two or more principles (`P-…` ids) that pull the decision apart
 *    (PRD #1081, Decision 10) → the slice stops, and an item ranked `high` is written naming every
 *    one of them. Choosing between two product decisions is a person's call, never an agent's
 *    reversible default. A `P-…` id only means something where `laws.source === 'knowledge'` — a
 *    repository with no knowledge register has no principles to conflict, so elsewhere
 *    `principlesConflict` is read as no conflict at all rather than validated. One principle is no
 *    conflict, and a rule or an invariant id is not a principle: both throw rather than guess.
 *
 * No stop takes the wave down — `stopsTheWave` is always `false`, which is the whole point of
 * the outbox.
 *
 * **A `medium` outcome is adopted, not written as an open file** (PRD #1166, slice s5, Durable
 * decision "The `adopted` verdict"). The returned `settleAsAdopted` is `true` exactly when
 * `outcome === 'record'` and the settled `rank` is `medium` — `human-action` and `high` always
 * write the open item file the ordinary way (`writesItem: true`, `settleAsAdopted: false`).
 * `renderOutboxItem` renders the same item text regardless; `settleAsAdopted` only says where it
 * ends up: appended straight to the item's own outbox directory's `settled.md` through
 * `settle.mjs`'s `adoptItem`, never written as an open item file at all.
 *
 * @param {{ bearsOn?: string, breaksNamedLaw?: boolean, needsHumanAction?: boolean,
 *   hardToRevert?: boolean, principlesConflict?: string[],
 *   laws: { source: string, floorsHigh(bearsOn: string): boolean } }} input
 */
export function decideRecording({
  bearsOn = 'none',
  breaksNamedLaw = false,
  needsHumanAction = false,
  hardToRevert = false,
  principlesConflict = [],
  laws,
} = {}) {
  const principles = conflictingPrinciples(principlesConflict, laws);

  if (needsHumanAction) {
    return recordingDecision({
      outcome: 'blocked',
      rank: 'human-action',
      writesItem: true,
      rule: null,
      reason:
        'only a person can do this — the item is written as `human-action` and the slice returns blocked',
    });
  }

  if (breaksNamedLaw && laws.floorsHigh(bearsOn)) {
    return recordingDecision({
      outcome: 'stop',
      rank: null,
      writesItem: false,
      rule: bearsOn,
      reason: `the slice cannot proceed without breaking ${bearsOn}, a law it can name; it stops and says which`,
    });
  }

  if (principles.length > 0) {
    return recordingDecision({
      outcome: 'stop',
      rank: 'high',
      writesItem: true,
      rule: null,
      principles,
      reason: `the decision is pulled apart by ${principles.join(', ')} — choosing between principles is a person's call, so the slice stops and writes a high item naming every one`,
    });
  }

  const rank = proposeRank({ bearsOn, hardToRevert: hardToRevert || breaksNamedLaw, laws });
  return recordingDecision({
    outcome: 'record',
    rank,
    writesItem: true,
    settleAsAdopted: rank === 'medium',
    rule: null,
    reason: breaksNamedLaw
      ? 'no invariant and no business rule it can name speaks to this, so it is a risk rather than a breach — recorded high, and the slice carries on'
      : rank === 'medium'
        ? 'nothing in the registers speaks to this and it could go the other way for a constant — adopted straight to the ledger, never written as an open item, and the slice carries on'
        : 'nothing in the registers speaks to this — the most reversible option is taken, the item is written, and the slice carries on',
  });
}

/**
 * The principle ids a conflict names, checked: none, or two or more `P-…` ids — never one. A
 * `P-…` id only resolves against a knowledge register, so where `laws.source` is not `'knowledge'`
 * a `principlesConflict` list names nothing this repository can check and is read as no conflict at
 * all, rather than validated or thrown on.
 */
function conflictingPrinciples(ids, laws) {
  const named = [...new Set((ids ?? []).map((id) => String(id).trim()).filter(Boolean))];
  if (named.length === 0 || laws.source !== 'knowledge') return [];
  const notPrinciples = named.filter((id) => idParts(id)?.type !== 'P');
  if (notPrinciples.length > 0) {
    throw new Error(
      `only principles can be in conflict — ${notPrinciples.join(', ')} is not a principle id (P-<CODE>-<n>); a rule or an invariant it would break is breaksNamedLaw`,
    );
  }
  if (named.length < 2) {
    throw new Error(
      `a conflict needs two principles pulling against each other — only ${named[0]} was named`,
    );
  }
  return named;
}

function recordingDecision({
  outcome,
  rank,
  writesItem,
  settleAsAdopted = false,
  rule,
  principles = [],
  reason,
}) {
  return {
    outcome,
    sliceStatus: STATUS_FOR_OUTCOME[outcome],
    rank,
    writesItem,
    settleAsAdopted,
    rule,
    principles,
    stopsTheWave: false,
    reason,
  };
}

/**
 * The consultation policy, as data. A command declares the ranks it asks a human about **in the
 * prompt, while the run is happening**; every rank it does not name is recorded without a
 * question. `COMMANDS.yolo`'s empty list is a declaration, not an omission.
 */
export const CONSULTATION_POLICIES = Object.freeze({
  [COMMANDS.deliver]: Object.freeze({
    command: COMMANDS.deliver,
    asksAbout: Object.freeze(['high', 'human-action']),
    why: 'the human is at the keyboard; a risky call answered now is a settled item rather than a gate to clear later',
  }),
  [COMMANDS.yolo]: Object.freeze({
    command: COMMANDS.yolo,
    asksAbout: Object.freeze([]),
    why: 'go ahead, I will review later — every decision waits in the outbox when the run ends',
  }),
});

/** The policy a command declares, or a throw naming the command — never a guessed default. */
export function consultationPolicy(command) {
  const policy = CONSULTATION_POLICIES[command];
  if (!policy) {
    throw new Error(
      `no consultation policy is declared for "${command}" — the commands that have one are ${Object.keys(CONSULTATION_POLICIES).join(', ')}`,
    );
  }
  return policy;
}

/** Whether `command` asks a human about an item of this `rank` while the run is happening. */
export function asksAbout(command, rank) {
  return consultationPolicy(command).asksAbout.includes(rank);
}

/**
 * Run one item of `rank` through `command`'s consultation policy.
 *
 * Three shapes, and none of them is a stop:
 *
 * - the rank is not asked about → `asked: false`, the item is recorded and left open;
 * - it is asked about and an answer came back → `settled: true`, with an answer object
 *   `settle.mjs`'s `AnswerSchema` accepts, the session named as the approver;
 * - it is asked about and nothing came back → `fellBackToRecording: true`. Nobody is at the
 *   keyboard, and no command in this PRD hangs on an absent human.
 *
 * The `rank` is returned untouched in every case: consultation decides when a human is asked, and
 * nothing else.
 *
 * @param {{ command: string, rank: string, prd: number, answer?: string | null, session?: string | null, at?: string }} input
 */
export function consult({ command, rank, prd, answer = null, session = null, at = null }) {
  const asked = asksAbout(command, rank);
  const text = typeof answer === 'string' ? answer.trim() : '';

  const base = { command, rank, asked, recorded: true, stopped: false };

  if (!asked || text.length === 0) {
    return { ...base, settled: false, fellBackToRecording: asked, answer: null };
  }

  if (!session) {
    throw new Error(
      'an answer given in the prompt is settled with the session named as the approver — `session` is required, and an approver is never invented',
    );
  }

  return {
    ...base,
    settled: true,
    fellBackToRecording: false,
    answer: {
      text,
      approvedBy: `${session} (answered in the ${command} prompt)`,
      approvedAt: at ?? new Date().toISOString().slice(0, 10),
      channel: { kind: 'prd-issue', number: prd },
    },
  };
}

/**
 * The body of an item's *What I could not know* section: every gap, stated, and attributed to the
 * author. **The agent may never invent a rationale.** With nothing to state, this throws rather
 * than draft a "because" nobody said.
 *
 * @param {string[]} gaps
 */
export function unknowable(gaps) {
  const stated = (gaps ?? []).map((gap) => gap.trim()).filter((gap) => gap.length > 0);
  if (stated.length === 0) {
    throw new Error(
      'an item states what could not be known, and the agent may never invent a rationale in its place — name at least one thing the PRD, the registers and the glossary do not settle',
    );
  }
  return [
    `${AUTHOR_MARK} The PRD, the registers and the glossary do not settle this:`,
    '',
    ...stated.map((gap) => `- ${gap}`),
  ].join('\n');
}

/**
 * One outbox item, rendered in the format `outbox.mjs`'s parser accepts: the seven front-matter
 * fields, the two plain-words sections (PRD #1071), and the four existing sections, all in order.
 * The rank is passed through `floorRank` on the way out, so an item can never be written below its
 * floor whatever the caller believed.
 *
 * **The two plain-words strings are required, and never checked against `plainWordsProblems`
 * here.** Writing them plainly — "explain it to a business person; a technical term only when
 * there is no plain way to say it" — is the agent's job at raise time; grading them is
 * `check-outbox.mjs`'s, on the file this renders, not this renderer's.
 *
 * **Every question also carries its options** (PRD #1166, slice s4). `options` is two to four
 * plain sentences, in the order they should read — the first is always the one built, and this
 * renderer letters them `A.`, `B.`, `C.`… itself, so a caller never has to spell out the letters
 * by hand. A `human-action` item carries no options at all — there is nothing to choose between —
 * and `personSteps` instead: what a person must do, written under `## What a person must do`.
 * Passing the wrong one for the settled rank (options for a `human-action` item, or none at all
 * for anything else) is refused, the same way an empty plain-words string already is; **the count
 * and the wording of each option are still `check-outbox.mjs`'s call, never this renderer's** —
 * only their bare presence is checked here, so a slice cannot silently write an item this guard is
 * guaranteed to refuse.
 *
 * @param {{ id: string, prd: number, slice: string, wave: number, raised: string, bearsOn: string,
 *   rank: string, questionPlain: string, decisionPlain: string, decide: string, meanwhile: string,
 *   cost: string, gaps: string[], options?: string[], personSteps?: string,
 *   laws: { floorsHigh(bearsOn: string): boolean } }} fields
 */
export function renderOutboxItem({
  id,
  prd,
  slice,
  wave,
  raised,
  bearsOn,
  rank,
  questionPlain,
  decisionPlain,
  decide,
  meanwhile,
  cost,
  gaps,
  options = null,
  personSteps = null,
  laws,
}) {
  const couldNotKnow = unknowable(gaps);
  const settledRank = floorRank(bearsOn, rank, laws);
  if (!RANK_VALUES.includes(settledRank)) {
    throw new Error(`rank must be one of: ${RANK_VALUES.join(', ')} — got "${rank}"`);
  }
  if (!(questionPlain ?? '').trim()) {
    throw new Error(
      'an item states its question in plain words too — "## The question, in plain words" — before it says what was decided',
    );
  }
  if (!(decisionPlain ?? '').trim()) {
    throw new Error(
      'an item states its decision in plain words too — "## The decision, in plain words" — before the four sections a developer reads',
    );
  }
  const optionsBlock =
    settledRank === 'human-action' ? renderPersonSteps(personSteps) : renderOptions(options);

  return [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${slice}`,
    `rank: ${settledRank}`,
    `bears-on: ${bearsOn}`,
    `raised: ${raised}`,
    `wave: ${wave}`,
    '---',
    '',
    '## The question, in plain words',
    '',
    questionPlain,
    '',
    '## The decision, in plain words',
    '',
    decisionPlain,
    '',
    ...optionsBlock,
    '',
    '## What I had to decide',
    '',
    decide,
    '',
    '## What I did meanwhile',
    '',
    meanwhile,
    '',
    '## What it costs to change later',
    '',
    cost,
    '',
    '## What I could not know',
    '',
    couldNotKnow,
    '',
  ].join('\n');
}

/**
 * `## The options, in plain words`, lettered `A.` … from `options` — two to four plain sentences,
 * A the one built. Refuses rather than writes an item `check-outbox.mjs` is guaranteed to refuse
 * for carrying too few or too many.
 */
function renderOptions(options) {
  const list = (Array.isArray(options) ? options : [])
    .map((text) => (text ?? '').trim())
    .filter((text) => text.length > 0);
  if (list.length < 2 || list.length > 4) {
    throw new Error(
      `an item states two to four options too — "## The options, in plain words", "A" the one built — got ${list.length}`,
    );
  }
  return [
    '## The options, in plain words',
    '',
    ...list.map((text, index) => `${OPTION_LETTERS[index]}. ${text}`),
  ];
}

/** `## What a person must do`, for a `human-action` item — there is nothing to choose between. */
function renderPersonSteps(personSteps) {
  const text = (personSteps ?? '').trim();
  if (!text) {
    throw new Error(
      'a human-action item states what a person must do too — "## What a person must do" — since it carries no options',
    );
  }
  return ['## What a person must do', '', text];
}

/**
 * **The agent accounts before its sub-pull-request** (PRD #1044, slice s6).
 *
 * The third policy in this file, and the same discipline as the two above: data a test asserts,
 * not prose a reader obeys. A slice's diff is graded against the five rules
 * (`decision-coverage.mjs`) before it opens its sub-PR; every risky change it made owes a written
 * account under its PRD's own outbox directory's `accounts/` folder, in one of exactly two forms.
 *
 * **The run's exit code is advisory, and that is the whole point.** The coverage check run in CI
 * exits non-zero on an unaccounted change, because CI needs it to. At slice time the agent reads
 * the list and never stops on it: nothing here reintroduces a stop the outbox exists to remove. The
 * independent catch is the branch-level run through `outbox/status.mjs`'s `gateResult`, wired into
 * CI by a later task — the only run a slice that skipped its own cannot fake.
 */
export const SLICE_TIME_GUARD = Object.freeze({
  script: '.omni-loop/bin/omni.mjs check coverage',
  runsBefore: 'the sub-pull-request is opened',
  range: 'the slice branch against the feature branch it was cut from',
  /**
   * A bare run grades account *format* across every PRD directory and compares no range at all —
   * the slice knows both its base and its PRD, so it names them.
   */
  needsExplicitArguments: true,
  stopsTheSlice: false,
  exitCodeIsAdvisory: true,
  caughtBy: 'the branch-level run — the outbox gate (`outbox/status.mjs`\'s `gateResult`)',
  why: 'only the slice knows why it made the change; only the branch-level run is independent of the slice',
});

/**
 * The exact command a slice runs on its own diff. Both arguments are required — a base this
 * function guessed, or a PRD it defaulted, would grade the wrong range in silence.
 *
 * @param {{ base?: string, prd?: string | number }} [input]
 */
export function sliceTimeGuardCommand({ base = null, prd = null } = {}) {
  if (!base) {
    throw new Error(
      'the slice-time run needs its base spelled out — the feature branch the sub-pull-request targets, e.g. origin/feat/<topic>',
    );
  }
  if (!prd) {
    throw new Error(
      'the slice-time run needs its prd spelled out — with no PRD it can only grade account format, never a range',
    );
  }
  return `node ${SLICE_TIME_GUARD.script} ${base} ${prd}`;
}

/**
 * The two account forms, and no third. A free-text "it's fine" is not an account: both forms point
 * at something a reader can open and disagree with (the outbox directory's own README holds the
 * format itself — it is not restated here).
 */
export const ACCOUNT_FORMS = Object.freeze({
  item: Object.freeze({
    kind: 'item',
    field: 'id',
    line: (value) => `item ${value}`,
    why: 'an outbox item carries the decision; the id must resolve to a real file under the PRD\'s own outbox directory',
  }),
  spec: Object.freeze({
    kind: 'spec',
    field: 'where',
    line: (value) => `spec ${value}`,
    why: 'the spec already asked for this change, and the account points at the place that says so',
  }),
});

/**
 * The PRD's own outbox directory's `accounts/<slice>.md` — composed from `ctx.layout.outboxDir`
 * and `ACCOUNTS_DIR` (`account.mjs`). Throws when the PRD names no inbox or shipped folder at all,
 * the same guard `settle.mjs`'s own outbox-directory lookups use.
 *
 * @param {number | string} prd
 * @param {string} slice
 * @param {{ ctx: object }} options
 */
export function accountFile(prd, slice, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) throw new Error(`PRD ${prd} has no inbox or shipped folder`);
  return `${outboxDir}/${ACCOUNTS_DIR}/${slice}.md`;
}

function accountLine(account) {
  const form = ACCOUNT_FORMS[account?.kind];
  if (!form) {
    throw new Error(
      `an account is "item <id>" or "spec <where>", and no third form — got "${account?.kind}"`,
    );
  }
  const value = String(account[form.field] ?? '').trim();
  if (value.length === 0) {
    throw new Error(`an "${form.kind}" account needs its ${form.field} — ${form.why}`);
  }
  return form.line(value);
}

/**
 * One account file, rendered in the format `account.mjs`'s parser accepts: the three front-matter
 * fields and the one `## Risky changes` section, one three-line entry per accounted change.
 *
 * With no entry at all this throws rather than write the empty file the spec calls ceremony —
 * "a ceremony file is exactly what gets written without being read". Whether a file is owed is
 * {@link planAccount}'s decision, not this renderer's.
 *
 * @param {{ prd: number | string, slice: string, graded: string,
 *   entries: { path: string, rule: string, account: object }[] }} fields
 */
export function renderAccount({ prd, slice, graded, entries }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(
      'an account file with no risky change is not written at all — a slice that touched nothing risky owes nothing',
    );
  }

  const entryLines = entries.flatMap((entry) => [
    `- \`${entry.path}\``,
    entry.rule,
    accountLine(entry.account),
  ]);

  return [
    '---',
    `prd: ${prd}`,
    `slice: ${slice}`,
    `graded: ${graded}`,
    '---',
    '',
    '## Risky changes',
    '',
    ...entryLines,
    '',
  ].join('\n');
}

/** A risky change is identified by its path AND its rule — one path may fire more than one rule. */
function changeKey({ path, rule }) {
  return `${path}\u0000${rule}`;
}

/**
 * What a slice does with the risky changes its own diff made, once the guard has named them.
 *
 * `accountFor(change)` is the only judgement in the loop — it returns the account the slice can
 * honestly give (`{ kind: 'item', id }` or `{ kind: 'spec', where }`), or `null` where it has
 * none. A `null` leaves that change **unaccounted** and nothing else: the slice does not invent an
 * account to quiet the guard, exactly as it never invents a rationale in an item, and it does not
 * stop. `opensSubPr` is `true` and `stopsTheWave` `false` in every case, like
 * {@link decideRecording}'s own outcomes.
 *
 * With no risky change, `writesFile` is `false` and there is no file, no path and no text — the
 * spec's "a slice that made no risky change writes no file at all".
 *
 * @param {{ prd: number | string, slice: string, graded: string,
 *   risky: { path: string, status: string, rule: string }[],
 *   accountFor: (change: object) => object | null, ctx: object }} input
 */
export function planAccount({ prd, slice, graded, risky = [], accountFor, ctx }) {
  const seen = new Set();
  const owed = [];
  for (const change of risky) {
    const key = changeKey(change);
    if (seen.has(key)) continue;
    seen.add(key);
    owed.push({ path: change.path, rule: change.rule });
  }

  const entries = [];
  const unaccounted = [];
  for (const change of owed) {
    const account = accountFor(change) ?? null;
    if (account) entries.push({ ...change, account });
    else unaccounted.push(change);
  }

  const writesFile = entries.length > 0;

  return {
    owed,
    entries,
    unaccounted,
    writesFile,
    file: writesFile ? accountFile(prd, slice, { ctx }) : null,
    text: writesFile ? renderAccount({ prd, slice, graded, entries }) : null,
    opensSubPr: true,
    stopsTheWave: false,
    sliceStatus: 'done',
  };
}
