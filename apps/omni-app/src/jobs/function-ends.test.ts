// The guard of bug #2756: the worker runs inside Vercel functions that stop at their `maxDuration`, and it ran past
// them because nothing told it when they end. Two checks keep the two in step:
//
//   - each function that runs the worker states its end as vercel.json does, so a change to one is a change to both;
//   - every call of `runDue` in the App's code passes `endsAt`, so no new caller runs jobs blind to its function's end.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SERVER_EVENT_MAX_DURATION_SECONDS as SERVER_EVENT_SECONDS } from '../server-event/server-event.ts';
import { GITHUB_MAX_DURATION_SECONDS as GITHUB_SECONDS } from '../webhook/github-route.ts';
import { SWEEP_MAX_DURATION_SECONDS as SWEEP_SECONDS } from './sweep.ts';
import { CLAIM_LEFT_MS, FINISH_MARGIN_MS } from './worker.ts';

const app = fileURLToPath(new URL('../../', import.meta.url));
const source = join(app, 'src');

/** The text of each `runDue(…)` call in `code` (its arguments, parentheses balanced), the function's own definition left out. */
function runDueCalls(code: string): string[] {
  const calls: string[] = [];
  for (const match of code.matchAll(/(?<!function )\brunDue\(/g)) {
    const open = match.index + match[0].length;
    let depth = 1;
    let end = open;
    while (end < code.length && depth > 0) {
      if (code[end] === '(') depth += 1;
      else if (code[end] === ')') depth -= 1;
      end += 1;
    }
    calls.push(code.slice(open, end - 1));
  }
  return calls;
}

/** The calls of `runDue` in `code` that do not pass `endsAt`. */
const blindCalls = (code: string): string[] => runDueCalls(code).filter((call) => !/\bendsAt\b/.test(call));

/** Every TypeScript file under `dir` that is not a test. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the worker and the functions it runs in (bug #2756)', () => {
  it('each function that runs the worker states its end as vercel.json does', () => {
    const config = JSON.parse(readFileSync(join(app, 'vercel.json'), 'utf8')) as { functions: Record<string, { maxDuration: number }> };
    expect({
      'api/github.mjs': GITHUB_SECONDS,
      'api/server-event.mjs': SERVER_EVENT_SECONDS,
      'api/jobs-sweep.mjs': SWEEP_SECONDS,
    }).toEqual({
      'api/github.mjs': config.functions['api/github.mjs']?.maxDuration,
      'api/server-event.mjs': config.functions['api/server-event.mjs']?.maxDuration,
      'api/jobs-sweep.mjs': config.functions['api/jobs-sweep.mjs']?.maxDuration,
    });
  });

  it('leaves the shortest function time to claim a job and finish it', () => {
    const shortest = Math.min(GITHUB_SECONDS, SERVER_EVENT_SECONDS, SWEEP_SECONDS) * 1000;
    expect(FINISH_MARGIN_MS).toBeLessThan(CLAIM_LEFT_MS);
    expect(CLAIM_LEFT_MS).toBeLessThan(shortest);
  });

  it('every call of runDue in the App passes endsAt', () => {
    const blind = sources(source).flatMap((file) => blindCalls(readFileSync(file, 'utf8')).map(() => relative(app, file)));
    expect(blind).toEqual([]);
    // The App does run the worker somewhere: an empty scan proves nothing.
    expect(sources(source).filter((file) => runDueCalls(readFileSync(file, 'utf8')).length > 0).length).toBeGreaterThanOrEqual(3);
  });

  describe('the scan itself', () => {
    it('names a call without endsAt, as main\'s routes made them', () => {
      expect(blindCalls('run: () => runDue({ ledger, ...liveWorkers(workerEnv, octokitFor) }),')).toEqual(['{ ledger, ...liveWorkers(workerEnv, octokitFor) }']);
    });

    it('passes a call with endsAt, and leaves out the definition', () => {
      expect(blindCalls('run: (endsAt) => runDue({ ledger, ...liveWorkers(env, octokitFor), endsAt }),')).toEqual([]);
      expect(runDueCalls('export async function runDue({ ledger }) {}')).toEqual([]);
    });
  });
});
