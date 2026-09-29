/**
 * **`/omni:yolo-fix` brings a drifted feature back in line** (PRD #985, slice s9).
 *
 * A settled item whose answer contradicts the choice the agent recorded is **drifted**: the build
 * and the decision disagree, and nothing closes that but a rework. This module is the whole
 * derivation, and it is deliberately **pure** — a ledger and a plan in, a list of rework slices
 * out. It runs no command, opens no pull request and merges nothing; the skill's prose does that,
 * through the wave machinery that already exists.
 *
 * Three rules it exists to keep:
 *
 * 1. **It acts on answers already given.** `raisesItems` is `false`, as a field rather than a
 *    comment, because the one thing this command must never do is add a question of its own to a
 *    PRD whose questions have just been answered.
 * 2. **A rework is bounded by what the item said it would cost.** *What it costs to change later*
 *    is the **stated bound**: it is carried into the brief verbatim, and every repo path it names
 *    joins the rework's territory. Nothing widens a rework but a sentence a human can read on the
 *    item itself — the PRD's own mitigation for "a rework goes wider than the answer".
 * 3. **Nothing is merged into `main`.** `mergesIntoMain` is a field for the same reason.
 *
 * **The append-only tension, decided.** The settled ledger is append-only, and a `drifted` entry
 * carries `Closed: no`. Recording the rework that closed it has to touch that line. Two ways were
 * open: append a second, closure-shaped entry for the same item, or amend the one line. This
 * module **amends the one `Closed:` line and nothing else** — {@link closeDriftedEntry} proves it
 * by refusing to touch any other byte, and the skill states it in prose. The reason is that
 * `closed` is a **state a command reads**, not a message: `parseSettledEntries` derives it from
 * that single field, so a second entry would leave the first one still saying `no` and every
 * reader would need to know to look further along the ledger for a retraction. Appending is the
 * rule because the *question and the answer* must never be rewritten to match each other — and
 * they are not: both verbatim blocks, front matter and all four sections, come back
 * byte-identical, which is what slice s5's round-trip test proves and this module's tests prove
 * again after a closure.
 */
// Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-yolo-fix/rework.mjs — changes in kit/porting/policy--rework.md.
import { ConfigSchema } from '../config.mjs';
import { parsePlanSlices, sharedGround } from '../inbox/territory.mjs';
import { parseOutboxItem } from '../outbox/outbox.mjs';
import { parseSettledEntries } from '../outbox/settle.mjs';
import { COMMANDS } from '../commands.mjs';

/** `#1001` or a pull-request URL, as the amended `Closed:` line carries it. */
const REWORKED_BY = /reworked by (#\d+|https?:\/\/[^\s,]+)/;

/**
 * The drifted items of a PRD's ledger: settled `drifted`, and not yet closed by a rework.
 *
 * Read through `parseSettledEntries` — the ledger's own reader, never a second parse of the same
 * markdown.
 *
 * @param {string} settledText
 * @param {object} markers
 */
export function driftedEntries(settledText, markers) {
  return parseSettledEntries(settledText ?? '', markers).filter(
    (entry) => entry.verdict === 'drifted' && !entry.closed,
  );
}

/**
 * The repo paths a piece of prose names in backticks. A path is a backticked token that carries a
 * `/` or an extension and is not a URL — anything vaguer is prose, and prose declares no ground.
 */
export function namedPaths(text) {
  const tokens = [...(text ?? '').matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
  return tokens.filter(
    (token) =>
      !/^[a-z]+:\/\//.test(token) &&
      !/\s/.test(token) &&
      (token.includes('/') || /\.[A-Za-z0-9]+$/.test(token)),
  );
}

/** `B. <option text> — because <reason>` — how a reply that chose an option is recorded
 * (PRD #1166 s6). */
const CHOSEN_OPTION_ANSWER = /^([A-D])\. ([\s\S]*?)(?: — because ([\s\S]*))?$/;

/**
 * The option a drifted answer chose, and the reason given — what the rework builds towards
 * (PRD #1166 s6). Read against the item's own options, so a prose answer that merely starts with a
 * capital letter and a full stop never passes for a choice. `{ chosenOption: null, reason: null }`
 * when the answer names no offered option: the rework then reads the answer itself, as before.
 *
 * @param {string} answerText
 * @param {{ letter: string, text: string }[] | undefined} options
 */
export function chosenOptionOf(answerText, options) {
  const match = (answerText ?? '').trim().match(CHOSEN_OPTION_ANSWER);
  const option = match && (options ?? []).find((candidate) => candidate.letter === match[1]);
  if (!option || option.text !== match[2].trim()) return { chosenOption: null, reason: null };
  return {
    chosenOption: { letter: option.letter, text: option.text },
    reason: match[3]?.trim() || null,
  };
}

/** The branch templates when none are passed: config's own defaults, never restated here. */
const DEFAULT_BRANCHES = Object.freeze(ConfigSchema.shape.branches.parse(undefined));

function fill(template, values) {
  return template.replace(/\{(topic|slice|item)\}/g, (whole, key) => values[key] ?? whole);
}

/** The `{topic}` a feature branch was cut for, read back through the `branches.feature` template. */
function topicOf(featureBranch, featureTemplate) {
  const [head, tail = ''] = featureTemplate.split('{topic}');
  if (!featureTemplate.includes('{topic}') || !featureBranch.startsWith(head) || !featureBranch.endsWith(tail)) return null;
  const topic = featureBranch.slice(head.length, featureBranch.length - tail.length);
  return topic || null;
}

/** `branches.rework` with `{item}` filled — `fix-<item id>` by default: one rework per drifted item,
 * and the id names the item it closes. */
export function reworkSliceId(itemId, branches = DEFAULT_BRANCHES) {
  return fill(branches.rework, { item: itemId });
}

/** The rework's own branch: `branches.slice` with the feature branch's `{topic}` and the rework id
 * as `{slice}` — `<feature branch>--fix-<item id>` by default. */
export function reworkBranch(featureBranch, sliceId, branches = DEFAULT_BRANCHES) {
  const topic = topicOf(featureBranch, branches.feature);
  if (topic === null) {
    throw new Error(`feature branch "${featureBranch}" does not match branches.feature "${branches.feature}"`);
  }
  return fill(branches.slice, { topic, slice: sliceId });
}

/**
 * One rework slice, derived from one drifted entry: the answer that contradicted the build, the
 * choice it contradicted, the stated bound, and the ground the rework may stand on.
 *
 * The territory is the ground the **originating slice** declared in the plan, plus every path the
 * stated bound names. Nothing else: a rework that needed more ground than the item said it would
 * cost is a rework the item never authorised. When the plan holds no such slice, `unknownPlanSlice`
 * says so and the declaration is whatever the bound named — never a guess.
 *
 * @param {{ id: string, itemText: string, answerText: string, fields: Record<string, string> }} entry
 * @param {{ planSlices?: Array<{ id: string, repo?: string | null, territory: string[] }>, featureBranch?: string, branches?: { feature: string, slice: string, rework: string }, planRepository?: boolean }} [context]
 *   `branches` is `ctx.config.branches` (config's defaults when omitted). `planRepository` (PRD
 *   563): in a plan repository the rework carries `repo`, the repository of the slice its item was
 *   raised on (`null` when the plan holds no such slice or names none), so it lands where the
 *   decision was taken; elsewhere the field is absent, and the rework reads exactly as before.
 */
export function deriveRework(entry, { planSlices = [], featureBranch = null, branches = DEFAULT_BRANCHES, planRepository = false } = {}) {
  const parsed = parseOutboxItem(entry.itemText, { file: `settled entry ${entry.id}` });
  if (!parsed.ok) {
    throw new Error(
      `the settled entry for ${entry.id} does not hold a well-formed item, so no rework can be derived from it:\n  - ${parsed.errors.join('\n  - ')}`,
    );
  }
  const { item } = parsed;

  const planSlice = planSlices.find((slice) => slice.id === item.slice) ?? null;
  const bound = item.sections.whatItCostsToChangeLater;
  const { chosenOption, reason } = chosenOptionOf(entry.answerText, item.sections.options);
  const territory = [...new Set([...(planSlice?.territory ?? []), ...namedPaths(bound)])];

  const id = reworkSliceId(entry.id, branches);
  return {
    id,
    itemId: entry.id,
    slice: item.slice,
    rank: item.rank,
    bearsOn: item.bearsOn,
    question: item.sections.whatIHadToDecide,
    choice: item.sections.whatIDidMeanwhile,
    answer: entry.answerText,
    chosenOption,
    reason,
    bound,
    approvedBy: entry.fields['Approved by'] ?? null,
    channel: entry.fields.Channel ?? null,
    territory,
    territoryKnown: territory.length > 0,
    unknownPlanSlice: planSlice === null,
    wave: 1,
    ...(planRepository ? { repo: planSlice?.repo || null } : {}),
    ...(featureBranch
      ? { base: featureBranch, branch: reworkBranch(featureBranch, id, branches) }
      : {}),
  };
}

/**
 * Waves, from the collision matrix rather than from a guess: two reworks whose territories
 * intersect may never share a wave, exactly as two slices of a plan may not. The first wave that
 * shares no ground with a rework takes it.
 */
export function assignWaves(reworks) {
  const waves = [];
  return reworks.map((rework) => {
    let index = waves.findIndex(
      (wave) => !wave.some((sibling) => sharedGround(sibling, rework).length > 0),
    );
    if (index === -1) index = waves.push([]) - 1;
    waves[index].push(rework);
    return { ...rework, wave: index + 1 };
  });
}

/**
 * The whole derivation: a PRD's settled ledger and its plan in, the reworks to run out.
 *
 * With nothing drifted it returns no rework and a report that says so — the command opens no pull
 * request at all.
 *
 * @param {{ settledText?: string, planMarkdown?: string, prd: number, featureBranch: string, markers: object, branches?: object, planRepository?: boolean }} input
 *   `branches` is `ctx.config.branches`; omitted, config's defaults apply. `planRepository` is
 *   whether this runs in a plan repository (PRD 563): see {@link deriveRework}.
 */
export function planRework({ settledText = '', planMarkdown = null, prd, featureBranch, markers, branches = DEFAULT_BRANCHES, planRepository = false }) {
  const settledCount = parseSettledEntries(settledText, markers).length;
  const drifted = driftedEntries(settledText, markers);
  const planSlices = planMarkdown ? parsePlanSlices(planMarkdown) : [];

  const reworks = assignWaves(
    drifted.map((entry) => deriveRework(entry, { planSlices, featureBranch, branches, planRepository })),
  );

  return {
    prd,
    featureBranch,
    settledCount,
    reworks,
    opensPullRequest: reworks.length > 0,
    mergesIntoMain: false,
    raisesItems: false,
    report: reportLines({ prd, featureBranch, settledCount, reworks }),
  };
}

function reportLines({ prd, featureBranch, settledCount, reworks }) {
  const settled = `${settledCount} settled item${settledCount === 1 ? '' : 's'}`;
  if (reworks.length === 0) {
    return [
      `Nothing drifted — every one of the ${settled} of PRD #${prd} agreed with what was built.`,
      'No rework slice was derived and no pull request was opened.',
    ];
  }

  const lines = [
    `${reworks.length} drifted item${reworks.length === 1 ? '' : 's'} of ${settled} on PRD #${prd}.`,
    `One rework slice each, as sub-PRs into \`${featureBranch}\`:`,
    '',
  ];
  for (const rework of reworks) {
    lines.push(
      `- \`${rework.id}\` (wave ${rework.wave}) — reworks \`${rework.itemId}\`, raised by slice ${rework.slice}.`,
      `  Territory: ${rework.territory.map((path) => `\`${path}\``).join(', ') || '(the plan declares none, and none was invented)'}`,
    );
  }
  return lines;
}

/**
 * The rework slices as a plan table — an `id`/`territory`/`wave` table `parsePlanSlices` reads, so
 * a rework's own sub-PR is graded with the machinery every other slice is graded by. A rework
 * declares its ground like any other slice, and that is what makes it true rather than a claim in
 * prose.
 */
export function renderReworkPlan({ prd, featureBranch, reworks }) {
  return [
    `# Rework plan — PRD ${prd}`,
    '',
    `Derived by \`${COMMANDS.yoloFix}\` from the drifted items of PRD ${prd}. One slice per drifted`,
    `item, each a sub-PR into \`${featureBranch}\`. Nothing here is merged into \`main\`.`,
    '',
    '| id | slice | territory | wave |',
    '| --- | --- | --- | --- |',
    ...reworks.map((rework) =>
      [
        '',
        rework.id,
        `reworks ${rework.itemId}`,
        rework.territory.map((path) => `\`${path}\``).join(', ') || '—',
        String(rework.wave),
        '',
      ].join(' | '),
    ),
    '',
  ].join('\n');
}

/**
 * Records that a rework sub-PR brought a drifted item back in line, by amending **one line** of the
 * ledger: the entry's `Closed:` field. Every other byte — the facts, the answer block, the item
 * block with its front matter and four sections — is returned untouched, and the verdict stays
 * `drifted`, because drift is what happened and a ledger does not tidy its own history.
 *
 * Refuses, rather than guesses, when the id is not in the ledger, when its entry agreed, when it is
 * already closed, or when no pull request is named — a closure nobody can follow is not a closure.
 *
 * @param {string} settledText
 * @param {{ id: string, pullRequest: string, markers: object }} closure
 */
export function closeDriftedEntry(settledText, { id, pullRequest, markers }) {
  const reference = (pullRequest ?? '').trim();
  if (!reference) {
    throw new Error(
      `${id}: name the rework sub-pull request that closed it — a closure nobody can follow is not a closure.`,
    );
  }

  const entry = parseSettledEntries(settledText, markers).find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`${id}: this ledger holds no settled entry with that id.`);
  }
  if (entry.verdict !== 'drifted') {
    throw new Error(
      `${id}: this entry settled as "${entry.verdict}" — only a drifted item is ever reworked, and ${COMMANDS.yoloFix} re-decides nothing.`,
    );
  }
  if (entry.closed) {
    throw new Error(
      `${id}: already closed by ${reworkPullRequest(entry) ?? 'a rework'} — the ledger records one closure, not a second opinion.`,
    );
  }

  const open = markers.settledOpen(id);
  const close = markers.settledClose(id);
  const lines = settledText.split('\n');
  // The LAST entry for the id — the one `parseSettledEntries` read above. An objection to an adopted
  // item follows the adopted entry under the same id (PRD #1166 s6), and the adopted one is history.
  const start = lines.lastIndexOf(open);
  const end = lines.indexOf(close, start);
  const closedIndex = lines.findIndex(
    (line, index) => index > start && index < end && line.startsWith('- Closed: '),
  );
  if (closedIndex === -1) {
    throw new Error(`${id}: this entry carries no "Closed:" line to amend.`);
  }

  lines[closedIndex] =
    `- Closed: yes — reworked by ${reference}, the sub-pull request that brought the build back in line`;
  return lines.join('\n');
}

/** The rework sub-PR a closed entry names, or `null` — the reader half of {@link closeDriftedEntry}. */
export function reworkPullRequest(entry) {
  return (entry?.fields?.Closed ?? '').match(REWORKED_BY)?.[1] ?? null;
}
