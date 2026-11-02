import Link from 'next/link';
import type { FoundDomains } from './found-domains';
import { itemHref } from './knowledge-sections';
import { Section } from './KnowledgeLists';
import { AdoptFolder, type TabSource } from './KnowledgeTabPage';

// The Domains section's Not on the list region (PRD 2583 s3): the folders of the product's repositories that
// its list does not hold, each with the repositories holding it and one action to add it (a proposal for a
// member who does not decide). Nothing blocks: this only shows. A folder that cannot be a key says so and
// offers nothing; a retired domain still in a repository says where; a repository with no pack yet is
// `not read yet` and adds nothing to the count; with nothing to show, the region is absent. Drawn on the server, only the action is a client component.

const NOT_ON_LIST = 'Not on the list';
export const UNREAD = 'The repositories’ knowledge could not be read. Try again in a moment.';
export const CANNOT_BE_KEY = 'Cannot be a key: rename the folder';

const LEDE = 'Folders under domains/ in the product’s repositories that the list above does not hold. Nothing fails because of them: add one to the list, or leave it.';

const retiredLine = (repositories: readonly string[]): string => `retired, still in ${repositories.join(', ')}`;

export function NotOnList({ product, source, decides, found }: { product: string; source: TabSource; decides: boolean; found: FoundDomains | null }) {
  if (found === null) return <Section id="not-on-list-title" title={NOT_ON_LIST} lede={LEDE}><p className="products-empty" role="alert">{UNREAD}</p></Section>;
  if (found.off.length === 0 && found.retired.length === 0 && found.notRead.length === 0) return null;
  return (
    <Section id="not-on-list-title" title={found.off.length > 0 ? `${NOT_ON_LIST} · ${found.off.length}` : NOT_ON_LIST} lede={LEDE}>
      {found.off.length + found.retired.length > 0 && (
        <ul className="links-list" data-not-on-list>
          {found.off.map((row) => (
            <li key={row.name} className="links-row" data-folder={row.name}>
              <span>{row.name} · {row.repositories.join(', ')}</span>
              {row.canBeKey ? <AdoptFolder product={product} source={source} row={row} decides={decides} /> : <span className="ask-muted">{CANNOT_BE_KEY}</span>}
            </li>
          ))}
          {found.retired.map((row) => (
            <li key={row.key} className="links-row" data-folder={row.key} data-retired>
              <span><Link href={itemHref(product, 'domains', row.key)}>{row.key}</Link> · <span className="ask-muted">{retiredLine(row.repositories)}</span></span>
            </li>
          ))}
        </ul>
      )}
      {found.notRead.length > 0 && (
        <ul className="links-list" data-not-read>
          {found.notRead.map((repository) => (
            <li key={repository} className="links-row" data-repository={repository}>
              <span>{repository} · <span className="ask-muted">not read yet</span></span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
