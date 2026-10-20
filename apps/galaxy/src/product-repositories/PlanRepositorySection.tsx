import { useState } from 'react';
import type { Link } from './repositories-tab.contract';
import type { PlanForm } from './repositories-tab-model';

// The Repositories & approvers tab's rollout ladder and its plan repository, drawn (PRD 2011 s17, screen
// product-repositories): one line per repository with the five steps of the ladder, the reached ones
// filled; under it, the product's plan repository, which a workspace owner picks among the workspace's
// repositories, or none, and any other member reads as text; then what is still in it (`Held by
// vertuo-web · step 3`, `Held by roadmap 0412 · in git`), as information only. There is no archive
// action: the plan repository is never archived, and keeps working beside the product.
// RepositoriesTabPage.tsx wires it.

const LADDER_STEPS = [1, 2, 3, 4, 5] as const;
export const NOTHING_LEFT = 'Nothing open is still in it.';
const PLAN_HINT = 'The repository that holds this product’s plans in git: the roadmaps and bug records born there, and where a mega bug fix starts.';
export const NO_PLAN = 'This product names no plan repository.';
export const PLAN_READ_ONLY = 'Only a workspace owner changes the plan repository.';
/** The picker's choice for no plan repository. */
export const NO_PLAN_CHOICE = 'None';

export interface PlanHandlers {
  /** Names the plan repository, or none (null). */
  save: (repo: string | null) => void;
}

const IDLE: PlanHandlers = { save: () => {} };

/** A repository's short name, as the ladder shows it. */
const shortName = (repo: string) => repo.split('/').at(-1) ?? repo;

export function Ladder({ links }: { links: readonly Link[] }) {
  if (links.length === 0) return null;
  return (
    <section className="ask-card products-section" aria-labelledby="ladder-title">
      <h2 id="ladder-title">Rollout ladder</h2>
      <p className="ask-muted">How far each repository has come: at step 5, its roadmaps and bug records are born on the server.</p>
      <ul className="plan-ladder">
        {links.map((link) => (
          <li key={link.repo} className="plan-ladder-row" data-ladder-repo={link.repo}>
            <span className="plan-ladder-name">{shortName(link.repo)}</span>
            <span className="plan-ladder-steps" role="img" aria-label={`${link.repo}: step ${String(link.ladderStep)} of 5`}>
              {LADDER_STEPS.map((n) => <i key={n} className={n <= link.ladderStep ? 'plan-ladder-cell on' : 'plan-ladder-cell'} />)}
            </span>
            <span className="ask-muted plan-ladder-step">step {link.ladderStep}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The owner's picker: the workspace's repositories (and the saved one, should the workspace no longer list it), or none. */
function PlanPicker({ saved, repositories, busy, on }: { saved: string | null; repositories: readonly string[]; busy: boolean; on: PlanHandlers }) {
  const [picked, setPicked] = useState(saved ?? '');
  const choices = [...new Set([...(saved === null ? [] : [saved]), ...repositories])].sort((a, b) => a.localeCompare(b));
  return (
    <form className="approvers-add plan-pick" onSubmit={(e) => { e.preventDefault(); on.save(picked === '' ? null : picked); }}>
      <select className="products-look-select" aria-label="Plan repository" value={picked} disabled={busy} onChange={(e) => { setPicked(e.currentTarget.value); }}>
        <option value="">{NO_PLAN_CHOICE}</option>
        {choices.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className="ask-button" type="submit" disabled={busy || picked === (saved ?? '')}>Save</button>
    </form>
  );
}

export function PlanRepositorySection({ form, owner, repositories, on = IDLE }: { form: PlanForm; owner: boolean; repositories: readonly string[]; on?: PlanHandlers }) {
  const { plan } = form;
  const saved = plan?.repository ?? null;
  return (
    <section className="ask-card products-section" aria-labelledby="plan-title">
      <h2 id="plan-title">Plan repository</h2>
      <p className="ask-muted">{PLAN_HINT}</p>
      {owner
        ? <PlanPicker key={saved ?? ''} saved={saved} repositories={repositories} busy={form.busy} on={on} />
        : (
          <>
            <p className="plan-named">{saved === null ? NO_PLAN : <strong>{saved}</strong>}</p>
            <p className="ask-muted">{PLAN_READ_ONLY}</p>
          </>
        )}
      {form.message ? <p className="products-refusal" role="alert">{form.message}</p> : null}
      {plan && (
        <div className="plan-still">
          <h3>Still in the plan repository</h3>
          <p className="ask-muted"><strong>{plan.repository}</strong>{plan.holds.length === 0 ? ` ${NOTHING_LEFT}` : ' still holds:'}</p>
          {plan.holds.length > 0 && (
            <ul className="plan-holds">
              {plan.holds.map((hold) => (
                <li key={`${hold.name} ${hold.why}`} className="plan-hold"><b>Held by</b> {hold.name} · {hold.why}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
