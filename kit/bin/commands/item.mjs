// `omni item new --prd <n> --slice <id> --file <file> [--adopt | --out <dir>] [--json]` — records one decision
// as an outbox item, through the recording policy in `kit/lib/policy/outbox-policy.mjs`. The
// `--file` JSON file carries `renderOutboxItem`'s fields minus `prd`, `slice` and `laws` (this
// command supplies all three) and minus `id` (this command picks the next free one) and `rank`
// (`decideRecording` decides it). `decideRecording` is always run — every one of its own inputs is
// optional with a safe default, so a JSON file that names none of them still "carries what it
// needs": a plain question with no `bears-on` and no named risk.
//
// `--out <dir>` (PRD 563, s3) writes the item into `<dir>` instead of the PRD's outbox: the same
// checks, the same id (the folder's own items count as spent) and the same file name, so a slice
// built in another repository can hand its items to `omni item relay` below. It never adopts:
// `--out` with `--adopt` is a usage error.
//
// `introFun` and `punchlineFun` (PRD #50, slice s1) are optional, together or neither. The schema
// itself holds each to `funLineProblems` (the plain-words rules, 120 characters at most), so a line
// that breaks one is refused naming its field — a one-line usage error, exit 2, nothing written or
// adopted — before the recording policy ever runs.
//
// This command follows `decision.writesItem`, exactly as the policy states it:
// - `writesItem: false` (only `breaksNamedLaw` against a law `laws` can name) — nothing is
//   written, and the reason is printed; exit 1.
// - `writesItem: true` and `outcome: 'record'` — the item is rendered at the rank the policy chose
//   and written, unless that rank is `medium` and `--adopt` was passed, in which case it is
//   adopted straight to the ledger through `adoptItem` and no open file is ever created (so a
//   parallel wave's slices never race to append the same PRD's `settled.md`); without `--adopt`, a
//   medium item stays an open file for the orchestrator to adopt once the wave has merged.
// - `writesItem: true` and `outcome: 'stop'` (a principles conflict, rank `high`) or `'blocked'`
//   (`needsHumanAction`, rank `human-action`) — the item is rendered and written exactly as a
//   `record` would be, but the slice cannot carry on: a one-line reason goes to stderr and the
//   exit code is 1, so the caller (`do-work`) gets both the file and the non-zero exit.
//
// `--json` prints exactly one JSON object on stdout instead of the plain-text lines above:
// `{ outcome, rank, id, file, adopted, reason }` — `outcome` is `'record'`, `'stop'` or
// `'blocked'` (the same three values `decideRecording` returns), or `null` for a failure that
// never reached the recording policy at all (below); `id` and `file` are `null` when nothing was
// written; `adopted` is `true` only when `--adopt` adopted a `medium` item, and then `file` is
// `null` since no open file remains; `reason` is `null` on a plain successful record, and a
// one-line (or `; `-joined multi-line) reason otherwise. Exit codes are unchanged. This lets a
// caller (`do-work`) branch on structured output instead of parsing stderr wording.
//
// `outcome: null` covers the two ways nothing is written despite `decideRecording` never objecting:
// - **Before anything is written**, the rendered item is graded with the exact same
//   `checkItemText` `omni check outbox` runs on every open item (a below-floor rank, a malformed
//   options section, a backticked code name or file path in a plain-words section…). A violation
//   here is a usage error: nothing is written — not an open file, not an adoption — every
//   violation is printed on stderr, one per line (or joined into `reason` under `--json`), and the
//   exit code is 2, whether or not `--json` was passed; `outcome: 'record'` is never reached.
// - **After `--adopt`**, the ledger can still refuse the adoption (a malformed `settled.md`, say);
//   nothing is written then either, `adopted` stays `false`, and the exit code is 1.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { lawsFor } from '../../lib/laws.mjs';
import { funLineProblems, outboxItemFiles, SETTLED_FILE } from '../../lib/outbox/outbox.mjs';
import { checkItemText } from '../../lib/outbox/check-outbox.mjs';
import { relayFolder } from '../../lib/outbox/relay.mjs';
import { adoptItem, parseSettledEntries } from '../../lib/outbox/settle.mjs';
import { decideRecording, renderOutboxItem } from '../../lib/policy/outbox-policy.mjs';
import { inRoot, parseArgs, positiveInt, println, readUserFile, usageError } from '../args.mjs';

const NEW_USAGE = 'usage: omni item new --prd <n> --slice <id> --file <file> [--adopt | --out <dir>] [--json]';
const RELAY_USAGE = 'usage: omni item relay <dir> --prd <n>';
const USAGE = `${NEW_USAGE} | ${RELAY_USAGE.slice('usage: '.length)}`;

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** An intro or a punchline: optional, and held to `funLineProblems` here, so a refusal names `field`. */
function funLine(field) {
  return z
    .string()
    .trim()
    .min(1, `${field} must not be empty`)
    .superRefine((value, refinement) => {
      for (const problem of funLineProblems(value)) {
        refinement.addIssue({ code: z.ZodIssueCode.custom, message: `${field} ${problem}` });
      }
    })
    .optional();
}

/** The intro and the punchline come together, or neither does — the parser refuses one alone. */
function funPair(input, refinement) {
  const [given, missing] =
    input.introFun === undefined ? ['punchlineFun', 'introFun'] : ['introFun', 'punchlineFun'];
  if ((input.introFun === undefined) === (input.punchlineFun === undefined)) return;
  refinement.addIssue({
    code: z.ZodIssueCode.custom,
    path: [missing],
    message: `${missing} is required when ${given} is given — the intro and the punchline come together, or neither does`,
  });
}

const ItemInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(SLUG_SHAPE, 'slug must be kebab-case (lowercase letters, digits and single hyphens)'),
    wave: z.coerce.number({ message: 'wave must be a number' }).int().positive(),
    raised: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'raised must be a YYYY-MM-DD date')
      .optional(),
    bearsOn: z.string().trim().min(1, 'bearsOn must not be empty').optional(),
    breaksNamedLaw: z.boolean().optional(),
    needsHumanAction: z.boolean().optional(),
    hardToRevert: z.boolean().optional(),
    principlesConflict: z.array(z.string().trim().min(1)).optional(),
    questionPlain: z.string().trim().min(1, 'questionPlain is required'),
    decisionPlain: z.string().trim().min(1, 'decisionPlain is required'),
    introFun: funLine('introFun'),
    punchlineFun: funLine('punchlineFun'),
    decide: z.string().trim().min(1, 'decide is required'),
    meanwhile: z.string().trim().min(1, 'meanwhile is required'),
    cost: z.string().trim().min(1, 'cost is required'),
    gaps: z.array(z.string().trim().min(1)).min(1, 'gaps needs at least one entry'),
    options: z
      .array(z.string().trim().min(1))
      .min(2, 'options needs two to four entries')
      .max(4, 'options needs two to four entries')
      .optional(),
    personSteps: z.string().trim().min(1, 'personSteps must not be empty').optional(),
  })
  .strict()
  .superRefine(funPair);

/** The label a non-zero, item-written exit carries — `decision.outcome` is always `'stop'` or
 * `'blocked'` here; `'record'` never reaches this. */
const NONZERO_OUTCOME_LABEL = { stop: 'must stop', blocked: 'is blocked' };

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** The parsed, validated JSON, or a one-line `UsageError` naming the field that is missing or
 * malformed. */
function readItemInput(ctx, path) {
  const text = readUserFile('item new', ctx, path);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw usageError(`omni item new: ${path} is not valid JSON (${error.message}).`);
  }
  const result = ItemInputSchema.safeParse(parsed);
  if (!result.success) {
    const [issue] = result.error.issues;
    const field = issue.path.length > 0 ? issue.path.join('.') : '(json)';
    throw usageError(`omni item new: ${path}: "${field}" — ${issue.message}.`);
  }
  return result.data;
}

/** Every id this PRD's slice has already spent: an open item file's basename, or an id `settled.md`
 * already carries — a medium item adopted at raise time leaves no open file behind at all. */
function spentIds(prd, { ctx, outDir = null }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  const prefix = `${outboxDir}/`;
  const ids = new Set(
    outboxItemFiles({ ctx })
      .filter((path) => path.startsWith(prefix))
      .map((path) => basename(path, '.md')),
  );
  // With `--out`, the folder's own items are spent too: two items raised into one scratch folder
  // never share an id, and the relay never finds two files of one name.
  if (outDir !== null && existsSync(outDir)) {
    for (const name of readdirSync(outDir)) {
      if (name.endsWith('.md') && statSync(join(outDir, name)).isFile()) ids.add(basename(name, '.md'));
    }
  }
  const settledFile = join(ctx.root, outboxDir, SETTLED_FILE);
  if (existsSync(settledFile)) {
    for (const entry of parseSettledEntries(readFileSync(settledFile, 'utf8'), ctx.markers)) {
      ids.add(entry.id);
    }
  }
  return ids;
}

/** Every two-digit number this slice has already spent, whatever slug it was raised with — an
 * open file's own number, or one `settled.md` already carries. */
function spentNumbers(prd, slice, { ctx, outDir = null }) {
  const prefix = `${slice}-`;
  const shape = /^-(\d{2})-/;
  const numbers = new Set();
  for (const id of spentIds(prd, { ctx, outDir })) {
    if (!id.startsWith(prefix)) continue;
    const match = id.slice(prefix.length - 1).match(shape);
    if (match) numbers.add(match[1]);
  }
  return numbers;
}

/** The next free `<slice>-<nn>-<slug>` id, `nn` the smallest two-digit number this slice has not
 * already spent under ANY slug (as an open file or in `settled.md`) — a running counter per
 * slice, not per slug. */
function nextItemId(prd, slice, slug, { ctx, outDir = null }) {
  const spent = spentNumbers(prd, slice, { ctx, outDir });
  for (let n = 1; n <= 99; n += 1) {
    const nn = String(n).padStart(2, '0');
    if (!spent.has(nn)) return `${slice}-${nn}-${slug}`;
  }
  throw usageError(`omni item new: ${slice} under PRD ${prd} has already spent every number 01-99.`);
}

/** The one JSON object `--json` prints on stdout, per outcome. */
function jsonOutcome({ outcome, rank = null, id = null, file = null, adopted = false, reason = null }) {
  return JSON.stringify({ outcome, rank, id, file, adopted, reason });
}

async function runNew(args, { ctx, stdout, stderr }) {
  const { positional, flags } = parseArgs('item new', args, {
    values: ['prd', 'slice', 'file', 'out'],
    booleans: ['adopt', 'json'],
  });
  if (positional.length !== 0 || flags.prd === undefined || flags.slice === undefined || flags.file === undefined) {
    throw usageError(NEW_USAGE);
  }
  if (flags.out !== undefined && flags.adopt) {
    throw usageError('omni item new: --out never adopts — pass --out or --adopt, not both; a relayed medium item stays open for the wave to adopt.');
  }
  const prd = positiveInt('item new', '--prd', flags.prd);
  const slice = flags.slice;
  const asJson = Boolean(flags.json);

  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) throw usageError(`omni item new: PRD ${prd} has no inbox or shipped folder.`);

  // Where the item file goes: the PRD's outbox (repo-relative), or `--out`'s folder (PRD 563).
  const outDir = flags.out === undefined ? null : inRoot(ctx, flags.out);
  const destination = outDir === null ? { abs: join(ctx.root, outboxDir), shown: outboxDir } : { abs: outDir, shown: flags.out };

  const input = readItemInput(ctx, flags.file);
  const laws = lawsFor(ctx);
  const bearsOn = input.bearsOn ?? 'none';

  let decision;
  try {
    decision = decideRecording({
      bearsOn,
      breaksNamedLaw: input.breaksNamedLaw ?? false,
      needsHumanAction: input.needsHumanAction ?? false,
      hardToRevert: input.hardToRevert ?? false,
      principlesConflict: input.principlesConflict ?? [],
      laws,
    });
  } catch (error) {
    throw usageError(`omni item new: ${error.message}`);
  }

  if (!decision.writesItem) {
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, reason: decision.reason }));
    } else {
      println(stderr, `omni item new — nothing was written (${decision.outcome}): ${decision.reason}`);
    }
    return 1;
  }

  if (decision.rank === 'human-action' && !input.personSteps) {
    throw usageError('omni item new: "personSteps" is required — the decision settled at rank "human-action", which carries no options.');
  }
  if (decision.rank !== 'human-action' && !input.options) {
    throw usageError('omni item new: "options" is required unless the decision settles at rank "human-action".');
  }

  const id = nextItemId(prd, slice, input.slug, { ctx, outDir });
  let text;
  try {
    text = renderOutboxItem({
      id,
      prd,
      slice,
      wave: input.wave,
      raised: input.raised ?? todayUtc(),
      bearsOn,
      rank: decision.rank,
      questionPlain: input.questionPlain,
      decisionPlain: input.decisionPlain,
      introFun: input.introFun,
      punchlineFun: input.punchlineFun,
      decide: input.decide,
      meanwhile: input.meanwhile,
      cost: input.cost,
      gaps: input.gaps,
      options: decision.rank === 'human-action' ? null : input.options,
      personSteps: decision.rank === 'human-action' ? input.personSteps : null,
      laws,
    });
  } catch (error) {
    throw usageError(`omni item new: ${error.message}`);
  }

  // The same grading `omni check outbox` runs on every open item, run here before anything is
  // written — a raised item that `check outbox` would immediately reject (a below-floor rank, a
  // malformed options section, a backticked code name in a plain-words section…) is caught at the
  // source instead of surfacing later as a separate, harder-to-attribute failure. This is a
  // usage error: nothing is written, every violation goes to stderr, one per line, and the exit
  // code is 2 — `outcome: 'record'` (or `'stop'` / `'blocked'`) is never reached, `--json` or not.
  const renderedFile = `${outboxDir}/${id}.md`;
  const violations = checkItemText(renderedFile, text, { ctx, laws });
  if (violations.length > 0) {
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: null, reason: violations.join('; ') }));
    } else {
      println(stderr, 'omni item new: the rendered item fails "check outbox" — nothing was written:');
      for (const violation of violations) println(stderr, `  - ${violation}`);
    }
    return 2;
  }

  // `outcome !== 'record'` here means `'stop'` (a principles conflict) or `'blocked'`
  // (`needsHumanAction`) — both `writesItem: true`. The item is written exactly as a `record`
  // would be, but the slice cannot carry on: a non-zero exit, with the reason on stderr, is the
  // whole difference.
  if (decision.outcome !== 'record') {
    const file = writeItemFile(destination, id, text);
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, file, reason: decision.reason }));
    } else {
      println(stdout, file);
      println(stderr, `omni item new — the slice ${NONZERO_OUTCOME_LABEL[decision.outcome]}: ${decision.reason}`);
    }
    return 1;
  }

  if (decision.rank === 'medium' && flags.adopt) {
    const result = adoptItem({ ctx, itemText: text });
    if (!result.ok) {
      if (asJson) {
        println(stdout, jsonOutcome({ outcome: null, reason: result.errors.join('; ') }));
      } else {
        println(stderr, 'omni item new — nothing was written:');
        for (const error of result.errors) println(stderr, `  - ${error}`);
      }
      return 1;
    }
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, adopted: true }));
    } else {
      println(
        stdout,
        `omni item new — ${id} adopted straight to ${result.settledFile}; no open item file was written.`,
      );
    }
    return 0;
  }

  const file = writeItemFile(destination, id, text);
  if (asJson) {
    println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, file }));
  } else {
    println(stdout, file);
  }
  return 0;
}

/** Writes `text` as `<id>.md` in the destination folder, creating it if needed, and returns the
 * path written as the caller named it: repo-relative for the outbox, `--out`'s own spelling
 * otherwise. */
function writeItemFile(destination, id, text) {
  mkdirSync(destination.abs, { recursive: true });
  writeFileSync(join(destination.abs, `${id}.md`), text);
  return join(destination.shown, `${id}.md`);
}

// `omni item relay <dir> --prd <n>` (PRD 563, s3) — moves every item and account a slice built in
// a target wrote to scratch into the PRD's outbox, through `relayFolder`. Each move is printed on
// stdout; each refused file on stderr with its reason, left in place, and the exit is 2 while the
// others still move. An empty folder relays nothing, exit 0.
async function runRelay(args, { ctx, stdout, stderr }) {
  const { positional, flags } = parseArgs('item relay', args, { values: ['prd'] });
  if (positional.length !== 1 || flags.prd === undefined) throw usageError(RELAY_USAGE);
  const prd = positiveInt('item relay', '--prd', flags.prd);
  if (ctx.layout.outboxDir(prd) === null) throw usageError(`omni item relay: PRD ${prd} has no inbox or shipped folder.`);
  const dir = inRoot(ctx, positional[0]);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw usageError(`omni item relay: ${positional[0]} is not a folder.`);
  }

  const { moved, refused } = relayFolder({ ctx, laws: lawsFor(ctx), prd, dir });
  if (moved.length === 0 && refused.length === 0) {
    println(stdout, `omni item relay — nothing to relay in ${positional[0]}.`);
    return 0;
  }
  for (const { from, to } of moved) println(stdout, `moved ${from} → ${to}`);
  for (const { file, reason } of refused) println(stderr, `refused ${file} — ${reason}`);
  return refused.length > 0 ? 2 : 0;
}

export const item = {
  async run(args, io) {
    const [sub, ...rest] = args;
    if (sub === 'new') return runNew(rest, io);
    if (sub === 'relay') return runRelay(rest, io);
    throw usageError(USAGE);
  },
};
