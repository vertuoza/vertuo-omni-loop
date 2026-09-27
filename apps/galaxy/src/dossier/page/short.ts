// The short address of a PRD's questions (PRD 251, "The Outbox tab"): /prd/at/<owner>/<repo>/<n>, which
// the kit's outbox comment writes knowing only the repository and the PRD. It redirects to the
// dossier's Outbox tab, found by PRD 216's key among the dossiers the viewer may read, or answers not
// found — a dossier of another workspace reads exactly like one that never was.

/** A PRD of a repository, as the short address names it. */
export type ShortKey = { owner: string; repo: string; prd: number };

const NAME = /^[\w.-]{1,100}$/;
const PRD = /^[1-9]\d{0,8}$/;

const decode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return '';
  }
};

/** The key an address names, or null when it names none. */
export function readShort({ owner, repo, n }: { owner: string; repo: string; n: string }): ShortKey | null {
  const [o, r] = [decode(owner), decode(repo)];
  const named = (part: string) => NAME.test(part) && part !== '.' && part !== '..';
  if (!named(o) || !named(r) || !PRD.test(n)) return null;
  return { owner: o, repo: r, prd: Number(n) };
}

/** The repository as a dossier keeps it: owner/name, in lower case. */
export const shortRepo = (key: ShortKey) => `${key.owner}/${key.repo}`.toLowerCase();

export const shortPath = (key: ShortKey) =>
  `/prd/at/${encodeURIComponent(key.owner)}/${encodeURIComponent(key.repo)}/${key.prd}`;

/** Where Google sends the person back after signing in on the short address. */
export const shortCallbackPath = (key: ShortKey) => `${shortPath(key)}/callback`;
