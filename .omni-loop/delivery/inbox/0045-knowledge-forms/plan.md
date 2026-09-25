# Knowledge forms — the playbook, and /omni:terraform — plan

**PRD:** #45 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/knowledge-forms` →
`main` (`Closes #45`) · **Sub-PRs:** `feat/knowledge-forms--<slice>` → the feature branch
(`Part of #45`).

Any decision taken without asking is an outbox item. The spec's forms table (slot ids, required slots,
order) is the contract between s1's parser, s2's templates and s4's commands; a slice that needs to change
it raises an outbox item instead of editing another slice's files.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A form is a typed thing: `paths.playbook` and `branches.terraform` exist in the config, the layout names the front door, the playbook folder and each form's file, and the one parser reads a form's front matter, slots, `See:` lines and holes, then resolves each slot from pointer, repository section or a given kit default, filling `{config:<key>}` | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/lib/layout.mjs` `kit/lib/layout.test.mjs` `kit/lib/playbook/forms` `kit/lib/playbook/resolve` `kit/test/fixture.mjs` | — | 1 |
| s2 | The kit defaults: the thirteen form templates and the front door README, ported from vertuo-ai-domain with every repository literal removed, loadable from source and bundled into `omni.mjs` | `kit/templates/` `kit/lib/playbook/templates` `kit/build.mjs` `kit/test/no-literals.test.mjs` `kit/porting/templates--` | s1 | 2 |
| s3 | The outbox knows the playbook: a settled `Became: playbook/<form>#<slot>` resolves in `omni check outbox`, and decision coverage no longer counts the ADR folder's `README.md` as law text | `kit/lib/outbox/check-outbox` `kit/lib/outbox/decision-coverage` | s1 | 2 |
| s4 | `omni kb init`, `omni kb show`, `omni kb status` and `omni check kb` inside `check all`; `omni kb show decisions` reads the ADR folder live; the bundle alone prints the kit defaults | `kit/bin/commands/kb.mjs` `kit/bin/commands/index.mjs` `kit/bin/commands/check.mjs` `kit/bin/kb.test.mjs` `kit/bin/omni.test.mjs` `kit/lib/playbook/init` `kit/lib/playbook/check-playbook` `kit/lib/playbook/decisions` `kit/lib/playbook/status` `kit/test/profiles.test.mjs` `kit/test/bundle.test.mjs` | s1, s2 | 3 |
| s5 | `/omni:terraform`: survey, point before writing, fill from evidence, run each command green, leave holes, propose config, one docs-only pull request; `--refresh` | `kit/plugin/skills/terraform/` | s4 | 4 |
| s6 | The seven skills read their forms at the steps the spec's wiring table gives; `/omni:yolo` prints the open questions once; `/omni:yolo-fix` writes a process lesson back as a playbook section; `.omni-loop/repo.md` is retired | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/do-work/` `kit/plugin/skills/plan/` `kit/plugin/skills/pr/` `kit/plugin/skills/wave/` `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/porting/plugin--` | s4 | 4 |
| s7 | This repository terraformed: its forms filled from evidence, pointed or holding holes; the config proposals applied; a session-start hook prints its briefing | `.omni-loop/knowledge/README.md` `.omni-loop/knowledge/playbook/` `.omni-loop/knowledge/adr/README.md` `.omni-loop/config.yml` `.claude/settings.json` | s3, s5, s6 | 5 |

No prefix is shared. `kit/lib/playbook/` is split by file prefix: `forms` and `resolve` are s1's,
`templates` is s2's, and `init`, `check-playbook`, `decisions` and `status` are s4's. `kit/porting/` is
split the same way: `templates--` records are s2's, `plugin--` records are s6's. `kit/test/fixture.mjs`
is s1's alone: a later slice that needs another fixture helper writes it in its own test file. The
command registry (`kit/bin/commands/index.mjs`) and `check all` (`kit/bin/commands/check.mjs`) are
touched by s4 only, so no other slice registers anything. s5 and s6 both follow s4 because
`kit/test/plugin.test.mjs` refuses a skill that names an `omni` command the CLI lacks. s7 follows s3
because it writes `adr/README.md`, which decision coverage would otherwise count as law text.

## Per slice: done when

- **s1:**
  - `omni config` prints `paths.playbook: .omni-loop/knowledge/playbook` and
    `branches.terraform: docs/omni-terraform` when both are unset; a key the schema does not hold is
    still an error. The config tests say so.
  - The layout gives the front door (the playbook folder's parent), the playbook folder, and each form's
    file, with the decisions form at `adr/README.md` under the front door.
  - Parser tests: front matter holding exactly the allowed keys (`index` on a pointer form only) parses;
    another key, a missing key or a `state` outside `blank | filled | pointer` is refused with the file
    named; slots are read in order with their id, required flag, `by` and `verified`; a section body is
    read as text, a `See:` pointer, empty, or holes.
  - Resolver tests: one per row of the spec's resolution table, with the kit default passed in;
    `{config:<key>}` is filled from the fixture config, and an unknown key is left visible and reported.
- **s2:**
  - Thirteen templates and the front door README template exist under `kit/templates/`; each form
    template parses with s1's parser and declares exactly the slots of the spec's forms table, required as
    marked, in that order.
  - A slot carries a kit default wherever the vertuo-ai-domain page it is modelled on holds doctrine; each
    template carries a provenance line pinned to `vertuo-ai-domain@db67fd9da`, and
    `kit/porting/templates--<form>.md` lists every literal removed.
  - `kit/test/no-literals.test.mjs` scans `kit/templates/` and passes.
  - A test builds the bundle and finds each template's default text inside `kit/dist/omni.mjs`; from
    source, the same loader returns the same text.
- **s3:**
  - `check-outbox` tests: `Became: playbook/testing#never` passes when that slot exists and is not
    blank, and fails naming the settled file when the form, the slot or its body is missing; ADR and
    knowledge ids resolve as before.
  - `decision-coverage` tests: a change to `<adrDir>/README.md` is not law text; a change to
    `<adrDir>/0002-x.md` still is.
- **s4:**
  - Acceptance criteria 1 to 6, each a test through `main()` on a fixture repository.
  - `omni kb status --json` lists each form with its state, open questions, stale evidence and source.
  - `check all` for the three profiles in `kit/test/profiles.test.mjs` prints the `kb` line and stays
    green.
  - `pnpm test` is green.
- **s5:**
  - `kit/plugin/skills/terraform/SKILL.md` has a name and a description; `kit/test/plugin.test.mjs` and
    `kit/test/no-literals.test.mjs` are green (candidate pages are found by name, never by a fixed path).
  - It states the seven steps of the spec, the `--refresh` rule and the `by: human` rule, and names
    `omni config`, `omni kb init`, `omni kb status`, `omni kb show` and `omni check kb`.
  - Its pull request follows `/omni:pr`'s standalone kind on `branches.terraform`, with every hole as a
    checkbox in the body.
- **s6:**
  - Each of the seven SKILL.md files calls `omni kb show <form>` for the forms the spec's wiring table
    gives it, at that step; step 0 of each prints `briefing` (acceptance criterion 9).
  - `/omni:yolo` runs `omni kb status` once at its start, prints the open questions and carries on.
  - `/omni:yolo-fix`'s write-back names `Became: playbook/<form>#<slot>` for a process lesson.
  - `/omni:do-work` no longer names `.omni-loop/repo.md`; `kit/porting/plugin--<skill>.md` records each
    change.
  - `kit/test/plugin.test.mjs` and `kit/test/no-literals.test.mjs` are green.
- **s7:**
  - `omni kb init`, then `/omni:terraform`'s steps on this repository, run as this slice: the output is
    this sub-PR, not a standalone pull request.
  - `omni check kb` reports no errors; the forms match the "two repositories" column of the
    before/after page, or the sub-PR body says why each one differs.
  - Every command a form names ran green; every open question is a checkbox on the feature PR.
  - `paths.context` names no missing file; `.claude/settings.json` holds a session-start hook that runs
    `node .omni-loop/bin/omni.mjs kb show briefing`.
  - `omni check all` is green.
- **Whole PRD:** `omni status 45` is green, or red only for items a person must answer, and `omni ship 45`
  has run on the feature branch before the feature PR is marked ready.
