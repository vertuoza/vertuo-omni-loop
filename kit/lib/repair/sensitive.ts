/**
 * **What must never go public** (PRD 2980, spec "3. An Omni Loop bug is reported, scrubbed").
 *
 * The shapes a repair's words may hold that name a workspace or its people (a path, a repository name, a login, an email, a URL)
 * or open its doors (a token-shaped string). `scrub()` removes each one it can name, and refuses a message where
 * {@link sensitiveShape} still finds one; a retro refuses a credential in clear (L-GDPR-2).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { MASK, maskSecrets } from '../openrouter.ts';

/** A shape and what it becomes in the public words. */
type Removal = readonly [name: string, shape: RegExp, replacement: string];

/** A file name with one of these extensions is a path, even with no folder before it. */
const FILE_EXTENSIONS = 'ts|tsx|mts|cts|js|jsx|mjs|cjs|json|jsonc|md|mdx|ya?ml|sql|sh|py|rb|go|rs|java|kt|php|cs|css|scss|html?|txt|lock|toml|env|log|csv|xml';

/**
 * The shapes a message is scrubbed of, in order: a URL before the path inside it, an email before the login inside it, a
 * key's value before the path it may look like.
 */
export const REMOVALS: readonly Removal[] = [
  ['an email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>'],
  ['a URL', /\b[a-z][a-z0-9+.-]*:\/\/\S+|\bwww\.\S+/gi, '<url>'],
  ['a secret', /\b(password|passwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi, '$1 <token>'],
  ['a path', /[A-Za-z]:\\\S+/g, '<path>'],
  ['a path', /(?<![\w>])(?:~|\.{1,2})?\/[^\s'"`()[\]{},;]+/g, '<path>'],
  ['a path', /\b[\w.@-]+(?:\/[\w.@-]+)+/g, '<path>'],
  ['a path', new RegExp(`\\b[\\w-]+(?:\\.[\\w-]+)*\\.(?:${FILE_EXTENSIONS})\\b`, 'gi'), '<path>'],
  ['a login', /(?<![\w.<])@[A-Za-z0-9][A-Za-z0-9-]{0,38}/g, '<login>'],
  ['an id', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  ['a hash', /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/gi, '<hash>'],
];

/** The shortest run of letters and digits that reads as a token when it mixes cases and digits. */
const TOKEN_MIXED = 20;
/** The shortest run that reads as a token with letters and digits in one case. */
const TOKEN_LONG = 32;

/**
 * Whether one run of token characters reads as a key: mixed case with digits, or a long stretch of letters and digits in one
 * case, never plain hex. A slug's dashes split it, so `omni-loop-repair-2980` reads as words.
 */
function isTokenRun(run: string): boolean {
  if (!/\d/.test(run)) return false;
  if (run.length >= TOKEN_MIXED && /[a-z]/.test(run) && /[A-Z]/.test(run)) return true;
  return run.split(/[-_]/).some((part) => part.length >= TOKEN_LONG && /[a-z]/i.test(part) && !/^[0-9a-f]+$/i.test(part));
}

/** Whether `text` holds a token-shaped string: a known credential's shape, or a run that reads as a key. */
export function holdsToken(text: string): boolean {
  if (maskSecrets(text) !== text) return true;
  const runs = text.match(/[A-Za-z0-9+=_-]+/g) ?? [];
  return runs.some(isTokenRun);
}

/** `text` with every known credential shape replaced by `<token>`. */
export const maskTokens = (text: string): string => maskSecrets(text).replaceAll(MASK, '<token>');

/** The first shape `text` still holds that must never go public, named for a person; null when it holds none. */
export function sensitiveShape(text: string): string | null {
  if (holdsToken(text)) return 'a token-shaped string';
  for (const [name, shape] of REMOVALS) {
    if (name === 'a hash' || name === 'an id') continue;
    if (new RegExp(shape.source, shape.flags.replace('g', '')).test(text)) return name;
  }
  return null;
}
