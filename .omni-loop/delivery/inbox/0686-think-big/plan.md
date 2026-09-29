# Plan: /omni:think-big, a studio of agents that explores vast concepts before /omni:brainstorm

PRD #686, spec beside this plan (`spec.md`). The feature branch `feat/think-big` merges into `main`
through the feature PR, whose body says `Closes #686`. Each slice is a sub-PR from
`feat/think-big--<slice>` into the feature branch, whose body says `Part of #686`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A concept can be proven. Covers: `labels.concept` (default `omni:concept`) and `branches.concept` (default `docs/concept-{topic}`) in the config, and the label in `omni init`'s list; the layout naming `<paths.delivery>/inbox/concepts`; the `concept.md` parser and the `omni concept <n>` verdict in `kit/lib/concept/`; the `omni concept <n> [--base <ref>]` verb printing `ok` or `not ok` with one line per failed check, exit `0`, `1` or `2`; the layout, status, inbox check and phase-0 policy shown to skip a concepts folder and to take a `concept.md` edit as a document; the verb's help entry; the rebuilt bundle | `kit/lib/config` `kit/lib/init/labels` `kit/bin/init.test.mjs` `kit/lib/layout` `kit/lib/concept/` `kit/bin/commands/concept.mjs` `kit/bin/commands/index.mjs` `kit/bin/concept.test.mjs` `kit/lib/status/facts.test.mjs` `kit/lib/inbox/check-inbox.test.mjs` `kit/lib/policy/phase-0.test.mjs` `kit/lib/help/` `apps/galaxy/src/docs/` `kit/dist/omni.mjs` | — | 1 |
| s2 | A person can run `/omni:think-big`. Covers: the skill with the spec's gate, fuel, studio and role cards, boards, rounds, crown, record and hand-off, naming every label, branch and path through `omni config`; its help entry in *Start a change*, and `/omni:brainstorm`'s usage gaining `--concept <n> <area>`; the idea stage's line naming it; the docs pages' skill lists and "other skills run it" lists; its row and section in the guide's use-cases page and its row in the loop page's table; the delivery README's paragraph on `inbox/concepts/`; plugin assertions on its hand-off; the rebuilt bundle | `kit/plugin/skills/think-big/` `kit/lib/help/` `apps/galaxy/src/docs/` `docs/guide/` `.omni-loop/delivery/README.md` `kit/test/plugin.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | `/omni:brainstorm` starts from a concept's area. Covers: the `--concept <n> <area>` input read from the default branch, with its three refusals (concept not in the inbox, unknown area, area with a PRD); step 1 writing back the area's brief, the vision and the verdict; the before/after page's "after" from the area's screens; the PRD issue naming the concept and area; the area's `PRD` cell filled in the PRD's commit and carried by the phase-0 PR; the reverse door to `/omni:think-big`; plain runs unchanged | `kit/plugin/skills/brainstorm/` `kit/test/brainstorm-concept.test.mjs` | s1 | 2 |
| s4 | Seen working. Covers: one live run of `/omni:think-big` on a real vast brief in this repository, ending in its own `omni:concept` PR into `main`; one live gate on a feature-sized line and one on a tweak; once a person has merged that concept PR, `/omni:brainstorm --concept <n> <wedge>` up to its write-back and one refused unknown area; all recorded in `live-run.md` beside this plan, with the links | `.omni-loop/delivery/inbox/0686-think-big/live-run.md` | s2, s3 | 3 |

**Shared ground.** Three prefixes are declared by more than one slice, and the waves keep them
apart:

- `kit/lib/help/` is declared by s1 (the `omni concept` verb's entry, and the command count its
  tests hold, wave 1) and s2 (the `/omni:think-big` entry, the skill count moving from 20 to 21,
  *Start a change*, the idea stage's line and `/omni:brainstorm`'s usage, wave 2). The help tests
  demand an entry for every verb and every skill folder, so each slice adds the entry for what it
  adds.
- `apps/galaxy/src/docs/` is declared by s1 (a command the docs pages list, wave 1) and s2 (the
  skill overview, the `start` group, and the "other skills run it" list of `/omni:dossier-open`,
  since `/omni:think-big` runs it, wave 2).
- `kit/dist/omni.mjs` is declared by s1 (wave 1) and s2 (wave 2): each changes the kit's source and
  rebuilds the bundle with the kit's build command from the merged source, never by hand.

s2 and s3 share a wave and no ground. `kit/test/plugin.test.mjs` holds the brainstorm's existing
assertions on its steps 0, 2, 7, 9 and 10; s3 keeps every string they read and puts its own
assertions in a new file, `kit/test/brainstorm-concept.test.mjs`, so `kit/test/plugin.test.mjs`
stays s2's alone.

s4's own `omni:concept` PR goes into `main`, not into the feature branch, and a person merges it
like any concept. Only `live-run.md` is s4's sub-PR.

## Per slice: done when

**s1**

- `omni config` prints `labels.concept: omni:concept` and `branches.concept: docs/concept-{topic}`,
  and a config that sets either prints the override (`kit/lib/config.test.mjs`).
- `omni init`'s label list holds `concept`, with a colour of its own and a description starting
  `Omni Loop: ` (`kit/lib/init/labels.test.mjs`), and `kit/bin/init.test.mjs` shows it created.
- The layout names `<paths.delivery>/inbox/concepts`, and a fixture inbox holding
  `concepts/0712-x/` adds no PRD to the layout's folders, its spec files or `whereIs`
  (`kit/lib/layout.test.mjs`), to `omni status`'s facts (`kit/lib/status/facts.test.mjs`), or to
  `omni check inbox`, which stays green (`kit/lib/inbox/check-inbox.test.mjs`).
- A phase-0 change set that also edits `<paths.delivery>/inbox/concepts/0712-x/concept.md` is
  docs-only and `ok` (`kit/lib/policy/phase-0.test.mjs`).
- The parser accepts a valid `concept.md` and refuses by name each invalid case the spec's test
  seams list (`kit/lib/concept/*.test.mjs`).
- On a fixture repository with a concept branch, `omni concept <n>` prints `ok` and exits `0` for a
  signed commit carrying a valid folder; it prints `not ok` and exits `1`, naming only that failure,
  for each failure the spec's test seams list; a followable link and a base64 SVG are allowed; it
  exits `2` outside an installed repository (`kit/bin/concept.test.mjs`).
- The help lists `omni concept`, and the help and docs tests are green.
- `kit/test/dist.test.mjs`, `kit/test/no-literals.test.mjs` and `kit/test/no-game-words.test.mjs`
  are green.

**s2**

- `kit/plugin/skills/think-big/SKILL.md` carries the spec's steps 0 to 7, the studio with its role
  cards, the "go crazy" dial, the verdict rubric, the boards and their one question per round, the
  record and its gate, and the hand-off ending on the wedge's `/omni:brainstorm --concept` line; it
  names no label, branch or path literally: `kit/test/plugin.test.mjs` and
  `kit/test/no-literals.test.mjs` are green.
- `kit/test/plugin.test.mjs` asserts that the skill's step 0 follows `/omni:dossier-open` after the
  briefing, that its gate names the `/omni:visual-fix` and `/omni:brainstorm` lines, that it never
  merges, and that its hand-off's last line is a `/omni:brainstorm --concept` command.
- `/omni:help` lists `/omni:think-big` under *Start a change* with one line on when to use it,
  `/omni:brainstorm`'s usage names `--concept <n> <area>`, and the idea stage's line names both;
  the help tests are green with 21 skills.
- The docs pages list the skill, and `/omni:dossier-open`'s "other skills run it" names it
  (`apps/galaxy/src/docs/*.test.ts` green).
- `docs/guide/use-cases.md`'s table has a row for a vast idea, linked to its own section, which
  shows the command, the concept it leaves in the inbox and the brainstorm per area; the loop page's
  skill table lists it; `apps/galaxy/src/docs/guide.test.ts` is green.
- The delivery README has one paragraph on `inbox/concepts/<nnnn>-<slug>/`.

**s3**

- `kit/plugin/skills/brainstorm/SKILL.md` takes `--concept <n> <area>`: it reads `concept.md` from
  `<remote>/<repo.defaultBranch>`, and stops with its own line on a concept not in the inbox, on an
  unknown area (naming the area ids) and on an area whose `PRD` cell is filled (naming that PRD).
- With `--concept`, step 1 writes back the area's brief, the vision and the verdict before its
  first question; step 2's issue paragraph names the concept and the area; step 5 starts the
  "after" from the area's screens in `vision.html`, as static mockups; step 7 fills the area's `PRD`
  cell in the same commit as the PRD's folder; step 9 carries `concept.md` into the phase-0 PR.
- A plain brainstorm that flags several independent subsystems also offers the
  `/omni:think-big '<line>'` line.
- Every string `kit/test/plugin.test.mjs` reads in the brainstorm is still there, and it is green.
- `kit/test/brainstorm-concept.test.mjs` asserts each point above against the SKILL.md text.

**s4**

- A live run on a real vast brief stated the scale and the kind, showed a round-1 board of six to
  eight concepts and at least one deeper round of clickable prototypes, ran a debate in which
  panelists answered each other by name, crowned the person's pick with a vision tour and an edited
  area map, and opened one `omni:concept` PR whose `omni concept <n>` printed `ok`.
- A live gate on a feature-sized line said so and offered `/omni:brainstorm` or a lite run; one on
  a tweak gave the `/omni:visual-fix` line and wrote nothing.
- Once a person merged the concept PR, `/omni:brainstorm --concept <n> <wedge>` wrote back the
  wedge's brief and the vision before its first question, and `/omni:brainstorm --concept <n> nope`
  stopped naming the area ids; or `live-run.md` says the concept PR was not merged and these were
  not run.
- `live-run.md` links the issues and PRs, and says what was seen and what was not.
