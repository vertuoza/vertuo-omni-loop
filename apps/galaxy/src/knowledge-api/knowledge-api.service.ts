import type { ChangeWrite, DomainEntry, GlossaryEntry, KnowledgeRefusal, LegalEntry } from '../product-knowledge/product-knowledge.contract';
import type { KnowledgeService, KnowledgeTab } from '../product-knowledge/product-knowledge.service';
import { itemHref, sectionHref } from '../product-knowledge/knowledge-sections';
import { randomAvatar } from '@omni/design';
import type { ChangeRefusal, ConstituentChange, PersonaChange, DomainsChange, GlossaryChange, KnowledgeChange, LegalChange } from './knowledge-api.contract';
import type { StoredPersona } from '../business/personas';
import type { ConstituentKey, FoundProduct, KnowledgeApiRepository, PersonaArgs, Stored } from './knowledge-api.repository';

// A terminal's knowledge change, its rules (PRD 2268 s1): the page's, unchanged, through the page's own
// paths, so the two can never drift apart.
//
// - The product: the repository's, in the caller's workspace for it (knowledge_product_for_repo(): another
//   workspace's repository is not allowed, law BR-PRODUCT-63; several products and none named is refused,
//   naming them; none, or an archived one, is missing).
// - Legal, glossary and domains (PRD 2583): the Knowledge tab's service (product-knowledge.service.ts) makes the change, as the
//   caller: the section's owner or delegate (or, while it names nobody, a workspace owner) saves it
//   directly, any other member proposes it. An edit names its item as the reads print it (`L-GDPR-5`, a
//   term without case), found among the live ones, and sends only the fields given.
// - Personas (PRD 2779): persona_add(), persona_edit() and persona_find(), any member's, always applied.
// - Constituents: constituent_add() and constituent_edit(), which only a workspace owner may call; anyone
//   else is refused in the database's words, with no proposal.
// The answer says what was done, the item's id and its page (the section's list for a proposal), and who a
// proposal waits for.

/** What a change answers: what was done, the item's id, the path of its page, and who it waits for. */
type ChangeDone = { done: 'applied' | 'proposed'; id: string | null; path: string; waitsFor: string | null };

/** A service answer: its value, or why it was refused, in plain words; `cause` is logged, when set. */
type ChangeOutcome = { ok: true; value: ChangeDone } | { ok: false; kind: ChangeRefusal; error: string; cause: string | null };

const COULD_NOT_SAVE = 'The change could not be saved. Try again.';

const refused = (kind: ChangeRefusal, error: string, cause: string | null = null): ChangeOutcome => ({ ok: false, kind, error, cause });

/** A refusal by the database's code, in its words. */
function refusalOf(stored: Extract<Stored<unknown>, { ok: false }>): ChangeOutcome {
  if (stored.code === '42501') return refused('not-allowed', stored.message);
  if (stored.code === 'P0002') return refused('missing', stored.message);
  if (stored.code === '21000' || stored.code === 'P0003') return refused('several', stored.message);
  if (stored.code === '22023') return refused('refused', stored.message);
  return refused('database', COULD_NOT_SAVE, stored.message);
}

const applied = (id: string | null, path: string): ChangeOutcome => ({ ok: true, value: { done: 'applied', id, path, waitsFor: null } });

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const liveLegal = (entries: readonly LegalEntry[]) => entries.filter((e) => e.retiredAt === null);
const liveDomains = (entries: readonly DomainEntry[]) => entries.filter((e) => e.retiredAt === null);
const liveTerms = (entries: readonly GlossaryEntry[]) => entries.filter((e) => e.removedAt === null);

/** A constituent's display id read back: `statement`, or `never#<n>`. */
const constituentKeyOf = (id: string): ConstituentKey => (id === 'statement' ? { kind: 'statement', seq: null } : { kind: 'never', seq: Number(id.slice('never#'.length)) });
const displayIdOf = (key: ConstituentKey) => (key.kind === 'statement' ? 'statement' : `never#${String(key.seq)}`);
const segmentOf = (key: ConstituentKey) => (key.kind === 'statement' ? 'statement' : `never-${String(key.seq)}`);

type Knowledge = Pick<KnowledgeService, 'tab' | 'change'>;
type SectionChange = LegalChange | GlossaryChange | DomainsChange;
type SectionEdit = Extract<SectionChange, { action: 'edit' }>;

/** The live item an edit names: its stored id, the id it answers with, and its page's segment. */
type Edited = { uuid: string; id: string; segment: string };

/** The live item `change` edits, as the reads print it (`L-GDPR-5`; a term, without case), or null. */
function editedOf(tab: KnowledgeTab, change: SectionEdit): Edited | null {
  if (change.kind === 'legal') {
    const found = liveLegal(tab.legal.entries).find((e) => same(e.id, change.entry));
    return found ? { uuid: found.entry, id: found.id, segment: found.id } : null;
  }
  if (change.kind === 'domains') {
    const found = liveDomains(tab.domains.entries).find((e) => same(e.key, change.entry));
    return found ? { uuid: found.entry, id: found.key, segment: found.key } : null;
  }
  const found = liveTerms(tab.glossary.entries).find((e) => same(e.term, change.entry));
  return found ? { uuid: found.entry, id: change.fields.term ?? found.term, segment: found.entry } : null;
}

/** The live item an addition made, as the reads print it (`id`) and its page's segment, or null when it is not there. */
function madeBy(tab: KnowledgeTab, change: SectionChange): Edited | null {
  if (change.kind === 'legal') return madeLegal(tab, change);
  return change.kind === 'domains' ? madeDomain(tab, change) : madeTerm(tab, change);
}

/** The newest live Legal entry of the code an addition named. */
function madeLegal(tab: KnowledgeTab, change: LegalChange): Edited | null {
  const code = 'code' in change.fields ? change.fields.code.toUpperCase() : '';
  const made = liveLegal(tab.legal.entries).filter((e) => e.code === code).sort((a, b) => b.number - a.number)[0];
  return made ? { uuid: made.entry, id: made.id, segment: made.id } : null;
}

/** The live domain of the key an addition named. */
function madeDomain(tab: KnowledgeTab, change: DomainsChange): Edited | null {
  const key = 'key' in change.fields ? change.fields.key : '';
  const made = liveDomains(tab.domains.entries).find((e) => same(e.key, key));
  return made ? { uuid: made.entry, id: made.key, segment: made.key } : null;
}

/** The live term an addition named. */
function madeTerm(tab: KnowledgeTab, change: GlossaryChange): Edited | null {
  const term = 'term' in change.fields ? change.fields.term ?? '' : '';
  const made = liveTerms(tab.glossary.entries).find((e) => same(e.term, term));
  return made ? { uuid: made.entry, id: made.term, segment: made.entry } : null;
}

function noSuchItem(change: SectionEdit, product: FoundProduct): string {
  if (change.kind === 'legal') return `No Legal entry ${change.entry} in ${product.name}.`;
  if (change.kind === 'domains') return `No domain ${change.entry} in ${product.name}.`;
  return `No term ${change.entry} in ${product.name}'s glossary.`;
}

/** A proposal: no id yet, the section's list, and the section's owner (or delegate) it waits for. */
function proposed(tab: KnowledgeTab, product: FoundProduct, change: SectionChange): ChangeOutcome {
  const section = tab[change.kind];
  return { ok: true, value: { done: 'proposed', id: null, path: sectionHref(product.id, change.kind), waitsFor: section.owner?.login ?? section.delegate?.login ?? null } };
}

/** The Knowledge tab service's refusal, its database failure logged. */
const pageRefusal = (kind: KnowledgeRefusal, error: string): ChangeOutcome => (kind === 'database' ? refused('database', COULD_NOT_SAVE, error) : refused(kind, error));

/** A fresh seed for a new persona's portrait. */
const freshSeed = (): string => crypto.randomUUID();

export function knowledgeApiService(store: KnowledgeApiRepository, knowledge: Knowledge, seed: () => string = freshSeed) {
  /** A Legal, glossary or domain change, through the Knowledge tab's service. */
  async function sectionChange(product: FoundProduct, change: SectionChange): Promise<ChangeOutcome> {
    const tab = await knowledge.tab(product.workspace, product.id);
    if (!tab) return refused('missing', `No product ${product.name} in your workspaces.`);
    let edited: Edited | undefined;
    if (change.action === 'edit') {
      const found = editedOf(tab, change);
      if (!found) return refused('missing', noSuchItem(change, product));
      edited = found;
    }

    const write: ChangeWrite = { op: 'change', kind: change.kind, action: change.action, fields: change.fields, ...(edited ? { entry: edited.uuid } : {}) };
    const done = await knowledge.change(product.id, write);
    if (!done.ok) return pageRefusal(done.kind, done.error);
    if (done.value.done === 'proposed') return proposed(tab, product, change);
    return edited ? applied(edited.id, itemHref(product.id, change.kind, edited.segment)) : addedItem(product, change);
  }

  /** The item an addition made, read back: the newest Legal entry of its code, the live domain of its key, or the live term. */
  async function addedItem(product: FoundProduct, change: SectionChange): Promise<ChangeOutcome> {
    const tab = await knowledge.tab(product.workspace, product.id);
    const made = tab ? madeBy(tab, change) : null;
    return made ? applied(made.id, itemHref(product.id, change.kind, made.segment)) : applied(null, sectionHref(product.id, change.kind));
  }

  /** A Statement or Never line, through constituent_add() or constituent_edit(): a workspace owner's alone. */
  async function constituentChange(product: FoundProduct, change: ConstituentChange): Promise<ChangeOutcome> {
    let saved: Stored<ConstituentKey>;
    if (change.action === 'add') {
      const [kind, text] = 'statement' in change.fields ? (['statement', change.fields.statement] as const) : (['never', change.fields.never] as const);
      saved = await store.addConstituent(product.workspace, product.id, kind, text);
    } else {
      const found = await store.constituent(product.id, constituentKeyOf(change.entry));
      if (!found.ok) return refusalOf(found);
      if (found.value === null) return refused('missing', `No ${change.entry} in ${product.name}'s constituents.`);
      saved = await store.editConstituent(product.workspace, found.value, change.fields.text);
    }
    if (!saved.ok) return refusalOf(saved);
    return applied(displayIdOf(saved.value), itemHref(product.id, 'constituents', segmentOf(saved.value)));
  }

  /** An edited persona's fields: the stored ones, with the fields given on top and the portrait kept. */
  const editedPersona = (was: StoredPersona, f: { name?: string | undefined; stance?: string | undefined; trade?: string | undefined; who?: string | undefined; usage?: string | undefined }): PersonaArgs => ({
    name: f.name ?? was.name, stance: f.stance ?? was.stance, trade: f.trade ?? was.trade, avatar: was.avatar,
    who: f.who ?? was.who ?? '', usage: f.usage ?? was.usage ?? '',
  });

  /** A persona, through persona_add() or persona_edit(): any member's, always applied (PRD 2779). An add gets
   * a random portrait; an edit finds the persona by its name, keeps its portrait and changes only the fields given. */
  async function personaChange(product: FoundProduct, change: PersonaChange): Promise<ChangeOutcome> {
    let saved: Stored<StoredPersona>;
    if (change.action === 'add') {
      saved = await store.addPersona(product.workspace, product.id, { ...change.fields, avatar: randomAvatar(seed()) });
    } else {
      const found = await store.findPersona(product.workspace, product.id, change.entry);
      if (!found.ok) return refusalOf(found);
      saved = await store.editPersona(product.workspace, found.value.id, editedPersona(found.value, change.fields));
    }
    if (!saved.ok) return refusalOf(saved);
    return applied(saved.value.name, itemHref(product.id, 'personas', saved.value.id));
  }

  return {
    /** Makes `change` as the caller, on the product of its repository. */
    async change(change: KnowledgeChange): Promise<ChangeOutcome> {
      const found = await store.productFor(change.repo, change.product ?? null);
      if (!found.ok) return refusalOf(found);
      if (change.kind === 'constituent') return constituentChange(found.value, change);
      return change.kind === 'persona' ? personaChange(found.value, change) : sectionChange(found.value, change);
    },
  };
}

export type KnowledgeApiService = ReturnType<typeof knowledgeApiService>;
