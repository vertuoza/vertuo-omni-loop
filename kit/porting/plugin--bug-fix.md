# `kit/plugin/skills/bug-fix/SKILL.md` (`/omni:bug-fix`)

Source: `.claude/skills/vertuo-fix-bug/SKILL.md` @ `vertuo-ai-domain@47a1a194a` (its last change on
origin/main when PRD 556 was built). Shaped like `/omni:visual-fix` (PRD 541): frontmatter,
**Signing**, the input table, Step 0, the boundary and its stop, numbered steps, the hand-off and
**Never**. The flow, the boundary, the five stop rules, the triage comment, the record and the PR's
Bug section are PRD 556's spec, carried whole.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 (`gh auth status` only) | `omni config`, stop in one line when it fails; `omni kb show briefing`, `bug-fixing`, `testing` |
| `origin`, `main` | `repo.remote`, `repo.defaultBranch` |
| `fix/<n>-<slug>`, `.claude/worktrees/fix-<n>` | `branches.fix` with `{topic}` = `<n>-<slug>`, under `worktrees` |
| `gh label create risk:<level> … --force`, `regression` | `labels.riskCritical`, `labels.riskHigh`, `labels.riskMedium`, `labels.riskLow`, `labels.regression`, created by `omni init`, and by the skill only under `/omni:pr`'s **Labels** rules (`labels.autoCreate`) |
| an issue labelled `bug` | `labels.bug`; the skill opens the issue itself from a description |
| `<!-- vertuo-fix-bug:triage -->` | `<!-- omni-bug:triage -->` |
| `docs/glossary.md` | `paths.glossary`, else `paths.knowledge` and `paths.context` |
| `apps/e2e/features/<domain>/<behaviour>.feature`, the bddgen/Playwright run, `E2E_*` variables | an acceptance scenario under `acceptance.dir`, run by `acceptance.run`, when `acceptance.enabled`; otherwise a test at the level `omni kb show testing` picks |
| `pnpm mutation:changed` | `commands.mutation`, `Mutation: not set here` when null |
| `pnpm quality:preflight` | `commands.preflight` |
| three attempts | `limits.attempts` |
| `vertuo-do-work`, `vertuo-pull-request` | the steps themselves, and `/omni:pr` |

## Dropped

- **The surfaces:** the browser harness, the API acceptance worlds, QA and the preview, the
  acceptance gate's comment (red on QA, green on the preview), the advisor rule, handles and
  locators, the feature-glossary, feature-tags and test-handles guards, the Gherkin shape and its
  tags. The kit knows no harness; `acceptance.*` is the only one it names.
- **Stop rule 4, "green on QA in the gate":** there is no gate here. Upstream's rules 3 and 4
  collapse into rule 3 (the reproduction passes before the fix).
- **ADR 0062, ADR 0063, `docs/agents/*` pages, the model tiers and "pair with":** upstream history
  and upstream pages; the playbook forms take their place.

## Changed

- **The input** takes a description as well as an issue: from a description the skill opens its
  own `Bug: <line>` issue, signed. An issue URL must name `repo.slug`.
- **Stop rule 4 is the boundary** (a product decision not settled, `risk.storedShape` or
  `risk.sharedContract`, a new screen, route or API), with the `/omni:brainstorm` line, as
  `/omni:visual-fix`'s stop.
- **Stop rule 5** leaves the PR draft labelled `labels.needsFix`, and comments on the issue.
- **Red that cannot run here** says `Red not proven here — <why>; CI is the proof` and carries on.
- **The record,** `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, and its proof, `omni bug <n>`, are
  new; the Bug section gains a **Record:** line.
- **The triage comment** gains a `Kind:` line, and names `Reproduction:` instead of `Scenario:`.

## Added

- **Signing**, as every kit skill: the issue and the PR end with `omni sign footer`, every commit
  with `omni sign trailer`.
- The hand-off: "Review the PR and merge it if it is right." **A person merges.**
- **The fix's page** (PRD 627): after the push, the skill follows `/omni:dossier-push <n> --kind bug`
  and the hand-off prints the page's link beside the PR.
