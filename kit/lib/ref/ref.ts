// The external reference an issue carries (PRD 2648): the first valid `<!-- omni-ref: <ref> -->`
// marker of its body, and the title and link a repository's `pr.ref` format makes of it. Pure: the
// `omni ref` verb reads the issue and prints what these return.

/** What `pr.ref` declares: `title` holds `{ref}` and `{title}`, `none` (no marker) holds `{title}`, `link` holds `{ref}`. */
export type RefFormat = { title: string; none: string | null; link: string | null };

const MARKER = /<!--[ \t]*omni-ref:[ \t]*([A-Za-z0-9._-]{1,64})[ \t]*-->/;

/** The first valid marker's ref in an issue body; `null` when there is none. A marker of another shape is skipped. */
export function readRef(body: string): string | null {
  return MARKER.exec(body)?.[1] ?? null;
}

function filled(template: string, ref: string | null): string {
  return ref === null ? template : template.replaceAll('{ref}', ref);
}

/** Whether `title` already reads as `template` (its `{ref}` filled with `ref` when given): the same text around `{title}`. */
function reads(template: string, title: string, ref: string | null): boolean {
  const text = filled(template, ref);
  const at = text.indexOf('{title}');
  const prefix = text.slice(0, at);
  const suffix = text.slice(at + '{title}'.length);
  return title.length > prefix.length + suffix.length && title.startsWith(prefix) && title.endsWith(suffix);
}

function apply(template: string, title: string, ref: string | null): string {
  return filled(template, ref).replace('{title}', () => title);
}

/** The title a pull request carries for `ref` (or none) under `format`; unchanged when it already reads so. */
export function formatTitle(format: RefFormat | null, ref: string | null, title: string): string {
  if (format === null) return title;
  if (ref === null) {
    if (format.none === null || reads(format.none, title, null)) return title;
    return apply(format.none, title, null);
  }
  if (reads(format.title, title, ref) || (format.none !== null && reads(format.none, title, null))) return title;
  return apply(format.title, title, ref);
}

/** The link for `ref` under `format`; `null` when there is no format, no ref or no `link`. */
export function formatLink(format: RefFormat | null, ref: string | null): string | null {
  if (format === null || format.link === null || ref === null) return null;
  return format.link.replaceAll('{ref}', ref);
}
