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

- **The proof** (PRD 1972): step 7 and step 8 keep the reproduction's output in `red.txt` and
  `green.txt` (a component bug also films its story to `before.webm` and `after.webm`), and step 12
  runs `omni bug film` then `omni proof push --kind bug` before the PR, whose body gains `## Proof`
  right after **What was wrong**. A GIF not made opens the PR as a draft with
  `GIF not produced - <reason>`. Its tests are `kit/test/bug-fix-proof.test.ts`.
- **The proof, guarded** (PRD 2100): step 12 writes the PR's body to a file and runs
  `omni bug <n> --body-file <file>` until `ok` before `/omni:pr` opens the PR with that same file; a
  pinned omni that prints `unknown flag --body-file` gets `omni bug <n>` without it. Clips that fail
  (`ffmpeg not found` included) fall back to the text GIF of `red.txt` and `green.txt`, with
  `Storybook not filmed - <reason>`, so the reason table has no `ffmpeg not found` row; a component
  bug's `## Proof` gains the `Clips: [before](<link>) · [after](<link>)` line, the links being what
  `omni proof push --kind bug` prints after the GIF's.
- **Stop rule 3 names the fix** (PRD 2100): when the reproduction passes before any fix, step 7 finds
  the merged pull request that fixed the bug and the issue comment says `Fixed by #<n>` (or
  `Fixed by <PR URL>`) only for a candidate proven red at its merge's first parent and green at its
  merge, `Maybe: #<n>` lines otherwise, and the skill never closes the issue. `/omni:mega-bug-fix`
  writes the same comment in the plan repository.

- **Signing**, as every kit skill: the issue and the PR end with `omni sign footer`, every commit
  with `omni sign trailer`.
- The hand-off: "Review the PR and merge it if it is right." **A person merges.**
- **The fix's page** (PRD 627): after the push, the skill follows `/omni:dossier-push <n> --kind bug`
  and the hand-off prints the page's link beside the PR.
- **`briefing-text`** (PRD 1793): **A change to a law**'s rule table gains the row for a change to
  the briefing's files, raised as a change to a rule is; its test is
  `kit/test/briefing-text-skills.test.ts`.
- **The smoke level** (PRD 2275): a passing reproduction has a third reading, this level cannot see
  it, and step 7 moves up to `setup` then `commands.smoke`; stop rule 7 stops with no runnable smoke
  (rule 6 is PRD 2255's `--answers` stop); stops 3, 4 and 7 keep the reproduction on a pushed branch; a `critical` stop opens its comment with
  `> [!CAUTION]`; step 9's guard is the smoke run by CI; the record's **Reproduction** names its
  **Level**. Its tests are `kit/test/bug-fix-smoke.test.ts`.
- **The triage at once, and production read against releases** (PRD 2275): step 3 posts the triage
  with **Reproduction** and **Branch** `pending`, steps 5 and 7 edit those lines in place by the
  marker, a `Production:` line gives the deployed version and the first occurrence in UTC matched
  against releases and deployments, and a release range is regression evidence.
