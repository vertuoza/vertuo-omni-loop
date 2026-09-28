// Which PRD the session works on (PRD 324's spec, "Which PRD"): pure. The session's branch is read
// against the config's branch templates, `branches.slice` first, then `branches.feature`, then
// `branches.phase0`; the first template that reads the branch decides. In a template, `{topic}` is
// one or more characters (the shortest that matches) and `{slice}` one or more characters other
// than `/`, so `feat/x--s1` is the slice `s1` of `x`, never a feature named `x--s1`.
//
// The topic names the PRD whose folder is `<nnnn>-<topic>` among the folders the caller found (under
// the delivery folder's inbox and shipped folders, in the session's checkout or on the base). A
// branch no template reads, or whose topic has no folder, names no PRD: `whichPrd` returns `null`,
// and the caller may look elsewhere (what the session last worked on) before it reads no PRD.
import { parseFolderName } from '../layout.mjs';

const TEMPLATE_ORDER = ['slice', 'feature', 'phase0'];
const PLACEHOLDER = /\{(topic|slice)\}/g;

const escapeLiteral = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** `template` as an anchored pattern, `{topic}` and `{slice}` captured as named groups; a second
 * `{topic}` (or `{slice}`) must repeat the first. */
export function templatePattern(template) {
  const seen = new Set();
  let source = '';
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    source += escapeLiteral(template.slice(last, match.index));
    const key = match[1];
    if (seen.has(key)) source += `\\k<${key}>`;
    else source += key === 'topic' ? '(?<topic>.+?)' : '(?<slice>[^/]+)';
    seen.add(key);
    last = match.index + match[0].length;
  }
  source += escapeLiteral(template.slice(last));
  return new RegExp(`^${source}$`, 'u');
}

/** What `branch` names by the first template that reads it: `{ topic, slice }` (`slice` null but
 * on a slice branch), or `null`. A template with no `{topic}` names nothing. */
export function branchNames(branch, branches) {
  if (typeof branch !== 'string' || branch === '') return null;
  for (const key of TEMPLATE_ORDER) {
    const template = branches?.[key];
    if (typeof template !== 'string' || !template.includes('{topic}')) continue;
    const match = templatePattern(template).exec(branch);
    if (match) return { topic: match.groups.topic, slice: match.groups.slice ?? null };
  }
  return null;
}

/** The PRD folder among `folders` (names) whose topic is `topic`: `{ prd, topic, folder }`, the
 * highest PRD number when several share it, or `null`. */
export function folderOfTopic(folders, topic) {
  let found = null;
  for (const name of folders ?? []) {
    const parsed = parseFolderName(name);
    if (!parsed || parsed.topic !== topic) continue;
    if (!found || parsed.prd > found.prd) found = { prd: parsed.prd, topic, folder: name };
  }
  return found;
}

/**
 * The PRD the session's branch names: `{ prd, topic, folder, slice }`, or `null`.
 *
 * @param {{ branch: string | null, branches: object, folders: string[] }} facts the session's
 *   branch, the config's `branches`, and the PRD folder names found in the checkout or on the base
 */
export function whichPrd({ branch, branches, folders }) {
  const named = branchNames(branch, branches);
  if (!named) return null;
  const found = folderOfTopic(folders, named.topic);
  return found ? { ...found, slice: named.slice } : null;
}
