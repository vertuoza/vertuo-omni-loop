// A mission's page, `mission.html` (PRD 2842, s2), keeps the before/after page rules a dossier's page
// keeps: self-contained, at most 512 KiB, and nothing loaded from the network (a link a person follows
// is none). `omni mission push` sends nothing while it breaks one.
import { networkLoads } from '../concept/verdict.ts';

/** The largest page the app takes (a dossier version's cap). */
export const PAGE_MAX_BYTES = 512 * 1024;

/** What `mission.html` breaks of the page rules, each one line naming `file`: nothing when it keeps them. */
export function pageFaults(file: string, html: string): string[] {
  const faults: string[] = [];
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > PAGE_MAX_BYTES) faults.push(`${file}: ${bytes} bytes, over the ${PAGE_MAX_BYTES / 1024} KiB a page holds.`);
  const loads = networkLoads(html);
  if (loads.length) faults.push(`${file}: loads from the network: ${loads.join(', ')}; inline it, and keep only links a person follows.`);
  return faults;
}
