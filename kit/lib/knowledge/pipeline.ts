/**
 * **The harvest pipeline** (PRD #82, slice s7): the one sequence `omni harvest` and the app's
 * `knowledge-harvest` function share. It wires the harvest's units together and nothing else:
 *
 * - {@link prepareHarvest} settles at merge (`settleAtMerge`), plans the ship (`planShip`) when the
 *   PRD is still in the inbox, and lists the candidates (`harvestCandidates`) with the knowledge
 *   base's summary (`knowledgeSummary`) the classifier needs.
 * - {@link classifyCandidate} asks the model about one candidate, through the kit's OpenRouter
 *   client, against the classifier's contract. A caller runs it once per candidate (the app, one
 *   step each).
 * - {@link finishHarvest} applies what prepare planned, writes the knowledge (`writeKnowledge`),
 *   runs `omni check knowledge` and `omni check outbox` on the result, and drops every entry that
 *   fails, which becomes not placed with the check's message. When no candidate became a register
 *   entry or a decision record ({@link PROMOTIONS}), it writes none of its own ledger lines
 *   (PRD #487): its edits are then only what prepare planned, none at all once the PRD is shipped.
 *
 * **Both halves return edits as data and touch no file of the tree they read.** An edit set is
 * `{ deletes, moves, writes }`, applied in that order: `deletes` and `moves` name paths as the tree
 * holds them before, `writes` name paths as they are once the moves have run. The same tree and the
 * same input give the same edits, whichever caller. {@link applyHarvestEdits} applies them to a
 * working tree; the app commits them through its own writer.
 *
 * Each half works in a scratch tree: a copy of the loop's own folders (delivery, knowledge,
 * decision records, playbook, glossary), every other entry of the tree linked in place, so a
 * `Source:` naming a code file still resolves. The scratch tree is removed before the half returns.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createContext, type Context } from '../context.ts';
import { movedPath, planShip } from '../delivery/ship.ts';
import { findOutboxViolations } from '../outbox/check-outbox.ts';
import { settleAtMerge } from '../outbox/settle-merge.ts';
import { askModel, NO_KEY, REFUSED, type OpenRouterSettings } from '../openrouter.ts';
import { gradeKnowledge } from './check-knowledge.ts';
import {
  allowedKinds,
  classificationJsonSchema,
  classificationPrompt,
  classificationSchema,
  knowledgeSummary,
  type ClassificationReply,
  type KnowledgeSummary,
  type PromptCandidate,
} from './classify.ts';
import { defined } from '../narrow.ts';
import { harvestCandidates, type Candidate } from './harvest.ts';
import { writeKnowledge, type Classified, type Merge, type Placed, type Taken, type WriteResult } from './write.ts';
import type { PrdNumber } from '../ids.ts';

/** A move of one path to another, as the tree holds them before and after. */
export type Move = { from: string; to: string };

/** One file written, at its path once the moves have run. */
export type Write = { path: string; text: string };

/** An edit set: applied deletes first, then moves, then writes. */
export type HarvestEdits = { deletes: string[]; moves: Move[]; writes: Write[] };

/** What {@link prepareHarvest} returns. */
export type Prepared =
  | {
      ok: true;
      prd: PrdNumber;
      edits: HarvestEdits;
      settled: { id: string; from: 'open' | 'drift' }[];
      shipped: Move[];
      candidates: Candidate[];
      summary: KnowledgeSummary;
    }
  | { ok: false; errors: string[] };

/** One candidate's classification: the reply the classifier's schema accepted, or why there is none. */
export type Classification = { id: string; reply: ClassificationReply | null; reason: string | null; error: string | null };

/** The reason a candidate is not placed when the model's reply was refused, then refused again. */
export const REFUSED_TWICE = "the model's reply was refused twice";

/** The reason every candidate is not placed in a repository with no place for knowledge. */
export const NO_PLACE = 'this repository has no knowledge folder and no decision-record folder';

/** The system message of every classification call. */
export const CLASSIFY_SYSTEM =
  'You place settled decisions of a software delivery loop into its knowledge base. You never invent an id, a file or a place. Reply with one JSON object.';

// ── The scratch tree ──────────────────────────────────────────────────────────────────────────

/** The folders and files of the loop a harvest reads or changes, relative to the root. */
function loopPaths(ctx: Context): string[] {
  const { paths } = ctx.config;
  return [paths.delivery, paths.knowledge, paths.adr, paths.playbook, paths.glossary]
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
    .map((path) => path.replace(/\/+$/, ''));
}

/**
 * A scratch tree over `ctx.root`: every path of `keep` copied, every other entry linked in place,
 * `.git` left out. Returns its root.
 */
function overlay(root: string, keep: readonly string[]): string {
  const scratch = mkdtempSync(join(tmpdir(), 'omni-harvest-'));
  const walk = (dir: string): void => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = dir ? `${dir}/${name}` : name;
      if (!dir && name === '.git') continue;
      if (keep.includes(rel)) {
        cpSync(join(root, rel), join(scratch, rel), { recursive: true });
      } else if (keep.some((path) => path.startsWith(`${rel}/`)) && statSync(join(root, rel)).isDirectory()) {
        mkdirSync(join(scratch, rel), { recursive: true });
        walk(rel);
      } else {
        symlinkSync(join(root, rel), join(scratch, rel));
      }
    }
  };
  walk('');
  return scratch;
}

/** Runs `fn` with a context rooted at a scratch tree over `ctx`'s, removed afterwards. */
function inScratch<T>(ctx: Context, fn: (scratch: Context) => T): T {
  const root = overlay(ctx.root, loopPaths(ctx));
  try {
    return fn(createContext(root, ctx.config));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Every file under `dir` in the tree at `root`, relative to it; links are not followed. */
function filesUnder(root: string, dir: string): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

// ── Edits ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Applies an edit set to the tree at `root`: the deletes, then the moves, then the writes. Plain
 * file operations: nothing is staged, nothing committed.
 */
export function applyHarvestEdits({ root, edits }: { root: string; edits: HarvestEdits }): void {
  for (const path of edits.deletes) rmSync(join(root, path), { force: true });
  for (const { from, to } of edits.moves) {
    mkdirSync(dirname(join(root, to)), { recursive: true });
    renameSync(join(root, from), join(root, to));
  }
  for (const { path, text } of edits.writes) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** `writes` with one entry per path, the later text winning, in the order paths first appear. */
function mergeWrites(writes: readonly Write[]): Write[] {
  const byPath = new Map<string, string>();
  for (const write of writes) byPath.set(write.path, write.text);
  return [...byPath].map(([path, text]) => ({ path, text }));
}

// ── Prepare ───────────────────────────────────────────────────────────────────────────────────

/** The first half: settle at merge, plan the ship, list the candidates. Touches no file of `ctx`'s tree. */
export function prepareHarvest({ ctx, prd, merge }: { ctx: Context; prd: PrdNumber; merge: Merge }): Prepared {
  const n = prd;
  if (ctx.layout.whereIs(n) === null) return { ok: false, errors: [`PRD ${n} has no inbox or shipped folder`] };
  return inScratch(ctx, (scratch): Prepared => {
    const settle = settleAtMerge({ ctx: scratch, prd: n, merge });
    if (!settle.ok) return { ok: false, errors: settle.errors };
    const settleEdits: HarvestEdits = {
      deletes: settle.deletes,
      moves: [],
      writes: settle.text === null ? [] : [{ path: settle.settledFile, text: settle.text }],
    };
    applyHarvestEdits({ root: scratch.root, edits: settleEdits });

    let moves: Move[] = [];
    let rewrites: Write[] = [];
    if (defined(scratch.layout.whereIs(n), `the folder of PRD ${n}`).state === 'inbox') { // the folder exists in `ctx`'s tree, checked above, and the scratch tree copies it
      const files = loopPaths(scratch).flatMap((path) => filesUnder(scratch.root, path));
      const plan = planShip(scratch, n, { files: [...new Set(files)].sort(), read: (file: string) => readFileSync(join(scratch.root, file), 'utf8') });
      if (!plan.ok) return { ok: false, errors: plan.reasons };
      moves = plan.moves;
      rewrites = plan.rewrites.map(({ file, text }: { file: string; text: string }) => ({ path: movedPath(moves, file), text }));
      applyHarvestEdits({ root: scratch.root, edits: { deletes: [], moves, writes: rewrites } });
    }

    const edits: HarvestEdits = {
      deletes: settleEdits.deletes,
      moves,
      writes: mergeWrites([...settleEdits.writes.map((w) => ({ path: movedPath(moves, w.path), text: w.text })), ...rewrites]),
    };
    return {
      ok: true,
      prd: n,
      edits,
      settled: settle.entries.map(({ id, from }: { id: string; from: 'open' | 'drift' }) => ({ id, from })),
      shipped: moves,
      candidates: harvestCandidates({ ctx: scratch, prd: n }),
      summary: knowledgeSummary({ ctx: scratch }),
    };
  });
}

// ── Classify ──────────────────────────────────────────────────────────────────────────────────

/** Asks the model where one candidate belongs. Never throws. `reply` null means not placed, and `reason` says why. */
export async function classifyCandidate({
  candidate,
  summary,
  openrouter,
  fetch,
}: {
  candidate: PromptCandidate;
  summary: KnowledgeSummary;
  /** OpenRouter's settings, as the runtime's env module reads them; `null` when it is off. */
  openrouter: OpenRouterSettings | null;
  fetch?: typeof globalThis.fetch | undefined;
}): Promise<Classification> {
  if (allowedKinds(summary.places).every((kind) => kind === 'covered' || kind === 'stays-here')) {
    return { id: candidate.id, reply: null, reason: NO_PLACE, error: null };
  }
  const check = classificationSchema(summary);
  const answer = await askModel({
    system: CLASSIFY_SYSTEM,
    user: classificationPrompt({ candidate, summary }),
    check,
    schema: { name: 'classification', schema: classificationJsonSchema(summary) },
    openrouter,
    fetch,
    title: 'omni harvest',
  });
  if (answer.ok) {
    // askModel returns only a reply `check` accepted, so parsing it again keeps it as it is.
    const kept = check.safeParse(answer.reply);
    if (kept.success) return { id: candidate.id, reply: kept.data, reason: null, error: null };
    return { id: candidate.id, reply: null, reason: `the model's reply could not be read: ${kept.error.message}`, error: null };
  }
  const reason = answer.error === REFUSED ? `${REFUSED_TWICE}: ${answer.reason}` : `the model could not be asked: ${answer.reason}`;
  return { id: candidate.id, reply: null, reason, error: answer.error === NO_KEY ? NO_KEY : answer.error };
}

// ── Finish ────────────────────────────────────────────────────────────────────────────────────

function knowledgeFiles(ctx: Context): string[] {
  return filesUnder(ctx.root, ctx.layout.knowledgeRoot).filter((file) => file.endsWith('.md'));
}

/** Both checks' violations on the tree at `ctx`, each prefixed by the check that found it. */
function runChecks(ctx: Context): { knowledge: string[]; outbox: string[] } {
  const knowledge = existsSync(join(ctx.root, ctx.layout.knowledgeRoot))
    ? gradeKnowledge({ ctx, files: knowledgeFiles(ctx) }).violations
    : [];
  const outbox = findOutboxViolations({ ctx });
  return { knowledge, outbox };
}

const newOnes = (after: readonly string[], before: readonly string[]): string[] => after.filter((line) => !before.includes(line));

/** The kinds that make a candidate knowledge: a new register entry or a decision record. */
export const PROMOTIONS: readonly string[] = Object.freeze(['adr', 'rule', 'invariant']);

/**
 * The second half: apply what prepare planned, write the knowledge, run both checks, and drop every
 * entry that fails. Touches no file of `ctx`'s tree. `checks` holds what still fails on the result;
 * an entry of this run never does.
 */
export function finishHarvest({
  ctx,
  prepared,
  classified,
  merge,
  taken = {},
  date,
}: {
  ctx: Context;
  prepared: { prd: PrdNumber; edits: HarvestEdits };
  classified: readonly { id: string; reply?: ClassificationReply | null; reason?: string | null }[];
  merge: Merge;
  taken?: Taken;
  date: string;
}): {
  edits: HarvestEdits;
  placed: Placed[];
  notPlaced: { id: string; reason: string }[];
  checks: { knowledge: string[]; outbox: string[] };
} {
  return inScratch(ctx, (scratch) => {
    applyHarvestEdits({ root: scratch.root, edits: prepared.edits });
    const before = runChecks(scratch);
    const replies = new Map(classified.map((entry) => [entry.id, entry]));
    const candidates = harvestCandidates({ ctx: scratch, prd: prepared.prd });
    const dropped = new Map<string, string>();

    const attempt = (keep: string[] | null): WriteResult => {
      const input = candidates.map((candidate): Classified | null => {
        const given = replies.get(candidate.id);
        if (dropped.has(candidate.id)) return { candidate, reply: null, reason: dropped.get(candidate.id) };
        if (!given) return { candidate, reply: null, reason: 'not classified' };
        if (keep && !keep.includes(candidate.id)) return null;
        return { candidate, reply: given.reply ?? null, reason: given.reason ?? undefined };
      });
      return writeKnowledge({
        ctx: scratch,
        classified: input.filter((entry): entry is Classified => entry !== null),
        merge,
        taken,
        date,
      });
    };

    /** The violations a write adds to the tree, on a throwaway copy of the scratch tree. */
    const failures = (result: WriteResult): string[] =>
      inScratch(scratch, (trial) => {
        applyHarvestEdits({ root: trial.root, edits: { deletes: [], moves: [], writes: result.writes } });
        const after = runChecks(trial);
        return [...newOnes(after.knowledge, before.knowledge), ...newOnes(after.outbox, before.outbox)];
      });

    let result = attempt(null);
    if (failures(result).length > 0) {
      // One entry at a time, in ledger order: an entry whose own write adds a violation is dropped.
      const kept: string[] = [];
      for (const entry of result.placed) {
        const trial = attempt([...kept, entry.id]);
        const failed = failures(trial);
        if (failed.length > 0) dropped.set(entry.id, `the checks refused it: ${failed.join('; ')}`);
        else kept.push(entry.id);
      }
      result = attempt(null);
    }

    // No promotion, no notes: a harvest that made nothing knowledge writes none of its own lines.
    const writes = result.placed.some((entry) => PROMOTIONS.includes(entry.kind)) ? result.writes : [];
    applyHarvestEdits({ root: scratch.root, edits: { deletes: [], moves: [], writes } });
    const checks = runChecks(scratch);
    const edits: HarvestEdits = {
      deletes: prepared.edits.deletes,
      moves: prepared.edits.moves,
      writes: mergeWrites([...prepared.edits.writes, ...writes]),
    };
    return { edits, placed: result.placed, notPlaced: result.notPlaced, checks };
  });
}

/** Whether an edit set changes nothing. */
export function noEdits(edits: HarvestEdits): boolean {
  return edits.deletes.length === 0 && edits.moves.length === 0 && edits.writes.length === 0;
}
