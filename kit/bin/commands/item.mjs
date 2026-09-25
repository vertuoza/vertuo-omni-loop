// `omni item new --prd <n> --slice <id> --json <file> [--adopt]` — records one decision as an
// outbox item, through the recording policy in `kit/lib/policy/outbox-policy.mjs`. The JSON file
// carries `renderOutboxItem`'s fields minus `prd`, `slice` and `laws` (this command supplies all
// three) and minus `id` (this command picks the next free one) and `rank` (`decideRecording`
// decides it). `decideRecording` is always run — every one of its own inputs is optional with a
// safe default, so a JSON file that names none of them still "carries what it needs": a plain
// question with no `bears-on` and no named risk.
//
// A `stop` or `blocked` verdict writes nothing at all and exits 1 — even though `decideRecording`
// itself marks a `blocked` (`human-action`) decision `writesItem: true`; see the outbox item this
// slice raised about that choice. A `record` verdict renders the item and writes it, unless its
// settled rank is `medium` and `--adopt` was passed — then it is adopted straight to the ledger
// through `adoptItem` and no open file is ever created, so a parallel wave's slices never race to
// append the same PRD's `settled.md`. Without `--adopt`, a medium item stays an open file: the
// orchestrator adopts it once the wave has merged.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { lawsFor } from '../../lib/laws.mjs';
import { outboxItemFiles, SETTLED_FILE } from '../../lib/outbox/outbox.mjs';
import { adoptItem, parseSettledEntries } from '../../lib/outbox/settle.mjs';
import { decideRecording, renderOutboxItem } from '../../lib/policy/outbox-policy.mjs';
import { parseArgs, positiveInt, println, readUserFile, usageError } from '../args.mjs';

const USAGE = 'usage: omni item new --prd <n> --slice <id> --json <file> [--adopt]';

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    decide: z.string().trim().min(1, 'decide is required'),
    meanwhile: z.string().trim().min(1, 'meanwhile is required'),
    cost: z.string().trim().min(1, 'cost is required'),
    gaps: z.array(z.string().trim().min(1)).min(1, 'gaps needs at least one entry'),
    options: z
      .array(z.string().trim().min(1))
      .min(2, 'options needs two to four entries')
      .max(4, 'options needs two to four entries'),
  })
  .strict();

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
function spentIds(prd, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  const prefix = `${outboxDir}/`;
  const ids = new Set(
    outboxItemFiles({ ctx })
      .filter((path) => path.startsWith(prefix))
      .map((path) => basename(path, '.md')),
  );
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
function spentNumbers(prd, slice, { ctx }) {
  const prefix = `${slice}-`;
  const shape = /^-(\d{2})-/;
  const numbers = new Set();
  for (const id of spentIds(prd, { ctx })) {
    if (!id.startsWith(prefix)) continue;
    const match = id.slice(prefix.length - 1).match(shape);
    if (match) numbers.add(match[1]);
  }
  return numbers;
}

/** The next free `<slice>-<nn>-<slug>` id, `nn` the smallest two-digit number this slice has not
 * already spent under ANY slug (as an open file or in `settled.md`) — a running counter per
 * slice, not per slug. */
function nextItemId(prd, slice, slug, { ctx }) {
  const spent = spentNumbers(prd, slice, { ctx });
  for (let n = 1; n <= 99; n += 1) {
    const nn = String(n).padStart(2, '0');
    if (!spent.has(nn)) return `${slice}-${nn}-${slug}`;
  }
  throw usageError(`omni item new: ${slice} under PRD ${prd} has already spent every number 01-99.`);
}

async function runNew(args, { ctx, stdout, stderr }) {
  const { positional, flags } = parseArgs('item new', args, {
    values: ['prd', 'slice', 'json'],
    booleans: ['adopt'],
  });
  if (positional.length !== 0 || flags.prd === undefined || flags.slice === undefined || flags.json === undefined) {
    throw usageError(USAGE);
  }
  const prd = positiveInt('item new', '--prd', flags.prd);
  const slice = flags.slice;

  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) throw usageError(`omni item new: PRD ${prd} has no inbox or shipped folder.`);

  const input = readItemInput(ctx, flags.json);
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

  if (decision.outcome === 'stop' || decision.outcome === 'blocked') {
    println(stderr, `omni item new — nothing was written (${decision.outcome}): ${decision.reason}`);
    return 1;
  }

  const id = nextItemId(prd, slice, input.slug, { ctx });
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
      decide: input.decide,
      meanwhile: input.meanwhile,
      cost: input.cost,
      gaps: input.gaps,
      options: input.options,
      laws,
    });
  } catch (error) {
    throw usageError(`omni item new: ${error.message}`);
  }

  if (decision.rank === 'medium' && flags.adopt) {
    const result = adoptItem({ ctx, itemText: text });
    if (!result.ok) {
      println(stderr, 'omni item new — nothing was written:');
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    println(
      stdout,
      `omni item new — ${id} adopted straight to ${result.settledFile}; no open item file was written.`,
    );
    return 0;
  }

  const file = `${outboxDir}/${id}.md`;
  mkdirSync(join(ctx.root, outboxDir), { recursive: true });
  writeFileSync(join(ctx.root, file), text);
  println(stdout, file);
  return 0;
}

export const item = {
  async run(args, io) {
    const [sub, ...rest] = args;
    if (sub !== 'new') throw usageError(USAGE);
    return runNew(rest, io);
  },
};
