// `omni follow-up add --source <source> --text <text> [--repos <owner/name>,…]` and
// `omni follow-up list [--json]` (PRD 2739) — the open points a fix or a review leaves, one file each in
// `<paths.delivery>/follow-ups/` of the checkout it runs in. `add` prints the file's path; it exits 1 on a
// point already filed and 2 on an empty or over-long text or a source of no known shape. `list` prints
// date, source and first line, oldest first (`none` with no point); `--json` prints the same as JSON.
// No network call.
import { join, relative } from 'node:path';
import { addFollowUp, FOLLOW_UPS_DIR, readFollowUps } from '../../lib/follow-ups/follow-ups.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = [
  'usage: omni follow-up add --source <source> --text <text> [--repos <owner/name>,…]',
  '       omni follow-up list [--json]',
].join('\n');

function add(rest: string[], dir: string, { ctx, stdout, stderr }: CommandIo): number {
  const { positional, flags } = parseArgs('follow-up add', rest, { values: ['source', 'text', 'repos'] });
  if (positional.length > 0 || flags.source === undefined || flags.text === undefined) throw usageError(USAGE);
  const repos = (flags.repos ?? '').split(',').map((repo) => repo.trim()).filter((repo) => repo !== '');
  const date = new Date().toISOString().slice(0, 10);
  const result = addFollowUp(dir, { source: flags.source, text: flags.text, repos, date });
  if (!result.ok) {
    println(stderr, result.line);
    return result.code;
  }
  println(stdout, relative(ctx.root, result.file));
  return 0;
}

function list(rest: string[], dir: string, { stdout }: CommandIo): number {
  const { positional, flags } = parseArgs('follow-up list', rest, { booleans: ['json'] });
  if (positional.length > 0) throw usageError(USAGE);
  const points = readFollowUps(dir);
  if (flags.json === true) println(stdout, JSON.stringify(points));
  else if (points.length === 0) println(stdout, 'none');
  else for (const point of points) println(stdout, `${point.date}  ${point.source}  ${point.text.split('\n')[0] ?? ''}`);
  return 0;
}

export const followUp: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [verb, ...rest] = args;
    const dir = join(io.ctx.root, io.ctx.config.paths.delivery, FOLLOW_UPS_DIR);
    if (verb === 'add') return add(rest, dir, io);
    if (verb === 'list') return list(rest, dir, io);
    throw usageError(USAGE);
  }),
};
