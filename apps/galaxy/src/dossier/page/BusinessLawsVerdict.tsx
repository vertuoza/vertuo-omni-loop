import type { KeptVerdict } from '../../business-laws/verdicts.repository';
import type { LawsView } from '../../business-laws/verdicts.service';
import { AmendLaw } from './AmendLaw';

// The business laws' verdict on a ◆ PRD's spec (PRD 2632 s4), above Approve on the approve screen and under the
// seal once approved. Three faces:
//
// - red, `Business laws ✗ n`: for each finding the law's id and statement, Why it exists, the spec's words,
//   who owns it and why its domain was taken, and Ask to amend this law; Approve is off beside it (./approval.ts).
// - green, `Business laws ✓ n judged · Quotes, Invoicing`: what was judged, each domain's reason one click away.
// - not judged, `Business laws not judged`: why, and Approve stays on.
//
// A product with no law home, no law or no spec shows nothing. The law's words are those the verdict kept, so
// an old red still reads true once the law is amended.

type Domain = KeptVerdict['domains'][number];

/** A domain as a person reads it: its name, else its key. */
const nameOf = (domain: Pick<Domain, 'key' | 'name'>) => domain.name ?? domain.key;

/** `Quotes ← "Quote"`: a domain and why it was taken. */
const reasonOf = (domain: Domain) => `${nameOf(domain)} ← ${domain.reasons.join(', ')}`;

/** A reason as a sentence: its first letter up, a full stop at the end. */
const sentence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed === '') return trimmed;
  const capital = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
};

function Red({ verdict }: { verdict: KeptVerdict }) {
  const domains = new Map(verdict.domains.map((domain) => [domain.key, domain]));
  return (
    <div className="dossier-laws dossier-laws-red" role="group" aria-label="Business laws">
      <span className="dossier-laws-lab">Business laws ✗ {verdict.findings.length}</span>
      {verdict.findings.map((finding) => {
        const domain = domains.get(finding.domain);
        const hint = [
          finding.owners.length ? `Owner: ${finding.owners.map((login) => `@${login}`).join(', ')}` : null,
          domain ? reasonOf(domain) : null,
        ].filter((part): part is string => part !== null).join(' · ');
        return (
          <div key={`${finding.law}\n${finding.quote}`} className="dossier-laws-finding">
            <code className="dossier-laws-id">{finding.law}</code>
            <p data-content>{finding.statement}</p>
            {finding.why !== '' && <p><b>Why:</b> <span data-content>{finding.why}</span></p>}
            <p>The spec says: <q className="dossier-laws-quote" data-content>{finding.quote}</q></p>
            {hint !== '' && <p className="ask-hint">{hint}</p>}
            <AmendLaw id={finding.law} />
          </div>
        );
      })}
    </div>
  );
}

function Green({ verdict }: { verdict: KeptVerdict }) {
  return (
    <div className="dossier-laws dossier-laws-green" role="group" aria-label="Business laws">
      <span className="dossier-laws-lab">Business laws ✓ {verdict.laws.length} judged</span>
      {verdict.domains.length > 0
        ? (
          <details className="dossier-laws-domains">
            <summary>{verdict.domains.map(nameOf).join(', ')}</summary>
            <ul>{verdict.domains.map((domain) => <li key={domain.key}>{reasonOf(domain)}</li>)}</ul>
          </details>
        )
        : <p className="ask-hint">{verdict.laws.length === 0 ? 'No business law applies to this spec.' : 'The product’s laws, everywhere.'}</p>}
    </div>
  );
}

function NotJudged({ why }: { why: string }) {
  return (
    <div className="dossier-laws" role="group" aria-label="Business laws">
      <span className="dossier-laws-lab">Business laws not judged</span>
      <p>{sentence(why)}</p>
    </div>
  );
}

/** The verdict `laws` shows; nothing when there is none to show. */
export function BusinessLawsVerdict({ laws }: { laws: LawsView | null | undefined }) {
  if (!laws || laws.show === 'nothing') return null;
  if (laws.show === 'not-judged') return <NotJudged why={laws.why} />;
  const { verdict } = laws;
  if (verdict.state === 'red') return <Red verdict={verdict} />;
  if (verdict.state === 'green') return <Green verdict={verdict} />;
  return <NotJudged why={verdict.reason} />;
}
