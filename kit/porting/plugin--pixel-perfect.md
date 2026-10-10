# `kit/plugin/skills/pixel-perfect/` (`/omni:pixel-perfect`)

Source: `pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7`, the skill at
`.claude/skills/impeccable/` (version 4.5.2), Apache License 2.0, copyright 2025 Paul Bakaus;
impeccable started from Anthropic's frontend-design skill. Imported by PRD 1369, slice s3. The
attribution and the license text are in `kit/NOTICE.md`; every imported file opens on an
`Imported from … and modified` line naming its upstream path.

What came over, and where:

| upstream | here |
|---|---|
| `SKILL.md` | `SKILL.md` |
| `reference/critique.md` | `reference/critique.md` (`critique`) |
| `reference/audit.md` | `reference/audit.md` (`audit`) |
| `reference/polish.md` | `reference/polish.md` (`polish`) |
| `reference/harden.md` | `reference/harden.md` (`harden`) |
| `reference/typeset.md` | `reference/typeset.md` (`typeset`) |
| `reference/layout.md` | `reference/layout.md` (`layout`) |
| `reference/adapt.md` | `reference/adapt.md` (`adapt`) |
| `reference/clarify.md` | `reference/clarify.md` (`clarify`) |
| `reference/craft-floor.md` | `reference/craft-floor.md` (`craft-floor`) |
| none | `reference/review.md` (`review`): the kit's own, written for the loop |

A later import is a PRD of its own: nothing syncs these files with impeccable's releases.

## Left out

- **The taste commands:** `bolder`, `quieter`, `delight`, `overdrive`, `colorize`, `animate`, and
  `distill`. They push a screen toward a taste; here the product's form sets the direction.
- **`onboard`, `optimize`, `shape` and `craft`** (and `craft`'s new-work flow, `new-work.md`, with
  the `mode-*.md`, `operate.md`, `region-map.md`, `visualize.md` and `component-review.md` it reads).
  A new surface or a redesign is a product decision, which starts at `/omni:brainstorm`.
- **`init`, `document`, `extract` and `teach`.** `PRODUCT.md` and `DESIGN.md` are replaced by the
  playbook's `design` form, which `/omni:invade` fills from evidence.
- **The live browser mode and `generate`** (`live.md`, `live-setup.md`, `generate.md`, and each
  reference's "Live-mode signature params" section).
- **The engine:** the `scripts/impeccable` launcher and its binary, `impeccable context`,
  `impeccable detect`, `critique-storage` (the `.impeccable/critique/` snapshots, their trend line
  and their closing by polish), `live-server`, `pin`, the `hooks` command and the design hook
  (`hooks.md`), `doctor` and its drift report, `routing.md`.
- **The native references:** `ios.md`, `android.md`, `audit.native.md`, `adapt.native.md`, and the
  `degraded/` folder. A native screen follows its platform's own guidelines; the imported
  references are for the web. impeccable's own `NOTICE.md` credits only these files (to ehmo's
  platform-design-skills, MIT), so nothing of that notice applies here.
- **The per-harness copies** of the skill in impeccable's other folders.
- **The frontmatter fields** `version`, `user-invocable`, `argument-hint` and `license`: a kit skill
  carries `name` and `description` only. The license is said in the provenance line and the NOTICE.

## Changed

Across every file:

| upstream | here |
|---|---|
| `scripts/impeccable context`, `PRODUCT.md`, `DESIGN.md`, the surface brief | `omni config design.enabled` first (off: one line saying how to turn it on, then stop), then `omni kb show design`, and the file a section points at |
| "the brief wins", "a pinned brief overrides anything here" | **The product wins**: the form's `product`, `system` and `deliberate` override the craft floor and the refuse list. `omni kb show` does not print a form's opener, so `SKILL.md` states the precedence itself |
| `impeccable detect` and the design hook | `commands.design`, run when the repository sets it, else `Design lint: not set here`; never a hook, never an install |
| open-ended self-QA, "verify in bounded passes" | one look, one batch of fixes, at most one confirming look, for every command |
| refinements that edit freely | fixes stay inside the slice's territory when a skill follows the command; anything else is an outbox item. Typed by a person, edits stay in the target they named |
| `/impeccable <command>` | `/omni:pixel-perfect <command>`, and only the eight imported commands are ever suggested |
| "sub-agent / Task tool", "AskUserQuestion", "browser automation", `CLAUDE.md` | the kit's own words: an isolated helper agent when the session can start one, the session's question tool, the session's browser tool, the design form |
| "Ask before changing claims" | typed by a person, ask; followed by `review`, record it: a skill run asks nothing |
| "route through new-work and replace DESIGN.md" | not this skill's: name `/omni:brainstorm` |
| "desktop and mobile" | the widths of the form's `review` section, 390 and 1440 when it names none |
| American spelling in the parts rewritten | British, as the kit writes; untouched upstream text keeps its spelling |

File by file:

- **`SKILL.md`.** New opening, the kit's `omni` line, an input table (no argument shows the
  commands and asks, as upstream's routing menu did, without `routing.md`), **Step 0** (the flag,
  the form, the command's reference; the "launcher unavailable" fallback goes, since there is no
  launcher), **The product wins** (upstream's "How to design", with the precedence rewritten and
  redesign sent to `/omni:brainstorm`; the loaded-symbols rule kept as written), **Modes** (kept,
  shortened, the surface-brief persistence dropped), **Commands** (the imported eight, the kit's
  `review` and the shared craft floor, grouped review, finish, fix as the spec's table), and **Rules
  for every command** (bounded, territory, lint, looking, two views apart, asking, never blocking,
  the product's words), which replace upstream's "Core principles" ("go all out", "dream big and
  bold" are left out: the direction is the product's) and its Pin, Hooks and Doctor paragraphs.
- **`reference/craft-floor.md`.** The "pinned brief overrides" line becomes "the design form wins";
  the hook paragraph becomes `commands.design`. The eyebrow rule loses "a ban, not a default: no
  brief earns it back": the form's `deliberate` section may keep one, since the product wins. The
  system-display-face rule applies when the product's `system` names a face of its own (upstream's
  "source and self-host a face" would change the product's fonts). The neobrutalist rule keeps its
  sense, shortened. The closing "when torn between refined and committed, commit" becomes "the
  direction is the product's". Every check of **Verify** is kept.
- **`reference/critique.md`.** The hard invariants keep both assessments and their order, but the
  sub-agent rule is softened from "mandatory, or a degraded banner" to a method line: the session
  may have no helper agents, and a critique is never a failure. Assessment B is `commands.design`
  plus screenshots at the form's widths, in place of `impeccable detect` and the injected overlay
  (`detect.js`, the `[Human]` tab, the live server). **Persist the Snapshot**, the trend line and
  `.impeccable/critique/ignore.md` are gone. **Ask the User** runs only when a person typed the
  command, through the session's question tool, and never asks who the audience is (the form says).
  Project-specific personas come from the form's `product` section instead of `CLAUDE.md`'s
  "Design Context". The cognitive load, heuristics and personas reference material is kept as
  written.
- **`reference/audit.md`.** Native platforms stop the audit instead of routing to
  `audit.native.md`. Theming and implementation integrity read against the form's `system`; the
  detector is `commands.design`. A finding the form's `deliberate` section explains is never one;
  a P0 is the screen's severity, never the loop's. The "re-run audit" line is reworded. Every
  dimension and score band is kept.
- **`reference/polish.md`.** The "Additional context needed" line goes (the form is the context);
  `DESIGN.md` becomes the form's `system`; a fix at a level outside the territory is a decision; a
  prior critique is one run in this session rather than a `critique-storage` snapshot, and the
  snapshot's closing goes. Under `review` it is the one batch and the one confirming look. The
  triage order and the whole-path checklist are kept.
- **`reference/harden.md`.** A title and the design-form line added; the hand-off names
  `/omni:pixel-perfect polish`. The rest is kept as written.
- **`reference/typeset.md`** and **`reference/layout.md`.** A title and the design-form line added;
  the native line names the platform's guidelines instead of `ios.md` and `android.md`; identity
  replacement names `/omni:brainstorm` instead of `new-work.md`; the two assessments run as helper
  agents when the session can; the mechanical scan is `commands.design`; the live-mode section goes;
  the hand-off names `/omni:pixel-perfect polish`.
- **`reference/adapt.md`.** A title and the design-form line added; the context line reads the form
  and its widths; native platforms are out of scope instead of routing to `adapt.native.md`; the
  DevTools line names no tool; the hand-off names `/omni:pixel-perfect polish`. The responsive
  reference material is kept.
- **`reference/clarify.md`.** A title and the design-form line added; the context line reads the
  form's `product` section and the glossary; a factual or legal change is asked (typed) or recorded
  (under `review`); the hand-off names `/omni:pixel-perfect polish`.
- **`reference/review.md`** is new: the spec's section 4, as the steps `/omni:do-work` and
  `/omni:visual-fix` follow (critique, audit, lint, screenshots, polish), what it is given, what it
  does with what it did not fix, and the **Design review** section it reports.

Also new with the import: `kit/NOTICE.md` (the attribution and the Apache-2.0 text), the
`pixel-perfect` entry of `kit/lib/help/entries.ts` (`omni help pixel-perfect`), and its lines in
`kit/test/plugin.test.ts`.

## PRD #1407, slice s6 — the design memory

Not an import: kit-local changes, behind the same `design.enabled` flag, wired to the commands the
PRD built (`omni design screens`, `omni design touched`'s `screens:` line, `omni design words`,
`omni check design`) and to the design form's optional `language` slot, never restating them.

- **The `language` slot** is named wherever the skill lists the form's sections: the description,
  **Step 0**, **The product wins** (`product`, `system`, `deliberate` and `language` override the
  craft floor and the refuse list), `reference/craft-floor.md`, `reference/critique.md`, and the
  design-form line of `adapt`, `clarify`, `harden`, `layout` and `typeset`.
- **Step 0** gains **The library**: `omni design screens`, then the files and mockups of the
  screens the target is or touches. A locked screen is built as written and never redesigned; a
  draft is a starting point.
- **`lock`** (`reference/lock.md`, new, the kit's own): typed by a person only, never followed by a
  skill. It locks a library screen (`status: locked`, `locked-by`, `locked-on`, `quote`) or a law
  (its `🔒` line), with the person's own words verbatim and the GitHub login (the one ask mode gives
  with the answer, else `gh api user`), checks with `omni check design`, commits the one file
  signed, and pushes nothing. Its **Amend** records an owner's amendment line the same way.
- **Rules for every command** gains **Locked decisions**: no command edits a locked screen's body
  or a locked law, a fix on one goes back toward its mockup, and a change to one is the one high
  item.
- **`reference/review.md`** gains step 0, **The screens** (`omni design touched`'s `screens:` line,
  and a locked screen's file and mockup as the reference picture), the word pass in the critique
  (`omni design words`, exit 0, its findings critique findings), screenshots at each screen's
  routes, the comparison of a locked screen with its mock, polish that moves a locked screen only
  back toward its mock, the section **A change to a locked screen or law** (a high outbox item
  naming the screen, the change and who locked it; every other finding unchanged), and a
  **Locked** line in the report.
- **Left as it was:** `omni help pixel-perfect` (`kit/lib/help/`) does not yet name `lock`: that
  file is outside the slice's territory, and an outbox item says so.

### Tests

`kit/test/plugin.test.ts`: `lock` joins the command list of "the pixel-perfect skill in this
repository" (its help line excepted), the precedence test names `language`, and the block "the
design memory in pixel-perfect and do-work (PRD 1407)" holds each line above, with the rule that no
skill but pixel-perfect writes `status: locked` or a `🔒` line.
