'use client';
import { useRef, useState } from 'react';
import { demoKnowledgePort, knowledgeClient, type Changed, type KnowledgePort } from './product-knowledge.client';
import type {
  Fields, GlossaryEntry, GlossarySection, Kind, KnowledgeMember, KnowledgeTab, KnowledgeWrite, LegalEntry, LegalSection, Person, Proposal,
} from './product-knowledge.contract';

// The Knowledge tab in the browser (PRD 1795 s2): the product's Legal section and Glossary section, each
// naming its owner and delegate, listing its entries and its open proposals, with the controls each role
// may use. The kind's owner or delegate (`decides`) edits, retires or removes directly and approves or
// rejects proposals; any other member proposes; a workspace owner (`canName`) names the owner and the
// delegate. Every change goes through the tab's one route as the signed-in person
// (product-knowledge.client.ts); once it is saved the page reloads, so the server draws what is now true.
// In the demo, nothing is saved.

export type TabSource = { kind: 'demo' } | { kind: 'live' };

export const NO_LEGAL = 'No Legal entry yet.';
export const NO_TERMS = 'No term yet.';
const NO_OWNER = 'not named';
export const OWNERS_DECIDE = 'While none is named, the workspace’s owners decide.';

/** The page's state: whether a call runs, and the refusal or the note it left. */
interface Status {
  busy: boolean;
  message: string | null;
}

/** What a section's controls call. */
type Send = (write: KnowledgeWrite) => Promise<boolean>;

const who = (person: Person): string => (person ? `@${person.login ?? 'a member'}` : NO_OWNER);

const csv = (words: readonly string[]): string => words.join(', ');
const words = (text: string): string[] => text.split(',').map((w) => w.trim()).filter((w) => w !== '');

/** A proposal in one line: what it does, to what, by whom. */
export function proposalLine(kind: Kind, proposal: Proposal, entries: readonly (LegalEntry | GlossaryEntry)[]): string {
  const target = entries.find((e) => e.entry === proposal.entry);
  const named = target ? ('id' in target ? target.id : target.term) : null;
  const f = proposal.fields;
  const field = (key: string): string | null => (typeof f[key] === 'string' ? f[key] : null);
  const subject = named ?? field(kind === 'legal' ? 'statement' : 'term') ?? '';
  const detail = kind === 'legal' ? field('statement') : field('meaning');
  const verb = { add: 'adds', edit: 'edits', retire: 'retires', remove: 'removes' }[proposal.action] ?? proposal.action;
  const by = proposal.proposedBy ? ` · proposed by @${proposal.proposedBy.login ?? 'a member'}` : '';
  return `${verb} ${subject}${detail && named ? `: ${detail}` : ''}${by}`;
}

function Naming({ kind, section, members, status, send }: { kind: Kind; section: LegalSection | GlossarySection; members: KnowledgeMember[]; status: Status; send: Send }) {
  const [owner, setOwner] = useState(section.owner?.user ?? '');
  const [delegate, setDelegate] = useState(section.delegate?.user ?? '');
  const options = (current: string) => (
    <>
      <option value="">Nobody</option>
      {members.map((m) => <option key={m.id} value={m.id}>@{m.login}</option>)}
      {current !== '' && !members.some((m) => m.id === current) ? <option value={current}>A former member</option> : null}
    </>
  );
  const save = async () => {
    const asked = [
      { role: 'owner', user: owner, was: section.owner?.user ?? '' },
      { role: 'delegate', user: delegate, was: section.delegate?.user ?? '' },
    ] as const;
    for (const { role, user, was } of asked) {
      if (user !== was && !(await send({ op: 'name', kind, role, user: user || null }))) return;
    }
  };
  return (
    <form className="links-form" aria-label={`Who answers for ${kind === 'legal' ? 'Legal' : 'the Glossary'}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="links-field">
        <span>Owner</span>
        <select className="products-look-select" value={owner} disabled={status.busy} onChange={(e) => { setOwner(e.currentTarget.value); }}>{options(owner)}</select>
      </label>
      <label className="links-field">
        <span>Delegate</span>
        <select className="products-look-select" value={delegate} disabled={status.busy} onChange={(e) => { setDelegate(e.currentTarget.value); }}>{options(delegate)}</select>
      </label>
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>Name owner and delegate</button></span>
    </form>
  );
}

function Proposals({ kind, section, status, send }: { kind: Kind; section: LegalSection | GlossarySection; status: Status; send: Send }) {
  if (section.proposals.length === 0) return null;
  return (
    <>
      <h3>Open proposals</h3>
      <ul className="links-list">
        {section.proposals.map((p) => (
          <li key={p.proposal} className="links-row" data-proposal={p.proposal}>
            <span>{proposalLine(kind, p, section.entries)}</span>
            {section.decides && (
              <span className="links-actions">
                <button className="ask-button" type="button" disabled={status.busy} onClick={() => { void send({ op: 'decide', proposal: p.proposal, verdict: 'approve' }); }}>Approve</button>
                <button className="ask-button quiet" type="button" disabled={status.busy} onClick={() => { void send({ op: 'decide', proposal: p.proposal, verdict: 'reject' }); }}>Reject</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Input({ label, value, max, disabled, onChange }: { label: string; value: string; max: number; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className="links-field">
      <span>{label}</span>
      <input className="links-input" value={value} maxLength={max} disabled={disabled} onChange={(e) => { onChange(e.currentTarget.value); }} />
    </label>
  );
}

function LegalRow({ entry, decides, status, send }: { entry: LegalEntry; decides: boolean; status: Status; send: Send }) {
  const [statement, setStatement] = useState(entry.statement);
  const [source, setSource] = useState(entry.source);
  return (
    <li className="links-row" data-entry={entry.id}>
      <form className="links-form" onSubmit={(e) => { e.preventDefault(); void send({ op: 'change', kind: 'legal', action: 'edit', entry: entry.entry, fields: { statement, source } }); }}>
        <strong>{entry.id}</strong>
        <span className="ask-muted links-added">owner {who(entry.owner)}</span>
        <Input label="Statement" value={statement} max={400} disabled={status.busy} onChange={setStatement} />
        <Input label="Source law" value={source} max={500} disabled={status.busy} onChange={setSource} />
        <span className="links-actions">
          <button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Edit' : 'Propose an edit'}</button>
          <button className="ask-button quiet" type="button" disabled={status.busy} onClick={() => { void send({ op: 'change', kind: 'legal', action: 'retire', entry: entry.entry, fields: {} }); }}>
            {decides ? 'Retire' : 'Propose to retire'}
          </button>
        </span>
      </form>
    </li>
  );
}

function TermRow({ entry, decides, status, send }: { entry: GlossaryEntry; decides: boolean; status: Status; send: Send }) {
  const [term, setTerm] = useState(entry.term);
  const [meaning, setMeaning] = useState(entry.meaning);
  const [avoid, setAvoid] = useState(csv(entry.avoid));
  return (
    <li className="links-row" data-entry={entry.term}>
      <form className="links-form" onSubmit={(e) => { e.preventDefault(); void send({ op: 'change', kind: 'glossary', action: 'edit', entry: entry.entry, fields: { term, meaning, avoid: words(avoid) } }); }}>
        <Input label="Term" value={term} max={80} disabled={status.busy} onChange={setTerm} />
        <Input label="Meaning" value={meaning} max={400} disabled={status.busy} onChange={setMeaning} />
        <Input label="Avoid" value={avoid} max={1700} disabled={status.busy} onChange={setAvoid} />
        <span className="links-actions">
          <button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Edit' : 'Propose an edit'}</button>
          <button className="ask-button quiet" type="button" disabled={status.busy} onClick={() => { void send({ op: 'change', kind: 'glossary', action: 'remove', entry: entry.entry, fields: {} }); }}>
            {decides ? 'Remove' : 'Propose to remove'}
          </button>
        </span>
      </form>
    </li>
  );
}

function AddLegal({ decides, status, send }: { decides: boolean; status: Status; send: Send }) {
  const [fields, setFields] = useState({ code: '', statement: '', source: '' });
  const set = (key: keyof typeof fields) => (v: string) => { setFields((f) => ({ ...f, [key]: v })); };
  return (
    <form className="links-form" aria-label="Add a Legal entry" onSubmit={(e) => {
      e.preventDefault();
      void send({ op: 'change', kind: 'legal', action: 'add', fields }).then((saved) => { if (saved) setFields({ code: '', statement: '', source: '' }); });
    }}>
      <Input label="Code" value={fields.code} max={40} disabled={status.busy} onChange={set('code')} />
      <Input label="Statement" value={fields.statement} max={400} disabled={status.busy} onChange={set('statement')} />
      <Input label="Source law" value={fields.source} max={500} disabled={status.busy} onChange={set('source')} />
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Add' : 'Propose'}</button></span>
    </form>
  );
}

function AddTerm({ decides, status, send }: { decides: boolean; status: Status; send: Send }) {
  const [fields, setFields] = useState({ term: '', meaning: '', avoid: '' });
  const set = (key: keyof typeof fields) => (v: string) => { setFields((f) => ({ ...f, [key]: v })); };
  return (
    <form className="links-form" aria-label="Add a term" onSubmit={(e) => {
      e.preventDefault();
      const sent: Fields = { term: fields.term, meaning: fields.meaning, avoid: words(fields.avoid) };
      void send({ op: 'change', kind: 'glossary', action: 'add', fields: sent }).then((saved) => { if (saved) setFields({ term: '', meaning: '', avoid: '' }); });
    }}>
      <Input label="Term" value={fields.term} max={80} disabled={status.busy} onChange={set('term')} />
      <Input label="Meaning" value={fields.meaning} max={400} disabled={status.busy} onChange={set('meaning')} />
      <Input label="Avoid" value={fields.avoid} max={1700} disabled={status.busy} onChange={set('avoid')} />
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Add' : 'Propose'}</button></span>
    </form>
  );
}

/** Who answers for a kind. */
function Owners({ section }: { section: LegalSection | GlossarySection }) {
  const none = section.owner === null && section.delegate === null;
  return (
    <p className="ask-muted" data-owners>
      Owner: {who(section.owner)} · Delegate: {who(section.delegate)}{none ? ` · ${OWNERS_DECIDE}` : ''}
    </p>
  );
}

function Retired({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <h3>Kept</h3>
      <ul className="links-list">{lines.map((line) => <li key={line} className="links-row ask-muted">{line}</li>)}</ul>
    </>
  );
}

function LegalSectionView({ section, members, canName, status, send }: { section: LegalSection; members: KnowledgeMember[]; canName: boolean; status: Status; send: Send }) {
  const live = section.entries.filter((e) => e.retiredAt === null);
  const retired = section.entries.filter((e) => e.retiredAt !== null).map((e) => `${e.id} · retired · ${e.statement}`);
  return (
    <section className="ask-card products-section" aria-labelledby="legal-title">
      <h2 id="legal-title">Legal</h2>
      <p className="ask-muted">What the law requires of this product. Every repository of the product reads the same entries.</p>
      <Owners section={section} />
      {canName && <Naming kind="legal" section={section} members={members} status={status} send={send} />}
      {live.length === 0 ? <p className="products-empty">{NO_LEGAL}</p> : (
        <ul className="links-list">{live.map((e) => <LegalRow key={`${e.entry} ${e.statement} ${e.source}`} entry={e} decides={section.decides} status={status} send={send} />)}</ul>
      )}
      <Proposals kind="legal" section={section} status={status} send={send} />
      <AddLegal decides={section.decides} status={status} send={send} />
      <Retired lines={retired} />
    </section>
  );
}

function GlossarySectionView({ section, members, canName, status, send }: { section: GlossarySection; members: KnowledgeMember[]; canName: boolean; status: Status; send: Send }) {
  const live = section.entries.filter((e) => e.removedAt === null);
  const removed = section.entries.filter((e) => e.removedAt !== null).map((e) => `${e.term} · removed · ${e.meaning}`);
  return (
    <section className="ask-card products-section" aria-labelledby="glossary-title">
      <h2 id="glossary-title">Glossary</h2>
      <p className="ask-muted">The product’s words, and the words to avoid in their place.</p>
      <Owners section={section} />
      {canName && <Naming kind="glossary" section={section} members={members} status={status} send={send} />}
      {live.length === 0 ? <p className="products-empty">{NO_TERMS}</p> : (
        <ul className="links-list">{live.map((e) => <TermRow key={`${e.entry} ${e.term} ${e.meaning} ${csv(e.avoid)}`} entry={e} decides={section.decides} status={status} send={send} />)}</ul>
      )}
      <Proposals kind="glossary" section={section} status={status} send={send} />
      <AddTerm decides={section.decides} status={status} send={send} />
      <Retired lines={removed} />
    </section>
  );
}

export interface KnowledgeTabPageProps {
  source: TabSource;
  tab: KnowledgeTab;
}

export function KnowledgeTabPage({ source, tab }: KnowledgeTabPageProps) {
  const [status, setStatus] = useState<Status>({ busy: false, message: null });
  const port = useRef<KnowledgePort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo' ? demoKnowledgePort : knowledgeClient(tab.product.id));

  const send: Send = async (write) => {
    setStatus({ busy: true, message: null });
    const answer: Changed = await getPort().send(write);
    if (!answer.ok) {
      setStatus({ busy: false, message: answer.message });
      return false;
    }
    setStatus({ busy: false, message: null });
    window.location.reload();
    return true;
  };

  return (
    <>
      <LegalSectionView section={tab.legal} members={tab.members} canName={tab.canName} status={status} send={send} />
      <GlossarySectionView section={tab.glossary} members={tab.members} canName={tab.canName} status={status} send={send} />
      {status.message ? <p className="products-refusal" role="alert">{status.message}</p> : null}
    </>
  );
}
