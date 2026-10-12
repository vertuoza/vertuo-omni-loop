// The budget's red, written for a junior (PRD 1679, D7): for each red target, in this order, what is
// wrong, why it matters, what grew, how to have it fixed, and how to ask for the room. A green check
// is a table of every target's size, ceiling and change; a neutral one says what could not be
// measured, and that it blocks nothing (D6). Pure: what grew is gathered elsewhere
// (`./message-growth.ts` from git, the Omni App from GitHub) and handed in.
import type { TargetVerdict } from './ratchet.ts';
import { raiseLine } from './ratchet.ts';

/** One file behind a target, and the bytes it gained since the base (`null` when unknown). */
export type GrownFile = { path: string; bytesAdded: number | null };

/** What grew behind one target since the base: its files, and the commits that changed them. */
export type Growth = { files: readonly GrownFile[]; commits: readonly { sha: string; subject: string }[] };

/** What every message reads besides the verdicts. */
export type MessageContext = {
  /** The PRD the pull request belongs to, or `null` when it belongs to none. */
  prd: string | number | null;
  /** The ceilings file, as the config names it. */
  ceilingsFile: string;
  /** What grew, by target; a target missing here grew nothing that could be read. */
  growth: Readonly<Record<string, Growth>>;
};

const KIB = 1024;

/** `bytes` in KB, one decimal, a whole number without it: `9.8 KB`, `8 KB`; under 1 KB, in bytes. */
export function kb(bytes: number): string {
  if (bytes < KIB) return `${bytes} bytes`;
  const value = Math.round((bytes / KIB) * 10) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} KB`;
}

/** A target as a person reads it. */
export function targetLabel(target: string): string {
  if (target === 'briefing') return 'the briefing every session reads first';
  if (target === 'session') return 'what every session loads before its first step (`session`)';
  if (target.startsWith('form:')) return `the \`${target.slice('form:'.length)}\` playbook form`;
  if (target.startsWith('context:')) return `the context file \`${target.slice('context:'.length)}\``;
  return `\`${target}\``;
}

const WHY =
  'Why it matters: every AI agent working here reads this before it starts; when it grows, agents get slower, cost more and lose focus, so the team set a ceiling.';

/** 1. What is wrong with the target. */
function whatLine({ target, verdict, bytes, ceiling, baseCeiling }: TargetVerdict): string {
  const label = targetLabel(target);
  if (verdict === 'over-budget') return `Over budget: ${label} is ${kb(bytes ?? 0)}, its ceiling is ${kb(ceiling ?? 0)}.`;
  if (ceiling === null) return `Needs a person's yes: this PR removes the ceiling of ${label} (${kb(baseCeiling ?? 0)}).`;
  if (baseCeiling === null) return `Needs a person's yes: this PR sets a first ceiling of ${kb(ceiling)} on ${label}.`;
  return `Needs a person's yes: this PR raises the ceiling of ${label} from ${kb(baseCeiling)} to ${kb(ceiling)}.`;
}

/** A signed byte change: `+1.2 KB`, `-300 bytes`. */
function change(bytes: number): string {
  return `${bytes < 0 ? '-' : '+'}${kb(Math.abs(bytes))}`;
}

/** 3. What grew: each file and its bytes since the base, then the commits. */
function grewLines(growth: Growth | undefined): string[] {
  if (growth === undefined || (growth.files.length === 0 && growth.commits.length === 0)) {
    return ['What grew: nothing this range changed could be read; compare the files behind it with the base.'];
  }
  const files = growth.files.map(({ path, bytesAdded }) => `  - \`${path}\`${bytesAdded === null ? '' : ` ${change(bytesAdded)} since the base`}`);
  const commits = growth.commits.map(({ sha, subject }) => `  - ${sha} ${subject}`);
  return ['What grew:', ...files, ...(commits.length > 0 ? ['  by the commits:', ...commits] : ['  no commit of this range changed them.'])];
}

/** The file(s) a person trims: those behind the target, or the target itself. */
function trimmed(target: string, growth: Growth | undefined): string {
  const paths = growth?.files.map(({ path }) => `\`${path}\``) ?? [];
  return paths.length > 0 ? paths.join(', ') : `\`${target}\``;
}

/** 4. Fix it for me: the skill on a PRD's pull request, and the prompt on any. */
function fixLines(verdict: TargetVerdict, { prd, growth, ceilingsFile }: MessageContext): string[] {
  const files = trimmed(verdict.target, growth[verdict.target]);
  const trim = (under: number) => `trim ${files} back under ${kb(under)} without losing a rule; move detail into a linked file`;
  const prompt =
    verdict.verdict === 'needs-yes' && verdict.baseCeiling !== null
      ? `"Put the ceiling of \`${verdict.target}\` in \`${ceilingsFile}\` back to ${verdict.baseCeiling}, and ${trim(verdict.baseCeiling)}."`
      : `"${capitalised(trim(verdict.ceiling ?? 0))}."`;
  const skill = prd === null ? '' : `\`/omni:pr-care\` (or \`/omni:yolo-fix ${prd}\`) handles it by itself. Or `;
  return [`Fix it for me: ${skill}${skill ? 'paste' : 'Paste'} this into Claude: ${prompt}`];
}

const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** 5. Or it needs the room: the raise and its high item on a PRD's pull request; none on another. */
function roomLines({ target, bytes, ceiling }: TargetVerdict, { prd, ceilingsFile }: MessageContext): string[] {
  if (prd === null) {
    return [
      'Or it needs the room: this pull request belongs to no PRD, so its ceiling cannot be raised here. Trim it, or make the change through a PRD or `/omni:bug-fix`, whose outbox carries the raise.',
    ];
  }
  const wanted = Math.max(ceiling ?? 0, Math.ceil((bytes ?? 0) / KIB) * KIB);
  return [
    `Or it needs the room: raise the ceiling of \`${target}\` in \`${ceilingsFile}\` in this PR, and file a high outbox item of PRD ${prd} that says why and carries the line ${raiseLine(target, wanted)} (the ceiling you set). A person's answer turns this check green.`,
  ];
}

/** The five parts of one red target's message. */
export function redMessage(verdict: TargetVerdict, context: MessageContext): string[] {
  return [whatLine(verdict), WHY, ...grewLines(context.growth[verdict.target]), ...fixLines(verdict, context), ...roomLines(verdict, context)];
}

/** A ceiling's change against the base, for the table. */
function ceilingChange({ ceiling, baseCeiling }: TargetVerdict): string {
  if (ceiling === baseCeiling) return '—';
  if (ceiling === null) return 'removed';
  if (baseCeiling === null) return 'new';
  return change(ceiling - baseCeiling);
}

/** The table of every target: its size, its ceiling, and the ceiling's change against the base. */
export function budgetTable(verdicts: readonly TargetVerdict[]): string[] {
  const rows = verdicts.map((verdict) => {
    const size = verdict.bytes === null ? `not measured: ${verdict.error ?? 'unknown'}` : kb(verdict.bytes);
    const ceiling = verdict.ceiling === null ? 'none' : kb(verdict.ceiling);
    return `| \`${verdict.target}\` | ${size} | ${ceiling} | ${ceilingChange(verdict)} |`;
  });
  return ['| target | size | ceiling | change |', '| --- | --- | --- | --- |', ...rows];
}

/** Why each target that could not be measured was not, and that it blocks nothing. */
export function neutralLines(verdicts: readonly TargetVerdict[]): string[] {
  return verdicts
    .filter(({ verdict }) => verdict === 'neutral')
    .map(({ target, error }) => `Not measured: ${targetLabel(target)} — ${error ?? 'unknown'}. A measurement that fails never blocks a merge.`);
}
