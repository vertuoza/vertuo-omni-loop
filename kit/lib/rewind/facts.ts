/**
 * What `omni rewind facts <n>` prints (PRD 2410, s5): a PRD's status on main per repository, each break
 * with its link, and the findings already on its page, read from `GET /api/rewind/facts`. Pure: the reply
 * in, lines out.
 */
import { z } from 'zod';

const Watch = z.object({ lane: z.string(), status: z.string(), merge_sha: z.string(), merged_at: z.string(), watch_until: z.string(), unread: z.array(z.string()) });
const Break = z.object({ lane: z.string(), source: z.string(), kind: z.string(), url: z.string(), title: z.string(), parent: z.string().nullable(), at: z.string() });
const Found = z.object({ check: z.string(), origin: z.string(), state: z.string(), happened: z.string(), fix: z.string(), evidence: z.array(z.string()) });

const RewindFactsSchema = z.object({ watches: z.array(Watch), breaks: z.array(Break), findings: z.array(Found) });
export type RewindFacts = z.infer<typeof RewindFactsSchema>;

/** The facts a reply holds, or null when it is not one. */
export function factsOf(reply: unknown): RewindFacts | null {
  const parsed = RewindFactsSchema.safeParse(reply);
  return parsed.success ? parsed.data : null;
}

const day = (stamp: string) => stamp.slice(0, 10);

/** The lines `omni rewind facts` prints for PRD `prd`. */
export function factLines(prd: number, facts: RewindFacts): string[] {
  if (facts.watches.length === 0) return [`PRD ${String(prd)} has no watch on main: it is not merged, or the Omni App has not opened one.`];
  const lines = [`PRD ${String(prd)} on main:`];
  for (const w of facts.watches) {
    const unread = w.unread.length > 0 ? ` · could not read: ${w.unread.join(', ')}` : '';
    lines.push(`  ${w.lane}: ${w.status} · merged ${day(w.merged_at)} (${w.merge_sha.slice(0, 7)}) · watched until ${day(w.watch_until)}${unread}`);
  }
  if (facts.breaks.length === 0) {
    lines.push('Breaks: none.');
  } else {
    lines.push('Breaks:');
    for (const b of facts.breaks) {
      const parent = b.parent === null ? '' : ` · parent ${b.parent}`;
      lines.push(`  ${b.kind} · ${b.title} · ${b.lane} · ${day(b.at)}${parent}`, `    ${b.url}`);
    }
  }
  const proposed = facts.findings.filter((f) => f.state === 'proposed').length;
  lines.push(facts.findings.length === 0 ? 'Findings: none yet.' : `Findings: ${String(facts.findings.length)} (${String(proposed)} proposed).`);
  for (const f of facts.findings) lines.push(`  ${f.check} · ${f.origin} · ${f.state}: ${f.happened.split('\n')[0] ?? ''}`);
  return lines;
}
