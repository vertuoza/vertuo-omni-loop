import Link from 'next/link';
import type { BusinessLaw } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import type { Query } from '../nav/query';
import {
  LAWS_NONE_TEXT, NO_BUSINESS_LAWS, domainsOfLaw, lawDomainFilterOf, lawFileHref, lawsOfDomain, ownersLine, type LawsRead,
} from './business-laws-section';
import { itemHref, sectionHref } from './knowledge-sections';
import { Section } from './KnowledgeLists';
import type { KnowledgeTab } from './product-knowledge.contract';

// The Business laws section of the Knowledge home and a domain's list of them (PRD 2632 s6): read-only, each law's
// statement, Why, domains and owner, a link to its file on GitHub, filtered by ?domain=<key>. There is no
// edit control anywhere: a law changes in its file, through a pull request its owner approves.

type ReadLaws = Extract<LawsRead, { state: 'read' }>;

/** The laws as a table: statement, Why, domains, owner and a link to the file. */
function LawsTable({ product, read, laws }: { product: string; read: ReadLaws; laws: readonly BusinessLaw[] }) {
  return (
    <div className="kn-scroll">
      <table className="kn-table">
        <thead>
          <tr><th scope="col">Law</th><th scope="col">Statement</th><th scope="col">Why</th><th scope="col">Domains</th><th scope="col">Owner</th></tr>
        </thead>
        <tbody>
          {laws.map((law) => {
            const domains = domainsOfLaw(law);
            return (
              <tr key={`${law.file}#${law.id}`} data-law={law.id}>
                <th scope="row"><a href={lawFileHref(read.home, read.sha, law.file)} rel="noreferrer">{law.id}</a></th>
                <td className="kn-text">{law.statement}</td>
                <td className="kn-text">{law.why ?? '—'}</td>
                <td className="kn-text" data-domains>
                  {domains.length === 0 ? 'Everywhere' : domains.map((key, i) => (
                    <span key={key}>
                      {i > 0 && ', '}
                      <Link href={itemHref(product, 'domains', key)}>{key}</Link>
                    </span>
                  ))}
                </td>
                <td>{ownersLine(read.owners)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Laws({ product, read, domain, path }: { product: string; read: ReadLaws; domain: string | null; path: string }) {
  const laws = lawsOfDomain(read.laws, domain);
  return (
    <>
      <p className="ask-muted">
        Read from <a href={`https://github.com/${read.home}`} rel="noreferrer">{read.home}</a>, at its newest merged commit.
        {domain !== null && <span data-domain-filter={domain}> Laws of {domain} · <Link href={path}>All domains</Link></span>}
      </p>
      {laws.length === 0
        ? <p className="products-empty">{domain === null ? NO_BUSINESS_LAWS : `No business law names ${domain}.`}</p>
        : <LawsTable product={product} read={read} laws={laws} />}
    </>
  );
}

/** The section's page, once the laws were read. */
export function BusinessLawsSection({ tab, read, query }: { tab: KnowledgeTab; read: LawsRead; query: Query }) {
  const product = tab.product.id;
  const path = sectionHref(product, 'business-laws');
  const domain = lawDomainFilterOf(query);
  return (
    <Section
      id="business-laws-title" title="Business laws"
      lede="The rules of the product, each with the reason it exists. Every repository of the product is judged by the same ones, and they change in their file, through a pull request their owner approves."
    >
      {read.state === 'none'
        ? <p className="products-empty" data-laws-none={read.why}>{LAWS_NONE_TEXT[read.why]}</p>
        : <Laws product={product} read={read} domain={domain} path={path} />}
    </Section>
  );
}

/** A domain's page lists the laws of that domain; says why when there are none to read. */
export function DomainLaws({ product, domain, read }: { product: string; domain: string; read: LawsRead }) {
  if (read.state === 'none') return <p className="ask-muted" data-laws-none={read.why}>{LAWS_NONE_TEXT[read.why]}</p>;
  const laws = lawsOfDomain(read.laws, domain);
  return laws.length === 0 ? <p className="ask-muted">{NO_BUSINESS_LAWS}</p> : <LawsTable product={product} read={read} laws={laws} />;
}
