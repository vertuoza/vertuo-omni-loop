// A mission read from its page and written as plain files (PRD 3194, s2), for `omni mission get <n>`:
// `mission.md` (its record), `mission.html` (its brief), each retro as `retros/<k>-<milestone>.md` and each
// retro item under `outbox/`, exactly as the page holds them; and, for each product PRD the fleet's Architect
// escalated with open points its PM has yet to answer, `open-points/<key>-<n>.md` (bug #3286), which the PM's
// plan job reads. The app's reply in, the files out; nothing
// is committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MISSION_PAGE, MISSION_RECORD, parseBrief } from './brief.ts';
import { field } from '../ask/schema.ts';
import { ProductPrdIdSchema, type IssueNumber, type ProductPrdId } from '../ids.ts';

/** A mission as the page holds it: its two files, its retros each with its items. */
export type MissionExport = {
  record: string;
  brief: string;
  retros: Array<{ k: number; milestone: string; content: string; items: Array<{ name: string; content: string }> }>;
  /** The Architect's open points the PM has yet to answer, per product PRD (bug #3286); none from a page that names none. */
  open: Array<{ prd: ProductPrdId; plan: string; points: string[] }>;
};

const isText = (value: unknown): value is string => typeof value === 'string';
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
/** A file name made of the page's own words: no folder part, nothing hidden. */
const safe = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '') || 'item';

/** The page's reply read as a mission, or null when it does not hold the two files. */
export function readExport(reply: unknown): MissionExport | null {
  const record = field(reply, 'record');
  const brief = field(reply, 'brief');
  if (!isText(record) || !isText(brief)) return null;
  const retros = list(field(reply, 'retros')).flatMap((retro, index) => {
    const content = field(retro, 'content');
    if (!isText(content)) return [];
    const k = field(retro, 'k');
    const milestone = field(retro, 'milestone');
    const items = list(field(retro, 'items')).flatMap((item, at) => {
      const text = field(item, 'content');
      const name = field(item, 'name');
      return isText(text) ? [{ name: isText(name) && name ? name : `item-${String(at + 1)}.md`, content: text }] : [];
    });
    return [{ k: typeof k === 'number' ? k : index + 1, milestone: isText(milestone) && milestone ? milestone : 'retro', content, items }];
  });
  return { record, brief, retros, open: openOf(reply) };
}

/** The reply's open points: each entry naming a product PRD, its plan version and its points as text; anything else left out. */
function openOf(reply: unknown): MissionExport['open'] {
  return list(field(reply, 'open')).flatMap((one) => {
    const prd = ProductPrdIdSchema.safeParse(field(one, 'prd'));
    const plan = field(one, 'plan');
    const points = list(field(one, 'points')).filter(isText);
    return prd.success && isText(plan) && points.length > 0 ? [{ prd: prd.data, plan, points }] : [];
  });
}

/** One product PRD's open points as the file the PM reads. */
const openFile = ({ prd, plan, points }: MissionExport['open'][number]): string =>
  `# The Architect's open points on PRD ${prd}\n\nplan version: ${plan}\n\n${points.map((point) => `- ${point}`).join('\n')}\n`;

/** The mission's folder name, `<nnnn>-<slug>`, from its number and its title. */
export function folderName(mission: IssueNumber, record: string): string {
  const parsed = parseBrief(record);
  const title = parsed.ok ? parsed.brief.title : '';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '') || 'mission';
  return `${String(mission).padStart(4, '0')}-${slug}`;
}

/** Writes `read` under `dir`; returns the files written, relative to it. */
export function writeExport(dir: string, read: MissionExport): string[] {
  const files: Array<[string, string]> = [[MISSION_RECORD, read.record], [MISSION_PAGE, read.brief]];
  for (const retro of read.retros) {
    const base = `${String(retro.k)}-${safe(retro.milestone)}`;
    files.push([`retros/${base}.md`, retro.content]);
    for (const item of retro.items) files.push([`outbox/${base}-${safe(item.name)}`, item.content]);
  }
  for (const one of read.open) files.push([`open-points/${one.prd}.md`, openFile(one)]);
  for (const [name, content] of files) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return files.map(([name]) => name);
}
