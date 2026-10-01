// @ts-nocheck
// node apps/galaxy/scripts/timings.ts --cookie <file> [--base <url>] [--runs <n>] (PRD 657) — load
// /prd, /app, /app/workspace and /app/fleet ten times each as a signed-in person, and print the median
// and p75 time to first byte and to the full document per page, as a Markdown table for timings.md.
// With no cookie it stops and says how to copy one from the browser. The logic lives in src/timings/,
// which plain Node loads as TypeScript.
import { readFileSync } from 'node:fs';
import { timings } from '../src/timings/run.ts';

process.exit(await timings(process.argv.slice(2), {
  fetch: (url, init) => fetch(url, init),
  readFile: (path) => readFileSync(path, 'utf8'),
  now: () => performance.now(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}));
