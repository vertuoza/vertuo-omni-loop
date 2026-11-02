'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demoKnowledgePort, knowledgeClient, type Changed, type KnowledgePort } from './product-knowledge.client';
import type {
  DomainEntry, DomainSection, Fields, GlossaryEntry, GlossarySection, Kind, KnowledgeMember, KnowledgeWrite, LegalEntry, LegalSection, Person, Proposal,
} from './product-knowledge.contract';

// What changes on the Knowledge home, in the browser (PRD 1795 s2, PRD 2240 s3, PRD 2583 s1): the controls
// of the Legal, Glossary and Domains lists and of an entry's page. The kind's owner or delegate (`decides`)
// edits, retires or removes directly and approves or rejects proposals; any other member proposes; a
// workspace owner (`canName`) names the owner and the delegate. A domain's key is given once, when it is
// added, and never edited. Every change goes through the tab's one route as the signed-in person
// (product-knowledge.client.ts); once it is saved the page refreshes in place, so the server draws what is
// now true and the address, with its sort, stays. In the demo, nothing is saved.

/** A kind's section, whichever the kind. */
type AnySection = LegalSection | GlossarySection | DomainSection;
type AnyEntry = LegalEntry | GlossaryEntry | DomainEntry;

/** Each kind as the page names it: in "Who answers for …". */
const KIND_NAMES: Readonly<Record<Kind, string>> = { legal: 'Legal', glossary: 'the Glossary', domains: 'the Domains' };

export type TabSource = { kind: 'demo' } | { kind: 'live' };

const NO_OWNER = 'not named';
export const OWNERS_DECIDE = 'While none is named, the workspace’s owners decide.';

/** The controls' state: whether a call runs, and the refusal or the note it left. */
interface Status {
  busy: boolean;
  message: string | null;
}

/** What a control calls. */
type Send = (write: KnowledgeWrite) => Promise<boolean>;

/** A control's calls: each runs through the product's route, then refreshes the page in place. */
function useSend(product: string, source: TabSource): { status: Status; send: Send } {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ busy: false, message: null });
  const port = useRef<KnowledgePort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo' ? demoKnowledgePort : knowledgeClient(product));

  const send: Send = async (write) => {
    setStatus({ busy: true, message: null });
    const answer: Changed = await getPort().send(write);
    if (!answer.ok) {
      setStatus({ busy: false, message: answer.message });
      return false;
    }
    setStatus({ busy: false, message: null });
    router.refresh();
    return true;
  };
  return { status, send };
}

const Refusal = ({ status }: { status: Status }) => (status.message ? <p className="products-refusal" role="alert">{status.message}</p> : null);

const who = (person: Person): string => (person ? `@${person.login ?? 'a member'}` : NO_OWNER);

const csv = (words: readonly string[]): string => words.join(', ');
const words = (text: string): string[] => text.split(',').map((w) => w.trim()).filter((w) => w !== '');

/** How an entry is named in a line: a Legal entry by its code, a term by itself, a domain by its key. */
const nameOf = (entry: AnyEntry): string => ('id' in entry ? entry.id : 'term' in entry ? entry.term : entry.key);

/** Per kind, the field a proposed addition is named by, and the one an edit shows. */
const PROPOSAL_FIELDS: Readonly<Record<Kind, { subject: string; detail: string }>> = {
  legal: { subject: 'statement', detail: 'statement' },
  glossary: { subject: 'term', detail: 'meaning' },
  domains: { subject: 'key', detail: 'name' },
};

/** A proposal in one line: what it does, to what, by whom. */
export function proposalLine(kind: Kind, proposal: Proposal, entries: readonly AnyEntry[]): string {
  const target = entries.find((e) => e.entry === proposal.entry);
  const named = target ? nameOf(target) : null;
  const f = proposal.fields;
  const field = (key: string): string | null => (typeof f[key] === 'string' ? f[key] : null);
  const subject = named ?? field(PROPOSAL_FIELDS[kind].subject) ?? '';
  const detail = field(PROPOSAL_FIELDS[kind].detail) ?? (kind === 'domains' ? field('meaning') : null);
  const verb = { add: 'adds', edit: 'edits', retire: 'retires', remove: 'removes' }[proposal.action] ?? proposal.action;
  const by = proposal.proposedBy ? ` · proposed by @${proposal.proposedBy.login ?? 'a member'}` : '';
  return `${verb} ${subject}${detail && named ? `: ${detail}` : ''}${by}`;
}

function Naming({ kind, section, members, status, send }: { kind: Kind; section: AnySection; members: KnowledgeMember[]; status: Status; send: Send }) {
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
    <form className="links-form" aria-label={`Who answers for ${KIND_NAMES[kind]}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
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

function Proposals({ kind, section, status, send }: { kind: Kind; section: AnySection; status: Status; send: Send }) {
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
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Add an entry' : 'Propose'}</button></span>
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
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Add an entry' : 'Propose'}</button></span>
    </form>
  );
}

/** A domain: its key given once, the folder's word, and its name and meaning. */
function AddDomain({ decides, status, send }: { decides: boolean; status: Status; send: Send }) {
  const [fields, setFields] = useState({ key: '', name: '', meaning: '' });
  const set = (key: keyof typeof fields) => (v: string) => { setFields((f) => ({ ...f, [key]: v })); };
  return (
    <form className="links-form" aria-label="Add a domain" onSubmit={(e) => {
      e.preventDefault();
      void send({ op: 'change', kind: 'domains', action: 'add', fields }).then((saved) => { if (saved) setFields({ key: '', name: '', meaning: '' }); });
    }}>
      <Input label="Key" value={fields.key} max={60} disabled={status.busy} onChange={set('key')} />
      <Input label="Name" value={fields.name} max={80} disabled={status.busy} onChange={set('name')} />
      <Input label="Meaning" value={fields.meaning} max={400} disabled={status.busy} onChange={set('meaning')} />
      <span className="links-actions"><button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Add a domain' : 'Propose'}</button></span>
    </form>
  );
}

/** Who answers for a kind. */
function Owners({ section }: { section: AnySection }) {
  const none = section.owner === null && section.delegate === null;
  return (
    <p className="ask-muted" data-owners>
      Owner: {who(section.owner)} · Delegate: {who(section.delegate)}{none ? ` · ${OWNERS_DECIDE}` : ''}
    </p>
  );
}

export interface SectionTopProps {
  product: string;
  source: TabSource;
  kind: Kind;
  section: AnySection;
  members: KnowledgeMember[];
  canName: boolean;
}

/** Above a list: who answers for the kind, the naming control of a workspace owner, the open proposals. */
export function SectionTop({ product, source, kind, section, members, canName }: SectionTopProps) {
  const { status, send } = useSend(product, source);
  return (
    <>
      <Owners section={section} />
      {canName && <Naming kind={kind} section={section} members={members} status={status} send={send} />}
      <Proposals kind={kind} section={section} status={status} send={send} />
      <Refusal status={status} />
    </>
  );
}

const ADD_FORMS: Readonly<Record<Kind, typeof AddLegal>> = { legal: AddLegal, glossary: AddTerm, domains: AddDomain };

/** Under a list: the form that adds an entry, or proposes one. */
export function AddEntry({ product, source, kind, decides }: { product: string; source: TabSource; kind: Kind; decides: boolean }) {
  const { status, send } = useSend(product, source);
  const Form = ADD_FORMS[kind];
  return (
    <>
      <Form decides={decides} status={status} send={send} />
      <Refusal status={status} />
    </>
  );
}

interface ActionsProps {
  editing: boolean;
  decides: boolean;
  status: Status;
  onEdit: () => void;
  onRetire: () => void;
  retireLabel: string;
}

function Actions({ editing, decides, status, onEdit, onRetire, retireLabel }: ActionsProps) {
  return (
    <span className="links-actions">
      <button className="ask-button" type="button" disabled={status.busy || editing} onClick={onEdit}>{decides ? 'Edit' : 'Propose an edit'}</button>
      <button className="ask-button quiet" type="button" disabled={status.busy} onClick={onRetire}>{retireLabel}</button>
    </span>
  );
}

function Save({ decides, status, onCancel }: { decides: boolean; status: Status; onCancel: () => void }) {
  return (
    <span className="links-actions">
      <button className="ask-button" type="submit" disabled={status.busy}>{decides ? 'Save' : 'Send the proposal'}</button>
      <button className="ask-button quiet" type="button" disabled={status.busy} onClick={onCancel}>Cancel</button>
    </span>
  );
}

interface ItemProps<E> {
  product: string;
  source: TabSource;
  entry: E;
  decides: boolean;
}

/** A Legal entry's page: Edit opens its form in place; Retire, or the proposals for both, as the reader's role allows. */
export function LegalItemControls({ product, source, entry, decides }: ItemProps<LegalEntry>) {
  const { status, send } = useSend(product, source);
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(entry.statement);
  const [sourceLaw, setSourceLaw] = useState(entry.source);
  const save = async () => {
    if (await send({ op: 'change', kind: 'legal', action: 'edit', entry: entry.entry, fields: { statement, source: sourceLaw } })) setEditing(false);
  };
  return (
    <div className="kn-controls" data-entry={entry.id}>
      <Actions
        editing={editing} decides={decides} status={status} onEdit={() => { setEditing(true); }}
        retireLabel={decides ? 'Retire' : 'Propose to retire'}
        onRetire={() => { void send({ op: 'change', kind: 'legal', action: 'retire', entry: entry.entry, fields: {} }); }}
      />
      {editing && (
        <form className="links-form" aria-label={`Edit ${entry.id}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Input label="Statement" value={statement} max={400} disabled={status.busy} onChange={setStatement} />
          <Input label="Source law" value={sourceLaw} max={500} disabled={status.busy} onChange={setSourceLaw} />
          <Save decides={decides} status={status} onCancel={() => { setEditing(false); }} />
        </form>
      )}
      <Refusal status={status} />
    </div>
  );
}

/** A domain's page: Edit its name and meaning (its key never changes), Retire it, or the proposals for both. No Delete: a domain is retired. */
export function DomainItemControls({ product, source, entry, decides }: ItemProps<DomainEntry>) {
  const { status, send } = useSend(product, source);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [meaning, setMeaning] = useState(entry.meaning);
  const save = async () => {
    if (await send({ op: 'change', kind: 'domains', action: 'edit', entry: entry.entry, fields: { name, meaning } })) setEditing(false);
  };
  return (
    <div className="kn-controls" data-entry={entry.key}>
      <Actions
        editing={editing} decides={decides} status={status} onEdit={() => { setEditing(true); }}
        retireLabel={decides ? 'Retire' : 'Propose to retire'}
        onRetire={() => { void send({ op: 'change', kind: 'domains', action: 'retire', entry: entry.entry, fields: {} }); }}
      />
      {editing && (
        <form className="links-form" aria-label={`Edit ${entry.key}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Input label="Name" value={name} max={80} disabled={status.busy} onChange={setName} />
          <Input label="Meaning" value={meaning} max={400} disabled={status.busy} onChange={setMeaning} />
          <Save decides={decides} status={status} onCancel={() => { setEditing(false); }} />
        </form>
      )}
      <Refusal status={status} />
    </div>
  );
}

/** A term's page: the same, with Remove in place of Retire. */
export function TermItemControls({ product, source, entry, decides }: ItemProps<GlossaryEntry>) {
  const { status, send } = useSend(product, source);
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(entry.term);
  const [meaning, setMeaning] = useState(entry.meaning);
  const [avoid, setAvoid] = useState(csv(entry.avoid));
  const save = async () => {
    if (await send({ op: 'change', kind: 'glossary', action: 'edit', entry: entry.entry, fields: { term, meaning, avoid: words(avoid) } })) setEditing(false);
  };
  return (
    <div className="kn-controls" data-entry={entry.term}>
      <Actions
        editing={editing} decides={decides} status={status} onEdit={() => { setEditing(true); }}
        retireLabel={decides ? 'Remove' : 'Propose to remove'}
        onRetire={() => { void send({ op: 'change', kind: 'glossary', action: 'remove', entry: entry.entry, fields: {} }); }}
      />
      {editing && (
        <form className="links-form" aria-label={`Edit ${entry.term}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Input label="Term" value={term} max={80} disabled={status.busy} onChange={setTerm} />
          <Input label="Meaning" value={meaning} max={400} disabled={status.busy} onChange={setMeaning} />
          <Input label="Avoid" value={avoid} max={1700} disabled={status.busy} onChange={setAvoid} />
          <Save decides={decides} status={status} onCancel={() => { setEditing(false); }} />
        </form>
      )}
      <Refusal status={status} />
    </div>
  );
}
