// What `omni check knowledge` refuses of the business laws once the product's read is in hand (PRD 2632):
// a folder or `Also:` key off the product's domain list, a statement using a word the glossary says to
// avoid, and a law in a repository that is not the law home, naming the home. The shape of each law is
// graded offline (`business-laws.ts`); these three need the Omni page, so each is a note, never a
// violation, whenever the page cannot be read (`check-knowledge-legal.ts` decides which).
import { businessLawDomains, usesWord, type BusinessLaw } from './business-laws.ts';
import type { GlossaryTerm, KnowledgeDomain } from '../product/knowledge.ts';

/** What the product's read says about the laws: its domain list, glossary and law home. */
export type BusinessLawReach = {
  repo: string;
  /** The product's active domains; `undefined` from a server that does not send them. */
  domains: readonly KnowledgeDomain[] | undefined;
  glossary: readonly GlossaryTerm[];
  /** The law home (`owner/name`); `null` or `undefined` when the product has none. */
  lawHome: string | null | undefined;
};

export type BusinessLawVerdict = { violations: string[]; notes: string[] };

/** The keys a law names off the product's list: its folder's, then each `Also:` key. */
function offList(law: BusinessLaw, listed: ReadonlySet<string>): string[] {
  return businessLawDomains(law).filter((key) => !listed.has(key));
}

/** The first glossary term whose avoid words the statement uses, as `[word, term]`. */
function avoided(law: BusinessLaw, glossary: readonly GlossaryTerm[]): [string, string][] {
  return glossary.flatMap(({ term, avoid }) => avoid.filter((word) => usesWord(law.statement, word)).map((word): [string, string] => [word, term]));
}

/** The violations and notes of `laws` against what the product's read says. */
export function verifyBusinessLaws(laws: readonly BusinessLaw[], { repo, domains, glossary, lawHome }: BusinessLawReach): BusinessLawVerdict {
  if (laws.length === 0) return { violations: [], notes: [] };
  const violations: string[] = [];
  const notes: string[] = [];
  const listed = domains === undefined ? null : new Set(domains.map(({ key }) => key));
  if (listed === null) notes.push('Business law domains not verified: the page sent no domain list');
  const home = lawHome ?? null;
  if (home === null) notes.push('Business laws not placed: the product has no law home — set its plan repository on the Omni page');
  for (const law of laws) {
    for (const key of listed === null ? [] : offList(law, listed)) {
      violations.push(`${law.file}: ${law.id} — names the domain ${key}, which is not on the product's domain list: use one of its domains, or ask a PM to add it.`);
    }
    for (const [word, term] of avoided(law, glossary)) {
      violations.push(`${law.file}: ${law.id} — uses "${word}", which the glossary says to avoid: write "${term}".`);
    }
    if (home !== null && home !== repo.toLowerCase()) {
      violations.push(`${law.file}: ${law.id} — sits in ${repo}, but the product's law home is ${home}: move it there.`);
    }
  }
  return { violations, notes };
}
