// @ts-nocheck
// What churn leaves out (PRD 72, "The facts, and what makes a finding"): the paths a repository marks
// `linguist-generated` in its `.gitattributes` at the merge, lockfiles by name, and the delivery
// folder (`paths.delivery`). A generated file or a lockfile is rewritten whole by a tool, so its lines
// say nothing of how the code was written; the delivery folder is the loop's own record, where an
// outbox note is raised, rewritten and settled by design.
// Pure: the `.gitattributes` text is read by the kind's `gather`.

/** Lockfiles, by file name, at any depth: written by a package manager, never by hand. */
export const LOCKFILES = Object.freeze([
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'deno.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'pdm.lock',
  'go.sum',
  'mix.lock',
  'pubspec.lock',
  'Podfile.lock',
  'Package.resolved',
  'packages.lock.json',
  'flake.lock',
  'gradle.lockfile',
]);

const LOCKFILE_NAMES = new Set(LOCKFILES);

/** Whether `path` names a lockfile. */
export function isLockfile(path) {
  return LOCKFILE_NAMES.has(path.slice(path.lastIndexOf('/') + 1));
}

/**
 * Whether a path is `linguist-generated` by the root `.gitattributes`: its last line whose pattern
 * matches the path and which sets or unsets the attribute decides, as git reads it.
 * @param {string | null} gitattributes  the file's text, or `null` when the repository has none
 * @returns {(path: string) => boolean}
 */
export function linguistGenerated(gitattributes) {
  const rules = [];
  for (const raw of (gitattributes ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...attributes] = line.split(/\s+/);
    let generated;
    for (const attribute of attributes) {
      if (attribute === 'linguist-generated' || attribute === 'linguist-generated=true') generated = true;
      else if (['-linguist-generated', '!linguist-generated', 'linguist-generated=false'].includes(attribute)) generated = false;
    }
    // Git never matches a pattern ending in a slash to a file in an attributes file.
    if (generated === undefined || pattern.endsWith('/')) continue;
    rules.push({ matches: globToRegExp(pattern), generated });
  }
  return (path) => rules.reduce((generated, rule) => (rule.matches.test(path) ? rule.generated : generated), false);
}

/**
 * Why churn leaves a path out: `generated`, `lockfile`, `delivery`, or `null` when it counts.
 * @param {string | null} gitattributes
 * @param {{ delivery?: string | null }} [paths]  the config's `paths.delivery`, when there is one
 * @returns {(path: string) => 'generated' | 'lockfile' | 'delivery' | null}
 */
export function leftOutAs(gitattributes, { delivery = null } = {}) {
  const generated = linguistGenerated(gitattributes);
  const inDelivery = delivery ? (path) => path.startsWith(`${delivery.replace(/\/+$/, '')}/`) : () => false;
  return (path) => (generated(path) ? 'generated' : isLockfile(path) ? 'lockfile' : inDelivery(path) ? 'delivery' : null);
}

/**
 * A gitattributes pattern as a regular expression over a repository-relative path. A pattern with a
 * slash at its start or in its middle is read from the root; one without, at any depth.
 */
function globToRegExp(glob) {
  const anchored = glob.includes('/');
  const pattern = glob.startsWith('/') ? glob.slice(1) : glob;
  let source = '';
  let i = 0;
  while (i < pattern.length) {
    const rest = pattern.slice(i);
    if (i === 0 && rest.startsWith('**/')) {
      source += '(?:.*/)?';
      i += 3;
    } else if (rest.startsWith('/**/')) {
      source += '/(?:.*/)?';
      i += 4;
    } else if (rest === '/**') {
      source += '/.*';
      i += 3;
    } else if (rest.startsWith('**')) {
      source += '[^/]*';
      i += 2;
    } else if (rest[0] === '*') {
      source += '[^/]*';
      i += 1;
    } else if (rest[0] === '?') {
      source += '[^/]';
      i += 1;
    } else if (rest[0] === '[' && rest.indexOf(']', 2) !== -1) {
      const end = rest.indexOf(']', 2);
      const body = rest.slice(1, end).replace(/^[!^]/, '^').replace(/\\/g, '\\\\');
      source += `[${body}]`;
      i += end + 1;
    } else if (rest[0] === '\\' && rest.length > 1) {
      source += escape(rest[1]);
      i += 2;
    } else {
      source += escape(rest[0]);
      i += 1;
    }
  }
  return new RegExp(`${anchored ? '^' : '(?:^|/)'}${source}$`);
}

function escape(character) {
  return character.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
