import type { BusinessLaw } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import type { Query } from '../nav/query';
import { domainFilterOf } from './knowledge-sections';

// The Business laws section of the Knowledge home (PRD 2632 s6), read-only. Pure: what the page says when
// there is nothing to list, which laws a `?domain=<key>` keeps, who owns them and where each one's file is
// on GitHub. The laws themselves are read from the law home's newest pack (business-laws-load.ts), merged
// laws only, and nothing here edits one.

/** What the page needs of a product's repositories to find its law home. */
export interface HomeRepositories {
  plan: string | null;
  repositories: readonly string[];
}

/** Where a product's laws live: its plan repository when set, else its only repository, else nowhere. */
export function lawHomeOfRepositories({ plan, repositories }: HomeRepositories): string | null {
  if (plan !== null && plan !== '') return plan.toLowerCase();
  const [only, ...others] = repositories;
  return only !== undefined && others.length === 0 ? only.toLowerCase() : null;
}

/** Why a product has no law to list. */
export type LawsNoneWhy = 'no-repository' | 'set-plan' | 'no-pack' | 'unreadable';

/** A product's laws as the section draws them: read from its law home's pack, or why there are none to read. */
export type LawsRead =
  | { state: 'read'; home: string; sha: string; laws: BusinessLaw[]; owners: string[] }
  | { state: 'none'; why: LawsNoneWhy };

/** The reason a product has no law home: several repositories and no plan repository, or no repository at all. */
export const noHomeWhy = (repositories: HomeRepositories): 'no-repository' | 'set-plan' =>
  repositories.repositories.length > 1 ? 'set-plan' : 'no-repository';

export const NO_BUSINESS_LAWS = 'No business law yet.';

/** What the section says when it has nothing to read. */
export const LAWS_NONE_TEXT: Readonly<Record<LawsNoneWhy, string>> = {
  'set-plan': 'This product has several repositories and no plan repository, so its business laws have no home. Set a plan repository in Repositories.',
  'no-repository': 'This product has no repository yet, so its business laws have no home.',
  'no-pack': 'The law home has no knowledge pack yet: its business laws show once its default branch has merged with the Omni app installed.',
  unreadable: 'The business laws could not be read just now. Try again in a moment.',
};

/** The sub-menu's count of the laws: none when they could not be read. */
export const lawCountOf = (read: LawsRead): number | null => (read.state === 'read' ? read.laws.length : null);

/** The laws `?domain=<key>` keeps: those of the domain's folder or naming it in `Also:`, and every `product/` law, which applies everywhere. */
export function lawsOfDomain(laws: readonly BusinessLaw[], key: string | null): BusinessLaw[] {
  return key === null ? [...laws] : laws.filter((law) => law.scope === 'product' || law.domain === key || law.also.includes(key));
}

/** The domain keys a law belongs to, its folder's first; `product/` laws apply to none in particular. */
export const domainsOfLaw = (law: BusinessLaw): string[] => (law.scope === 'product' ? [] : [law.domain, ...law.also.filter((key) => key !== law.domain)]);

/** The domain a section's address filters by, or null. */
export const lawDomainFilterOf = (query: Query): string | null => domainFilterOf(query);

/** A law's file on GitHub at the commit of the pack it was read from. */
export const lawFileHref = (home: string, sha: string, file: string): string =>
  `https://github.com/${home}/blob/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`;

/** A law's owner as the section writes it: `@login`, several joined; none named says so. */
export const ownersLine = (owners: readonly string[]): string => (owners.length === 0 ? 'not named (laws.owners is empty)' : owners.map((o) => `@${o}`).join(', '));
