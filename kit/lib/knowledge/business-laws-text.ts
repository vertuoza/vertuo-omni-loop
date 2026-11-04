// What `omni kb business-laws` prints (PRD 2632): each law on one line with its domains, its Why under
// it; with `--domain`, those of one domain; with `--spec`, what a spec is judged against and why each
// domain was taken.
import { businessLawDomains, type BusinessLaw, type BusinessLawSelection } from './business-laws.ts';

/** One law as two lines: its id, statement and domains (`product` for a `product/` law), then its Why. */
function businessLawLines(law: BusinessLaw): string[] {
  const domains = law.scope === 'product' ? ['product'] : businessLawDomains(law);
  return [`${law.id} — ${law.statement} (${domains.join(', ')})`, `  Why: ${law.why ?? '(none written)'}`];
}

/** The laws of one domain, by folder or `Also:`; `product` names the `product/` laws. */
export function lawsOfDomain(laws: readonly BusinessLaw[], key: string): BusinessLaw[] {
  return laws.filter((law) => (key === 'product' ? law.scope === 'product' : businessLawDomains(law).includes(key)));
}

/** `omni kb business-laws [--domain <key>]` as text. */
export function businessLawsText(laws: readonly BusinessLaw[], { domain, knowledgeRoot }: { domain: string | null; knowledgeRoot: string }): string {
  if (laws.length === 0) {
    return domain === null
      ? `kb business-laws — no business law yet: write one in ${knowledgeRoot}/domains/<key>/business-laws.md or ${knowledgeRoot}/product/business-laws.md.`
      : `kb business-laws — no business law in ${domain}.`;
  }
  const where = domain === null ? '' : ` in ${domain}`;
  return [`kb business-laws — ${laws.length} business law(s)${where}`, ...laws.flatMap(businessLawLines)].join('\n');
}

/** `omni kb business-laws --spec <file>` as text: the count, the domains taken and why, the glossary's absence, then each law. */
export function selectionText(selection: BusinessLawSelection, { spec, glossaryRead }: { spec: string; glossaryRead: boolean }): string {
  const domains = selection.domains.map(({ key, reasons }) => `${key} ← ${reasons.join(', ')}`);
  return [
    `kb business-laws — ${spec} is judged against ${selection.laws.length} business law(s)`,
    `Domains: ${domains.length === 0 ? 'none taken' : domains.join('; ')}`,
    ...(glossaryRead ? [] : ['glossary: no local copy, so no term was read — omni kb glossary reads it']),
    ...selection.laws.flatMap(businessLawLines),
  ].join('\n');
}
