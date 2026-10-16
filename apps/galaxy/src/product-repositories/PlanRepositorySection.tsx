import type { Link, PlanRepository } from './repositories-tab.contract';

// The Repositories & approvers tab's rollout ladder and what is still in the plan repository, drawn
// (PRD 2011 s17, screen product-repositories), as information only: one line per repository with the five
// steps of the ladder, the reached ones filled; under it, what is still in the plan repository
// (`Held by vertuo-web · step 3`, `Held by roadmap 0412 · in git`). There is nothing to press: the plan
// repository is never archived, and keeps working beside the product. RepositoriesTabPage.tsx wires it.

const LADDER_STEPS = [1, 2, 3, 4, 5] as const;
export const NOTHING_LEFT = 'Nothing open is still in it.';

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

export function PlanRepositorySection({ plan }: { plan: PlanRepository }) {
  return (
    <section className="ask-card products-section" aria-labelledby="plan-title">
      <h2 id="plan-title">Still in the plan repository</h2>
      <p className="ask-muted"><strong>{plan.repository}</strong>{plan.holds.length === 0 ? ` ${NOTHING_LEFT}` : ' still holds:'}</p>
      {plan.holds.length > 0 && (
        <ul className="plan-holds">
          {plan.holds.map((hold) => (
            <li key={`${hold.name} ${hold.why}`} className="plan-hold"><b>Held by</b> {hold.name} · {hold.why}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
