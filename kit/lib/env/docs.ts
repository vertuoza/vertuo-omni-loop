/**
 * **The docs check's readers** (PRD 1059, ADR-0057): every list of environment variables a person
 * reads names exactly the variables the runtime's env module reads (its `VARIABLES`), both ways. Each
 * runtime's `env-docs` test runs it on its own docs, so no file imports two runtimes' modules.
 *
 * - An `.env.example`: every `NAME=` line.
 * - A README: the backticked names (`SUPABASE_URL`) between `<!-- omni:env-variables -->` and
 *   `<!-- /omni:env-variables -->`. One marked section per README; names outside it are prose.
 *
 * What a module reads beyond its groups is named in the module, never here: the values the platform
 * sets (`PLATFORM_VARIABLES`) are listed nowhere, and the ones an SDK reads itself (`SDK_VARIABLES`)
 * are set by a person, so a README lists them too.
 */

/** The comment that opens a README's list. */
const LIST_OPEN = '<!-- omni:env-variables -->';
/** The comment that closes it. */
const LIST_CLOSE = '<!-- /omni:env-variables -->';

/** An environment variable's name, as a list writes it between backticks. */
const NAME = /`([A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+)`/g;

/** Every variable an `.env.example` sets: a `NAME=` line, comments and blank lines aside. */
export function envExampleNames(file: string): string[] {
  return file.split('\n').flatMap((line) => /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1] ?? []);
}

/** The backticked names in a README's one marked section; a README without exactly one throws. */
export function readmeNames(file: string): string[] {
  const sections = file.split(LIST_OPEN).slice(1);
  const [section] = sections;
  if (sections.length !== 1 || section === undefined || !section.includes(LIST_CLOSE)) {
    throw new Error(`a README holds one ${LIST_OPEN} section, closed by ${LIST_CLOSE}`);
  }
  const body = section.slice(0, section.indexOf(LIST_CLOSE));
  return [...new Set([...body.matchAll(NAME)].flatMap((match) => match[1] ?? []))];
}

/** What a list misses (`unlisted`: read, not listed) and what it names wrongly (`unread`: listed, not read). */
export function listDifference(read: readonly string[], listed: readonly string[]): { unlisted: string[]; unread: string[] } {
  return { unlisted: read.filter((name) => !listed.includes(name)), unread: listed.filter((name) => !read.includes(name)) };
}
