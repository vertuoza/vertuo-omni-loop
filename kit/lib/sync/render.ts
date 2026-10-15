// The block `omni sync` prints (PRD 1990, spec sections 1 and 3), drawn from a run's record alone,
// so that `omni session start` can print the same block from the cache.
//
//   🟠 Needs action · repo kit v0.0.418, latest v0.0.423
//     main       🟢 on main, 2 behind (the oldest 3 h old)
//     kit        🟠 repo kit v0.0.418, latest v0.0.423 → omni sync --fix
//     knowledge  🟢 in sync
//     page       🟢 signed in · synced 5 min ago
//   fix: omni sync --fix  (fast-forwards main, updates the plugins, opens the kit's update PR)
//
// A check prints its findings that are not green, each on its own line, or its green one when it has
// nothing else to say; a check whose level is `off` prints `off`. While a newcomer sets up, the four
// steps print in place of the checks: a done one with `✓`, an open one with its fix.
import type { SyncFinding, SyncRecord } from './schema.ts';

const DOTS: Record<SyncRecord['status'], string> = { blue: '🔵', red: '🔴', orange: '🟠', green: '🟢' };
const WORDS: Record<Exclude<SyncRecord['status'], 'blue'>, string> = { red: 'Out of sync', orange: 'Needs action', green: 'In sync' };
/** The widest check's name, `knowledge`: each check's findings start in the same column. */
const CHECK_WIDTH = 'knowledge'.length;
const OFF = 'off';

/** The status line: its dot, its words and, but for green, its headline. */
function statusLine(record: SyncRecord): string {
  if (record.status === 'blue') return `${DOTS.blue} Setting up · ${record.setup?.done ?? 0} of ${record.setup?.steps.length ?? 0}`;
  const words = `${DOTS[record.status]} ${WORDS[record.status]}`;
  return record.headline ? `${words} · ${record.headline}` : words;
}

/** One finding: its dot, its words and, when it has one, its fix. */
const findingText = ({ severity, text, fix }: SyncFinding): string => `${DOTS[severity]} ${text}${fix ? ` → ${fix}` : ''}`;

/** A check's lines: its name, then each finding it shows. */
function checkLines(check: string, findings: readonly SyncFinding[]): string[] {
  const off = findings.length === 1 && findings[0]?.text === OFF && findings[0].severity === 'green';
  const open = findings.filter(({ severity }) => severity !== 'green');
  const texts = off ? [OFF] : (open.length > 0 ? open : findings).map(findingText);
  return texts.map((text, index) => `  ${(index === 0 ? check : '').padEnd(CHECK_WIDTH)}  ${text}`);
}

/** The lines `omni sync` prints for `record`. */
export function syncLines(record: SyncRecord): string[] {
  if (record.status === 'blue') {
    const steps = record.setup?.steps ?? [];
    return [statusLine(record), ...steps.map(({ done, text, fix }) => (done ? `  ✓ ${text}` : `  · ${text}${fix ? ` → ${fix}` : ''}`))];
  }
  const checks = [...new Set(record.findings.map(({ check }) => check))];
  const lines = checks.flatMap((check) => checkLines(check, record.findings.filter((finding) => finding.check === check)));
  return [statusLine(record), ...lines, ...(record.fix ? [`fix: ${record.fix}`] : [])];
}
