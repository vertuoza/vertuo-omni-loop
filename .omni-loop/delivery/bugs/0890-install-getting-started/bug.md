# Bug 890: the install doc is not good, the steps are not natural

## Triage

- **Domain:** the guide — `docs/guide/`, served at `/docs` by `apps/galaxy` (PRD 346)
- **Risk:** medium — everyone setting up a laptop: the install page never gets them to ask mode, hides the plugin and the sign-in inside `omni init`, and sends team members to a second page (Join a team) for the same steps; the steps exist elsewhere (Join a team, troubleshooting, the kit README), so there is a workaround.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/docs/guide.test.ts`
- **Red:** `takes everyone, on Install, through four steps: omni globally, the skills in Claude Code, the sign-in, the questions — AssertionError: expected [ …(5) ] to have a length of 4 but got 5`

## Fix

Install was a repository administrator's page: five steps around `omni init`, which installed the plugin and signed in as side effects, and no step set up ask mode, while Join a team repeated the laptop steps on its own. Install is now the four steps everyone takes once per laptop, in order: `omni` installed globally, the skills loaded in Claude Code, `omni signin` from a repository that has the kit, and `/omni:ask on`. `omni init`, the GitHub App and the merge move to Install's last part, Set up a repository, which step 3 sends to when the repository has no `.omni-loop/` yet. Getting started now leads to Install, before Join a team, and Join a team, Getting started, troubleshooting, Invade, Your first PRD and Several repositories link to Install instead of repeating its steps.

## Guard

The `getting started (#890)` tests in the docs guard: Install's numbered steps are four, each showing its line (`npm install -g github:vertuoza/vertuo-omni-loop`, `claude plugin install omni@omni-loop`, `omni signin`, `/omni:ask on`); Install comes right after Getting started, before Join a team; and the lines that install `omni` and the skills appear on Install only. All three fail on main; four hand mutations of the fixed pages (step 4's line changed, steps 3 and 4 swapped, the old page order, the npm line copied onto Join a team) each fail one of them.

## Mutation

not set here
