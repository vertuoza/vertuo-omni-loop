import { useState } from 'react';
import { KNOWLEDGE, type Link, type LinkWrite } from './repositories-tab.contract';
import { draftOf, KNOWLEDGE_LABELS, newLinkWrite, writeOf, type LinkDraft, type LinksForm } from './repositories-tab-model';

// The Repositories & approvers tab's links, drawn (PRD 1364 s11, acceptance 11): each repository of the
// product with its role, knowledge base (its own, imported at a commit, or none), whether the product
// only reads it, what it consumes among the product's other repositories, and who added it. A workspace
// owner edits each field and saves the link whole, removes a repository, and adds one of the workspace's
// other repositories with Add a repository; any other member reads the same list as text. Drawn on the
// server first; RepositoriesTabPage.tsx wires it.

const LINKS_HINT = 'The repositories this product builds or reads. A repository can be in several products.';
export const LINKS_READ_ONLY = 'Only a workspace owner changes these repositories.';
export const NO_LINKS = 'No repository is in this product yet.';
export const ALL_LINKED = 'Every repository of the workspace is in this product.';

export interface LinksHandlers {
  save: (write: LinkWrite) => void;
  remove: (repo: string) => void;
}

const IDLE: LinksHandlers = { save: () => {}, remove: () => {} };

const ADDED_BY: Readonly<Record<Link['addedBy'], string>> = { person: 'added by a person', prd: 'added by a PRD' };

/** A link's fields, as text, for a member. */
function facts(link: Link): string[] {
  const knowledge = link.knowledge === 'imported' && link.readAt ? `knowledge imported at ${link.readAt.slice(0, 7)}` : `knowledge: ${KNOWLEDGE_LABELS[link.knowledge].toLowerCase()}`;
  return [
    link.role ? `role ${link.role}` : 'no role yet',
    knowledge,
    ...(link.readOnly ? ['read only'] : []),
    ...(link.consumes.length > 0 ? [`consumes ${link.consumes.join(', ')}`] : []),
    ADDED_BY[link.addedBy],
  ];
}

function ReadRow({ link }: { link: Link }) {
  return (
    <li className="links-row" data-repo={link.repo}>
      <strong>{link.repo}</strong>
      <span className="ask-muted links-facts">{facts(link).join(' · ')}</span>
    </li>
  );
}

function OwnedRow({ link, others, busy, on }: { link: Link; others: string[]; busy: boolean; on: LinksHandlers }) {
  const [draft, setDraft] = useState<LinkDraft>(() => draftOf(link));
  const edit = (change: Partial<LinkDraft>) => { setDraft((d) => ({ ...d, ...change })); };
  const id = (field: string) => `link-${link.repo.replace(/[^\w-]/g, '-')}-${field}`;
  return (
    <li className="links-row" data-repo={link.repo}>
      <form className="links-form" onSubmit={(e) => { e.preventDefault(); on.save(writeOf(link.repo, draft)); }}>
        <strong>{link.repo}</strong>
        <span className="ask-muted links-added">{ADDED_BY[link.addedBy]}</span>
        <label className="links-field" htmlFor={id('role')}>
          <span>Role</span>
          <input id={id('role')} className="links-input" value={draft.role} placeholder="api" disabled={busy} maxLength={40}
            onChange={(e) => { edit({ role: e.currentTarget.value }); }} />
        </label>
        <label className="links-field" htmlFor={id('knowledge')}>
          <span>Knowledge</span>
          <select id={id('knowledge')} className="products-look-select" value={draft.knowledge} disabled={busy}
            onChange={(e) => { const k = KNOWLEDGE.find((v) => v === e.currentTarget.value); if (k) edit({ knowledge: k }); }}>
            {KNOWLEDGE.map((k) => <option key={k} value={k}>{KNOWLEDGE_LABELS[k]}</option>)}
          </select>
        </label>
        {draft.knowledge === 'imported' && (
          <label className="links-field" htmlFor={id('read-at')}>
            <span>Read at</span>
            <input id={id('read-at')} className="links-input links-commit" value={draft.readAt} placeholder="the 40-hex commit" disabled={busy} maxLength={40}
              onChange={(e) => { edit({ readAt: e.currentTarget.value }); }} />
          </label>
        )}
        <label className="links-check">
          <input type="checkbox" checked={draft.readOnly} disabled={busy} onChange={(e) => { edit({ readOnly: e.currentTarget.checked }); }} />
          <span>Read only</span>
        </label>
        {others.length > 0 && (
          <fieldset className="links-consumes" disabled={busy}>
            <legend>Consumes</legend>
            {others.map((repo) => (
              <label key={repo} className="links-check">
                <input type="checkbox" checked={draft.consumes.includes(repo)}
                  onChange={(e) => { const on = e.currentTarget.checked; edit({ consumes: on ? [...draft.consumes, repo] : draft.consumes.filter((c) => c !== repo) }); }} />
                <span>{repo}</span>
              </label>
            ))}
          </fieldset>
        )}
        <span className="links-actions">
          <button className="ask-button" type="submit" disabled={busy}>Save</button>
          <button className="ask-button quiet" type="button" disabled={busy} onClick={() => { on.remove(link.repo); }}>Remove</button>
        </span>
      </form>
    </li>
  );
}

function AddRepository({ addable, add, busy, on }: { addable: string[]; add: string | null; busy: boolean; on: LinksHandlers }) {
  const [picked, setPicked] = useState(add ?? '');
  if (addable.length === 0) return <p className="ask-muted">{ALL_LINKED}</p>;
  const repo = addable.find((r) => r === picked) ?? addable[0] ?? '';
  return (
    <form className="approvers-add links-add" onSubmit={(e) => { e.preventDefault(); on.save(newLinkWrite(repo)); }}>
      <select className="products-look-select" aria-label="Repository to add" value={repo} disabled={busy} onChange={(e) => { setPicked(e.currentTarget.value); }}>
        {addable.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className="ask-button" type="submit" disabled={busy}>Add a repository</button>
    </form>
  );
}

export function LinksSection({ form, owner, add = null, on = IDLE }: { form: LinksForm; owner: boolean; add?: string | null; on?: LinksHandlers }) {
  const repos = form.links.map((l) => l.repo);
  return (
    <section className="ask-card products-section" aria-labelledby="links-title">
      <h2 id="links-title">Repositories</h2>
      <p className="ask-muted">{LINKS_HINT}</p>
      {form.links.length === 0
        ? <p className="products-empty">{NO_LINKS}</p>
        : (
          <ul className="links-list">
            {form.links.map((link) => (owner
              ? <OwnedRow key={`${link.repo} ${JSON.stringify(link)}`} link={link} others={repos.filter((r) => r !== link.repo)} busy={form.busy} on={on} />
              : <ReadRow key={link.repo} link={link} />))}
          </ul>
        )}
      {owner ? <AddRepository addable={form.addable} add={add} busy={form.busy} on={on} /> : <p className="ask-muted">{LINKS_READ_ONLY}</p>}
      {form.message ? <p className="products-refusal" role="alert">{form.message}</p> : null}
    </section>
  );
}
