# `kit/templates/playbook/bug-fixing.md`

Source: `docs/agents/bug-fixing.md` @ `vertuo-ai-domain@db67fd9da`. The kit default of the
bug-fixing form: slots `steps`, `guard`, in the spec's order.

## Read from config instead of hard-coded

Nothing: the kit has no bug-fixing skill yet (`/omni:fix-bug` is out of the spec's scope), so no
config key names a bug's label, branch or scenario folder.

## Dropped (repository literals)

- **The skill and its decisions:** `/vertuo-fix-bug <issue>`, ADR 0062, ADR 0063, the link to the
  acceptance gate in `./bdd-acceptance.md`.
- **The two surfaces:** `apps/e2e`, `apps/<app>/src/acceptance`, `apps/vertuoza-rest-api`,
  `apps/vertuo-ai-api`, QA and the preview, the merge base and the branch.
- **Where a bug scenario lives:** `src/acceptance/<behaviour>.feature`,
  `apps/e2e/features/<domain>/<behaviour>.feature`, `folders`, `fragments`, `identity-access`,
  `agent-chat`, `evaluation`, `prompts-and-rollout`, `customer-journey`, the link to
  `../glossary.md`.
- **The advisor rule, whole:** the scripted world, `apps/vertuo-ai-api/src/acceptance`,
  `apps/prompt-lab/src/conduct/checks/`, the Turn Ledger, `apps/e2e/browser-keepers.json`,
  `pnpm check:browser-keepers`.
- **Tags:** `@e2e`, `@bug:<n>`, `@critical` / `@high` / `@medium` / `@low`, `@regression`,
  `scripts/check-feature-tags.mjs`, `pnpm check:feature-tags`, `pnpm check`. Kept: the four risk
  levels and what each means, and "a regression is a claim with evidence" (slot `steps`, 2).
- **The issue's triage comment:** `<!-- vertuo-fix-bug:triage -->`, its fields, the `risk:<level>`
  and `regression` labels, and the example (#214, `6816a2ad`, `8cdf8325`, `169997a2`,
  `fix/232-conversation-rail-desktop`).
- **The ten steps' commands:** `gh run view --log-failed`, `gh run download`, `error-context.md`,
  `git worktree add .claude/worktrees/fix-<n> -b fix/<n>-<slug> origin/main`,
  `pnpm check:feature-glossary`, `pnpm check:test-handles`, `apps/e2e/steps/`, `smoke-world.ts`,
  `E2E_BASE_URL`, `E2E_DOOR_SECRET`, `E2E_TENANT_*`, `pnpm --filter @vertuo-ai/e2e exec … bddgen …
  playwright test`, the "Red not proven locally" line, the links to `vertuo-do-work` and
  `vertuo-pull-request`, the template's **Bug** section, `Closes #<n>`, `gh pr checks --watch`.
  Kept, in words: seven steps (the upstream ten, with writing the scenario and proving it red as
  one, the mutation check folded into the guard, and opening the pull request and reporting as
  one), and "nothing is reported as proven that was not run" (slot `steps`).
- **Mutation testing:** Stryker, StrykerJS, `pnpm mutation:changed [--base <ref>]`,
  `merge-base..HEAD`, the `Mutation:` PR line. Kept: a regression test that lets small mutations of
  the fixed lines pass is not guarding the fix (slot `guard`).
- **The commands table**, **Stop rules**' surface names (QA, the gate) and **the worked example**
  (#232, the vanished rail, `libs/vertuo-ai-agent-ui`, `index.css`, `@source`, `md:flex`).

## Changed

- Step 1's "the skill posts a triage comment saying so and points to CI triage" reads "say so on the
  report and follow the CI page instead".
- Step 7's "Guard-sized (a `scripts/check-*.mjs`, a lint rule, a unit test)" reads "(a check script,
  a lint rule, a unit test)"; `Guard: none — <reason>` is kept word for word (slot `guard`).

## Added

- The opener, "Use this page when a reported bug becomes a pull request": the upstream page opens
  with a sentence of its own.
- The spec's slot markers and headings.
