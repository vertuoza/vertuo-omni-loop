import type { ApproverState } from '../products/approvers';
import type { Changed, RepositoriesTabPort } from './repositories-tab.client';
import type { Hold, Knowledge, Link, LinkWrite, PlanRepository } from './repositories-tab.contract';

// The Repositories & approvers tab's links as pure data (PRD 1364 s11): the list's state through its
// actions, a link's fields as its editor holds them (a draft), the write a draft sends, the plan
// repository's state through its actions, what holds the plan repository on the ladder, and the demo's
// port, which keeps product_repository_link()'s, product_repository_unlink()'s and
// product_plan_repository_set()'s rules in memory so the tab can be tried with no database.

export interface LinksForm {
  links: Link[];
  /** The workspace's repositories not in the product yet, by name: what Add a repository offers. */
  addable: string[];
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  message: string | null;
}

export type LinksAction =
  | { type: 'busy' }
  | { type: 'saved'; link: Link }
  | { type: 'removed'; repo: string }
  | { type: 'refused'; message: string };

const byRepo = (a: string, b: string) => a.localeCompare(b);
const sortedLinks = (links: Link[]) => [...links].sort((a, b) => byRepo(a.repo, b.repo));

export const initialLinksForm = ({ links, addable }: { links: Link[]; addable: string[] }): LinksForm =>
  ({ links: sortedLinks(links), addable: [...addable].sort(byRepo), busy: false, message: null });

export function linksReducer(form: LinksForm, action: LinksAction): LinksForm {
  switch (action.type) {
    case 'busy':
      return { ...form, busy: true, message: null };
    case 'saved':
      return {
        links: sortedLinks([...form.links.filter((l) => l.repo !== action.link.repo), action.link]),
        addable: form.addable.filter((r) => r !== action.link.repo),
        busy: false,
        message: null,
      };
    case 'removed':
      return {
        links: form.links.filter((l) => l.repo !== action.repo),
        addable: form.links.some((l) => l.repo === action.repo) ? [...form.addable, action.repo].sort(byRepo) : form.addable,
        busy: false,
        message: null,
      };
    case 'refused':
      return { ...form, busy: false, message: action.message };
  }
}

/** The plan repository as last saved, and the last call's state. */
export interface PlanForm {
  plan: PlanRepository | null;
  /** A call is on its way: the picker waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  message: string | null;
}

export type PlanAction = { type: 'busy' } | { type: 'saved'; plan: PlanRepository | null } | { type: 'refused'; message: string };

export const initialPlanForm = (plan: PlanRepository | null): PlanForm => ({ plan, busy: false, message: null });

export function planReducer(form: PlanForm, action: PlanAction): PlanForm {
  switch (action.type) {
    case 'busy':
      return { ...form, busy: true, message: null };
    case 'saved':
      return { plan: action.plan, busy: false, message: null };
    case 'refused':
      return { ...form, busy: false, message: action.message };
  }
}

/** The repositories of the product below step 5, but the plan repository itself, by name. */
export const ladderHolds = (links: readonly Link[], plan: string): Hold[] =>
  links.filter((l) => l.ladderStep < 5 && l.repo !== plan).map((l) => ({ name: l.repo.split('/').at(-1) ?? l.repo, why: `step ${String(l.ladderStep)}` }));

/** A link's fields as its editor holds them: text where the person types, the rest as chosen. */
export interface LinkDraft {
  role: string;
  knowledge: Knowledge;
  readAt: string;
  readOnly: boolean;
  consumes: string[];
}

export const draftOf = (link: Link): LinkDraft => ({
  role: link.role ?? '',
  knowledge: link.knowledge,
  readAt: link.readAt ?? '',
  readOnly: link.readOnly,
  consumes: [...link.consumes],
});

/** What saving a draft sends: every field, an empty text as none, a read-at only for an imported base. */
export const writeOf = (repo: string, draft: LinkDraft): LinkWrite => ({
  repo,
  role: draft.role.trim() === '' ? null : draft.role.trim(),
  knowledge: draft.knowledge,
  readAt: draft.knowledge === 'imported' && draft.readAt.trim() !== '' ? draft.readAt.trim() : null,
  readOnly: draft.readOnly,
  consumes: [...draft.consumes].sort(byRepo),
});

/** A new repository's link: no role yet, its own knowledge base, written, consuming nothing. */
export const newLinkWrite = (repo: string): LinkWrite => ({ repo, role: null, knowledge: 'own', readAt: null, readOnly: false, consumes: [] });

/** What the knowledge choices say. */
export const KNOWLEDGE_LABELS: Readonly<Record<Knowledge, string>> = {
  own: 'Its own',
  imported: 'Imported',
  none: 'None',
};

const ROLE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const COMMIT = /^[0-9a-f]{40}$/;

/** Why product_repository_link() refuses the write's own fields, or null. */
function fieldRefusal(write: LinkWrite): string | null {
  if (write.role !== null && !(ROLE.test(write.role) && write.role.length <= 40)) return `Role: ${write.role} is not one kebab-case word.`;
  if (write.knowledge === 'imported' && write.readAt === null) return 'Read at: an imported knowledge base names the commit it was read at.';
  if (write.readAt !== null && !COMMIT.test(write.readAt.toLowerCase())) return `Read at: ${write.readAt} is not a 40-hex commit.`;
  return null;
}

/** Why the write's consumes are refused, given the product's links, or null. */
function consumesRefusal(repo: string, consumes: readonly string[], links: readonly Link[]): string | null {
  if (consumes.includes(repo)) return `Consumes: ${repo} cannot consume itself.`;
  const missing = consumes.find((c) => !links.some((l) => l.repo === c));
  return missing ? `Consumes: ${missing} is not in this product.` : null;
}

/**
 * product_repository_link()'s, unlink()'s and product_plan_repository_set()'s rules, and the approvers'
 * functions, over the demo's links and its workspace's repositories. The demo opens no record in git: a
 * plan repository is held by the ladder only.
 */
export function demoTabPort(initial: readonly Link[], repositories: readonly string[]): RepositoriesTabPort {
  let links = [...initial];
  const refuse = (message: string): Promise<Changed<never>> => Promise.resolve({ ok: false, message });
  return {
    saveLink(write) {
      const repo = write.repo.toLowerCase();
      const refusal = fieldRefusal(write) ?? consumesRefusal(repo, write.consumes, links);
      if (refusal) return refuse(refusal);
      const was = links.find((l) => l.repo === repo);
      const link: Link = { ...write, repo, readAt: write.readAt?.toLowerCase() ?? null, addedBy: was?.addedBy ?? 'person', ladderStep: was?.ladderStep ?? 1 };
      links = [...links.filter((l) => l.repo !== repo), link];
      return Promise.resolve({ ok: true, link });
    },
    removeLink(repo) {
      const user = links.find((l) => l.consumes.includes(repo));
      if (user) return refuse(`Consumes: ${user.repo} consumes ${repo}; take it out of its consumes first.`);
      links = links.filter((l) => l.repo !== repo);
      return Promise.resolve({ ok: true, repo });
    },
    setPlan(repo) {
      if (repo === null) return Promise.resolve({ ok: true, plan: null });
      const slug = repo.trim().toLowerCase();
      if (!repositories.includes(slug)) return refuse(`Repository: ${slug} is not one of this workspace's repositories.`);
      return Promise.resolve({ ok: true, plan: { repository: slug, holds: ladderHolds(links, slug) } });
    },
    setApprover: (_member: string, state: ApproverState) => Promise.resolve({ ok: true, state }),
    removeApprover: () => Promise.resolve({ ok: true }),
  };
}
