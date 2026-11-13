// The `## Still open` section of a bug record (PRD 2739): one `- ` bullet per point the fix saw and did
// not fix. Each bullet must have a follow-up file (`../follow-ups/follow-ups.ts`) of the record's source
// and the same text (whitespace collapsed); a section that is missing, empty or the one line `none` passes.
import { join } from 'node:path';
import { FOLLOW_UPS_DIR, readFollowUps } from '../follow-ups/follow-ups.ts';

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The bullets of a `## Still open` body, one text each (continuation lines joined); `[]` for `none` or nothing. */
export function stillOpenBullets(body: string | undefined): string[] {
  if (body === undefined) return [];
  const bullets: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet !== null) bullets.push(bullet[1] ?? '');
    else if (line.trim() !== '' && bullets.length > 0 && /^\s/.test(line)) bullets[bullets.length - 1] = `${bullets.at(-1) ?? ''} ${line.trim()}`;
  }
  return bullets.map(collapse).filter((bullet) => bullet !== '' && bullet.toLowerCase() !== 'none');
}

/** `'` made safe inside a single-quoted shell word. */
const quoted = (text: string): string => text.replace(/'/g, "'\\''");

/**
 * One line per bullet of `body` that has no follow-up file of `source` in `<deliveryDir>/follow-ups/`.
 * `deliveryDir` is the absolute `paths.delivery` of the checkout the check runs in.
 */
export function stillOpenViolations({ record, body, source, deliveryDir }: {
  record: string;
  body: string | undefined;
  source: string;
  deliveryDir: string;
}): string[] {
  const bullets = stillOpenBullets(body);
  if (bullets.length === 0) return [];
  const points = readFollowUps(join(deliveryDir, FOLLOW_UPS_DIR)).filter((point) => point.source === source);
  return bullets
    .filter((bullet) => !points.some((point) => collapse(point.text) === bullet))
    .map((bullet) => `${record}: "${bullet}" is still open but has no follow-up: omni follow-up add --source '${source}' --text '${quoted(bullet)}'`);
}
