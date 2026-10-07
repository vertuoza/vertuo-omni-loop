// `omni help [<name>]`, `omni --help` and `omni -h`, through `main()` (PRD 315).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { ENTRIES } from '../lib/help/entries.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\npaths:\n  delivery: work/delivery\n' };

async function run(argv: readonly string[], cwd: string) {
  const s = io();
  const code = await main(argv, { cwd, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}
const widest = (text: string) => Math.max(...text.split('\n').map((line: string) => Array.from(line).length));

describe('omni help', () => {
  it('prints the loop, its principles, Claude, the terminal and what the skills run, in order, and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out, err } = await run(['help'], root);
    expect(code).toBe(0);
    expect(err).toBe('');
    const marks = ['THE LOOP', '  idea ', '  PRD ', '  inbox ', '  outbox ', '  shipped ', '  retro ', 'The folder is the status.',
      'IN CLAUDE', 'IN THE TERMINAL', 'Run by the skills:', 'omni help <command> tells more about any of them.\n'];
    const at = marks.map((mark) => out.indexOf(mark));
    expect(at.every((index) => index >= 0), marks.filter((_, i) => (at[i] ?? -1) < 0).join(' | ')).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(out.endsWith('omni help <command> tells more about any of them.\n')).toBe(true);
  });

  it("shows this repository's delivery folders", async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { out } = await run(['help'], root);
    expect(out).toContain('work/delivery/inbox/');
    expect(out).toContain('work/delivery/shipped/');
    expect(out).not.toContain('.omni-loop/delivery/');
  });

  it("works where there is no config, on the kit's defaults", async () => {
    const bare = mkdtempSync(join(tmpdir(), 'omni-help-'));
    const outside = await run(['help'], bare);
    expect(outside.code).toBe(0);
    expect(outside.err).toBe('');
    expect(outside.out).toContain('.omni-loop/delivery/inbox/');
    const { root } = makeRepo({ git: true });
    const uninstalled = await run(['help', 'board'], root);
    expect(uninstalled.code).toBe(0);
    expect(uninstalled.out).toMatch(/^omni board <prd>/);
  });

  it('prints one command: its usage, for you, and its sentences', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', 'board'], root);
    expect(code).toBe(0);
    const [first, blank, ...sentences] = out.trimEnd().split('\n');
    expect(first).toMatch(/^omni board <prd> \[--json\] \[--repo <owner\/name>\] +for you$/);
    expect(blank).toBe('');
    expect(sentences.join(' ')).toMatch(/slices.*wave/);
  });

  it('prints omni next: its usage, for you, and its four verdicts (PRD 1139)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', 'next'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni next \[<prd>…\] \[--json\] \[--plan\] +for you\n/);
    expect(out.replace(/\s+/g, ' ')).toMatch(/act .* wait .* park .* done/);
    expect(out.replace(/\s+/g, ' ')).toMatch(/With no number it drives your own PRDs .* --plan orders every slice .* first step not done/);
  });

  it('prints omni next --roadmap: exactly its PRDs, held on their blockers, parked on a person question (PRD 1162)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { out } = await run(['help', 'next'], root);
    expect(out).toContain('omni next --roadmap <n> [--json] [--plan]');
    expect(out.replace(/\s+/g, ' ')).toMatch(/--roadmap <n> drives exactly roadmap n's PRDs, someone else's included: .* held until .* merged .* parks only the PRDs it blocks.* closed unmerged parks its dependents/);
    const loop = await run(['help', 'loop'], root);
    expect(loop.out.replace(/\s+/g, ' ')).toMatch(/the repositories it touches \(--repos, else the plan's\)/);
  });

  it('prints omni loop: its verbs, run by the skills, and how it never blocks (PRD 1139)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', 'loop'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni loop push start \[--take-over\] +run by the skills\n/);
    expect(out).toContain('omni loop status [--json]');
    expect(out.replace(/\s+/g, ' ')).toMatch(/refuses a second live loop .* --take-over.* 5-second limit and one sign-in refresh.* exits 1 with one line/);
  });

  it('prints /omni:drive: run under /loop, for you, one step per tick, and /omni:pr-care --once (PRD 1139)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', '/omni:drive'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^\/loop \/omni:drive \[<n>…\] +for you\n/);
    expect(out.replace(/\s+/g, ' ')).toMatch(/omni next --plan.* first step not done .*\/omni:pr-care --once.* stops itself/);
    expect(out.replace(/\s+/g, ' ')).toMatch(/never answers the outbox and never merges/);
    const care = await run(['help', 'pr-care'], root);
    expect(care.out).toMatch(/^\/omni:pr-care <n> \[--once\] +for you\n/);
    expect(care.out.replace(/\s+/g, ' ')).toMatch(/--once runs one round and returns/);
  });

  it('prints /omni:mega-drive: run under /loop, for you, the ultra- skills, and --roadmap on both drives (PRD 1162)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', '/omni:mega-drive'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^\/loop \/omni:mega-drive \[<n>…\] +for you\n/);
    expect(out).toContain('/loop /omni:mega-drive --roadmap <n>');
    expect(out.replace(/\s+/g, ' ')).toMatch(/plan repository.*\/omni:ultra-wave.*\/omni:mega-pr-care --once/);
    const drive = await run(['help', 'drive'], root);
    expect(drive.out).toContain('/loop /omni:drive --roadmap <n>');
    const care = await run(['help', 'mega-pr-care'], root);
    expect(care.out).toMatch(/^\/omni:mega-pr-care <n> \[--once\] +for you\n/);
  });

  it('takes a skill by its name or its slash command alike', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const byName = await run(['help', 'yolo'], root);
    const bySlash = await run(['help', '/omni:yolo'], root);
    expect(byName.code).toBe(0);
    expect(byName.out).toBe(bySlash.out);
    expect(byName.out).toMatch(/^\/omni:yolo <n> +for you\n/);
  });

  it("prints the command's entry, then the skill's, for a name that is both", async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { out } = await run(['help', 'plan'], root);
    expect(out).toMatch(/^omni plan check <prd> +run by the skills\n/);
    expect(out).toMatch(/\n\n\/omni:plan <n> +for you\n/);
  });

  it('exits 2 with one line for a name it does not know, or more than one name', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const unknown = await run(['help', 'teleport'], root);
    expect(unknown.code).toBe(2);
    expect(unknown.out).toBe('');
    expect(unknown.err).toBe('omni help: no command "teleport"; omni help lists them all\n');
    const two = await run(['help', 'board', 'yolo'], root);
    expect(two.code).toBe(2);
    expect(two.err).toBe('usage: omni help [<name>]\n');
  });

  it('keeps every line of the overview and of every entry within 80 columns', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(widest((await run(['help'], root)).out)).toBeLessThanOrEqual(80);
    for (const { kind, name } of ENTRIES) {
      const asked = kind === 'skill' ? `/omni:${name}` : name;
      const { code, out } = await run(['help', asked], root);
      expect(code, asked).toBe(0);
      expect(widest(out), asked).toBeLessThanOrEqual(80);
    }
  });
});

describe('omni --help, omni -h and a bare omni', () => {
  it('lists heartbeat among the commands the skills run, and explains it (PRD 757)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const overview = await run(['help'], root);
    expect(overview.out.slice(overview.out.indexOf('Run by the skills:'))).toMatch(/\bheartbeat\b/);
    const { code, out } = await run(['help', 'heartbeat'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni heartbeat \[--end\] +run by the skills\n/);
    expect(out).toMatch(/once a\s+minute/);
  });

  it('lists generated among the commands the skills run, and explains it (PRD 1138)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const overview = await run(['help'], root);
    expect(overview.out.slice(overview.out.indexOf('Run by the skills:'))).toMatch(/\bgenerated\b/);
    const { code, out } = await run(['help', 'generated'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni generated <range> \[--json\] +run by the skills\n/);
    expect(out).toMatch(/stale/);
    expect(out).toMatch(/no generated\s+files/);
  });

  it('lists roadmap among the commands the skills run, and explains its check (PRD 1162)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const overview = await run(['help'], root);
    expect(overview.out.slice(overview.out.indexOf('Run by the skills:'))).toMatch(/\broadmap\b/);
    const { code, out } = await run(['help', 'roadmap'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni roadmap check \[<n>\] +run by the skills\n/);
    expect(out).toContain('work/delivery/inbox/roadmaps/');
    expect(out.replace(/\s+/g, ' ')).toMatch(/a cycle, a wave that does not follow its blockers, a blocker without its why/);
    expect(out.replace(/\s+/g, ' ')).toMatch(/omni check inbox runs it too/);
  });

  it('explains roadmap push and answer (PRD 1162, s6)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['help', 'roadmap'], root);
    expect(code).toBe(0);
    expect(out).toMatch(/^omni roadmap push <n>$/m);
    expect(out).toMatch(/^omni roadmap answer <n> <question> "<answer>"$/m);
    const flat = out.replace(/\s+/g, ' ');
    expect(flat).toMatch(/a 5-second limit and one sign-in refresh/);
    expect(flat).toMatch(/exits 1 with one line \(off, no sign-in, github unreachable, unreachable or refused\)/);
    expect(flat).toMatch(/as a comment on the roadmap's issue, with the marker/);
  });

  it('--help and -h print exactly what omni help prints', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const help = await run(['help'], root);
    for (const flag of ['--help', '-h']) {
      const flagged = await run([flag], root);
      expect(flagged.code, flag).toBe(0);
      expect(flagged.out, flag).toBe(help.out);
    }
  });

  it('a bare omni and an unknown command still exit 2 with the usage line, now naming omni help', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const argv of [[], ['frobnicate']]) {
      const { code, out, err } = await run(argv, root);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
      expect(err).toMatch(/^usage: omni <command> \[args\]\ncommands: [^\n]*\bhelp\b[^\n]*\nomni help: what each command does\n$/);
    }
  });
});
