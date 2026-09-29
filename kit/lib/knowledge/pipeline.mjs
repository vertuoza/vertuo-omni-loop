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
import { createContext } from '../context.mjs';
import { movedPath, planShip } from '../delivery/ship.mjs';
import { findOutboxViolations } from '../outbox/check-outbox.mjs';
import { settleAtMerge } from '../outbox/settle-merge.mjs';
import { askModel, NO_KEY, REFUSED } from '../openrouter.mjs';
import { gradeKnowledge } from './check-knowledge.mjs';
import { allowedKinds, classificationJsonSchema, classificationPrompt, classificationSchema, knowledgeSummary } from './classify.mjs';
import { harvestCandidates } from './harvest.mjs';
import { writeKnowledge } from './write.mjs';

/** The reason a candidate is not placed when the model's reply was refused, then refused again. */
export const REFUSED_TWICE = "the model's reply was refused twice";

/** The reason every candidate is not placed in a repository with no place for knowledge. */
export const NO_PLACE = 'this repository has no knowledge folder and no decision-record folder';

/** The system message of every classification call. */
export const CLASSIFY_SYSTEM =
  'You place settled decisions of a software delivery loop into its knowledge base. You never invent an id, a file or a place. Reply with one JSON object.';

// ── The scratch tree ──────────────────────────────────────────────────────────────────────────

/** The folders and files of the loop a harvest reads or changes, relative to the root. */
function loopPaths(ctx) {
  const { paths } = ctx.config;
  return [paths.delivery, paths.knowledge, paths.adr, paths.playbook, paths.glossary]
    .filter((path) => typeof path === 'string' && path.length > 0)
    .map((path) => path.replace(/\/+$/, ''));
}

/**
 * A scratch tree over `ctx.root`: every path of `keep` copied, every other entry linked in place,
 * `.git` left out. Returns its root.
 */
function overlay(root, keep) {
  const scratch = mkdtempSync(join(tmpdir(), 'omni-harvest-'));
  const walk = (dir) => {
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
function inScratch(ctx, fn) {
  const root = overlay(ctx.root, loopPaths(ctx));
  try {
    return fn(createContext(root, ctx.config));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Every file under `dir` in the tree at `root`, relative to it; links are not followed. */
function filesUnder(root, dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const out = [];
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
 *
 * @param {{ root: string, edits: { deletes: string[], moves: { from: string, to: string }[], writes: { path: string, text: string }[] } }} input
 */
export function applyHarvestEdits({ root, edits }) {
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
function mergeWrites(writes) {
  const byPath = new Map();
  for (const write of writes) byPath.set(write.path, write.text);
  return [...byPath].map(([path, text]) => ({ path, text }));
}

// ── Prepare ───────────────────────────────────────────────────────────────────────────────────

/**
 * The first half: settle at merge, plan the ship, list the candidates. Touches no file of `ctx`'s
 * tree.
 *
 * @param {{ ctx: object, prd: number | string, merge: { by: string, at: string, pr: number, url?: string } }} input
 * @returns {{ ok: true, prd: number, edits: { deletes: string[], moves: { from: string, to: string }[], writes: { path: string, text: string }[] },
 *   settled: { id: string, from: 'open' | 'drift' }[], shipped: { from: string, to: string }[],
 *   candidates: object[], summary: object } | { ok: false, errors: string[] }}
 */
export function prepareHarvest({ ctx, prd, merge }) {
  const n = Number(prd);
  if (ctx.layout.whereIs(n) === null) return { ok: false, errors: [`PRD ${n} has no inbox or shipped folder`] };
  return inScratch(ctx, (scratch) => {
    const settle = settleAtMerge({ ctx: scratch, prd: n, merge });
    if (!settle.ok) return { ok: false, errors: settle.errors };
    const settleEdits = {
      deletes: settle.deletes,
      moves: [],
      writes: settle.text === null ? [] : [{ path: settle.settledFile, text: settle.text }],
    };
    applyHarvestEdits({ root: scratch.root, edits: settleEdits });

    let moves = [];
    let rewrites = [];
    if (scratch.layout.whereIs(n).state === 'inbox') {
      const files = loopPaths(scratch).flatMap((path) => filesUnder(scratch.root, path));
      const plan = planShip(scratch, n, { files: [...new Set(files)].sort(), read: (file) => readFileSync(join(scratch.root, file), 'utf8') });
      if (!plan.ok) return { ok: false, errors: plan.reasons };
      moves = plan.moves;
      rewrites = plan.rewrites.map(({ file, text }) => ({ path: movedPath(moves, file), text }));
      applyHarvestEdits({ root: scratch.root, edits: { deletes: [], moves, writes: rewrites } });
    }

    const edits = {
      deletes: settleEdits.deletes,
      moves,
      writes: mergeWrites([...settleEdits.writes.map((w) => ({ path: movedPath(moves, w.path), text: w.text })), ...rewrites]),
    };
    return {
      ok: true,
      prd: n,
      edits,
      settled: settle.entries.map(({ id, from }) => ({ id, from })),
      shipped: moves,
      candidates: harvestCandidates({ ctx: scratch, prd: n }),
      summary: knowledgeSummary({ ctx: scratch }),
    };
  });
}

// ── Classify ──────────────────────────────────────────────────────────────────────────────────

/**
 * Asks the model where one candidate belongs. Never throws.
 *
 * @returns {Promise<{ id: string, reply: object | null, reason: string | null, error: string | null }>}
 *   `reply` null means not placed, and `reason` says why.
 */
export async function classifyCandidate({ candidate, summary, env, fetch }) {
  if (allowedKinds(summary.places).every((kind) => kind === 'covered' || kind === 'stays-here')) {
    return { id: candidate.id, reply: null, reason: NO_PLACE, error: null };
  }
  const answer = await askModel({
    system: CLASSIFY_SYSTEM,
    user: classificationPrompt({ candidate, summary }),
    check: classificationSchema(summary),
    schema: { name: 'classification', schema: classificationJsonSchema(summary) },
    env,
    fetch,
    title: 'omni harvest',
  });
  if (answer.ok) return { id: candidate.id, reply: answer.reply, reason: null, error: null };
  const reason = answer.error === REFUSED ? `${REFUSED_TWICE}: ${answer.reason}` : `the model could not be asked: ${answer.reason}`;
  return { id: candidate.id, reply: null, reason, error: answer.error === NO_KEY ? NO_KEY : answer.error };
}

// ── Finish ────────────────────────────────────────────────────────────────────────────────────

function knowledgeFiles(ctx) {
  return filesUnder(ctx.root, ctx.layout.knowledgeRoot).filter((file) => file.endsWith('.md'));
}

/** Both checks' violations on the tree at `ctx`, each prefixed by the check that found it. */
function runChecks(ctx) {
  const knowledge = existsSync(join(ctx.root, ctx.layout.knowledgeRoot))
    ? gradeKnowledge({ ctx, files: knowledgeFiles(ctx) }).violations
    : [];
  const outbox = findOutboxViolations({ ctx });
  return { knowledge, outbox };
}

const newOnes = (after, before) => after.filter((line) => !before.includes(line));

/** The kinds that make a candidate knowledge: a new register entry or a decision record. */
export const PROMOTIONS = Object.freeze(['adr', 'rule', 'invariant']);

/**
 * The second half: apply what prepare planned, write the knowledge, run both checks, and drop every
 * entry that fails. Touches no file of `ctx`'s tree.
 *
 * @param {{ ctx: object, prepared: object, classified: { id: string, reply: object | null, reason?: string | null }[],
 *   merge: { by: string, at: string, pr: number, url?: string }, taken?: { records?: string[], ids?: string[] }, date: string }} input
 * @returns {{ edits: { deletes: string[], moves: object[], writes: object[] }, placed: object[],
 *   notPlaced: { id: string, reason: string }[], checks: { knowledge: string[], outbox: string[] } }}
 *   `checks` holds what still fails on the result; an entry of this run never does.
 */
export function finishHarvest({ ctx, prepared, classified, merge, taken = {}, date }) {
  return inScratch(ctx, (scratch) => {
    applyHarvestEdits({ root: scratch.root, edits: prepared.edits });
    const before = runChecks(scratch);
    const replies = new Map(classified.map((entry) => [entry.id, entry]));
    const candidates = harvestCandidates({ ctx: scratch, prd: prepared.prd });
    const dropped = new Map();

    const attempt = (keep) => {
      const input = candidates.map((candidate) => {
        const given = replies.get(candidate.id);
        if (dropped.has(candidate.id)) return { candidate, reply: null, reason: dropped.get(candidate.id) };
        if (!given) return { candidate, reply: null, reason: 'not classified' };
        if (keep && !keep.includes(candidate.id)) return null;
        return { candidate, reply: given.reply ?? null, reason: given.reason ?? undefined };
      });
      return writeKnowledge({ ctx: scratch, classified: input.filter(Boolean), merge, taken, date });
    };

    /** The violations a write adds to the tree, on a throwaway copy of the scratch tree. */
    const failures = (result) =>
      inScratch(scratch, (trial) => {
        applyHarvestEdits({ root: trial.root, edits: { deletes: [], moves: [], writes: result.writes } });
        const after = runChecks(trial);
        return [...newOnes(after.knowledge, before.knowledge), ...newOnes(after.outbox, before.outbox)];
      });

    let result = attempt(null);
    if (failures(result).length > 0) {
      // One entry at a time, in ledger order: an entry whose own write adds a violation is dropped.
      const kept = [];
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
    const edits = {
      deletes: prepared.edits.deletes,
      moves: prepared.edits.moves,
      writes: mergeWrites([...prepared.edits.writes, ...writes]),
    };
    return { edits, placed: result.placed, notPlaced: result.notPlaced, checks };
  });
}

/** Whether an edit set changes nothing. */
export function noEdits(edits) {
  return edits.deletes.length === 0 && edits.moves.length === 0 && edits.writes.length === 0;
}
