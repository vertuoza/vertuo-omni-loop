// The excerpts of a fact sheet, left out of its saved step and put back when it is read (#2780). An excerpt is
// the text a kind keeps beside a fact or a piece of evidence: the last lines of a red CI run's log, which the ci
// kind keeps on the red run and on every finding citing it. Each one is a copy of what a "gather-<kind>" step
// already saved, so the step "facts" saves the sheet without them: a delivery red again and again would
// otherwise save each log tail several times over, past the ledger's 1 MB a step. Every number stays saved.
//
// `withExcerptsOf` puts them back from the same sheet made again from the saved records (`detect` is pure): an
// item of the saved sheet gets the excerpt of the item of the new sheet it equals, its excerpt aside, whatever
// the order of its keys (the ledger saves JSON as Postgres's jsonb, which reorders them). An item the new sheet
// no longer holds, after a deploy changed what a kind detects, keeps no excerpt: the judge reads less of that
// log, and no number changes. Pure.
import { asSaved } from '../saved-step.ts';

const EXCERPT = 'excerpt';

/** `value` with every `excerpt`, at any depth, left out. */
export function withoutExcerpts(value: unknown): unknown {
  return strip(value);
}

/** `saved` with each excerpt of `fresh` put back on the item it was taken from: the item equal to it, its excerpt aside. */
export function withExcerptsOf(saved: unknown, fresh: unknown): unknown {
  const excerpts = excerptsIn(asSaved(fresh));
  return excerpts.size === 0 ? saved : putBack(saved, excerpts);
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== EXCERPT)
      .map(([key, item]) => [key, strip(item)]),
  );
}

/** Each excerpt of `value`, by the item it is on, that item's excerpts left out. */
function excerptsIn(value: unknown, found = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value)) for (const item of value) excerptsIn(item, found);
  else if (isObject(value)) {
    const excerpt = value[EXCERPT];
    if (typeof excerpt === 'string' && excerpt !== '') found.set(keyOf(strip(value)), excerpt);
    for (const item of Object.values(value)) excerptsIn(item, found);
  }
  return found;
}

function putBack(value: unknown, excerpts: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => putBack(item, excerpts));
  if (!isObject(value)) return value;
  const out = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, putBack(item, excerpts)]));
  if (EXCERPT in value) return out;
  const excerpt = excerpts.get(keyOf(strip(value)));
  return excerpt === undefined ? out : { ...out, [EXCERPT]: excerpt };
}

/** A value as JSON, each object's keys in order: two values equal whatever the order the ledger gave their keys. */
function keyOf(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(keyOf).join(',')}]`;
  if (isObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${keyOf(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
