# A joke around every outbox question — plan

**PRD:** #50 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/question-intros` →
`main` (`Closes #50`) · **Sub-PRs:** `feat/question-intros--<slice>` → the feature branch
(`Part of #50`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.
No item raised while building this PRD carries the new intro or punchline sections (spec decision 7): the
omni-loop App reads this branch with the kit on `main`, which would refuse them.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An outbox item may carry an intro and a punchline: the parser accepts the two sections together, right after the plain-words sections; the renderer writes them; `omni item new` takes `introFun` and `punchlineFun` and refuses a line over 120 characters or not in plain words; `omni check outbox` holds open items to the same rules | `kit/lib/outbox/outbox.` `kit/lib/outbox/check-outbox` `kit/lib/policy/outbox-policy` `kit/bin/commands/item.mjs` `kit/bin/item.test.mjs` `kit/porting/outbox--outbox.md` `kit/porting/outbox--check-outbox.md` `kit/porting/policy--outbox-policy.md` `kit/porting/bin--commands.md` `kit/dist/omni.mjs` | — | 1 |
| s2 | The pull request's outbox comment shows the intro under each open or adopted question's heading and the punchline after its question, taken from the item or, when it has none, from the kit's pool by a stable hash of its id | `kit/lib/outbox/comment` `kit/lib/outbox/banter` `kit/porting/outbox--comment.md` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | `/omni:do-work` writes both lines, under the spec's rules, for every item it raises | `kit/plugin/skills/do-work/` `kit/porting/plugin--do-work.md` | s1 | 2 |

**Shared ground.** `kit/dist/omni.mjs` is declared by s1 and s2: each rebuilds it with `pnpm kit:build`
and commits it, because `kit/test/dist.test.mjs` fails otherwise. Their waves keep them apart. s3 changes
only skill prose, which is not bundled, so it shares wave 2 with s2. `kit/lib/outbox/outbox.` names only
`outbox.mjs` and `outbox.test.mjs`, so it stays clear of the other `kit/lib/outbox/` files. s3 follows s1
because it names fields `omni item new` must already accept.

**Across PRDs.** PRD 45 (knowledge forms) also changes `kit/lib/outbox/check-outbox`,
`kit/plugin/skills/do-work/` and `kit/dist/omni.mjs`, on its own feature branch. Whichever PRD ships
second merges `main` into its feature branch, resolves those files, and rebuilds the bundle.

## Per slice: done when

- **s1:**
  - Acceptance criteria 1 to 3: parser tests for the pair, one without the other, the pair out of place,
    and neither; `omni item new` through `main()` with and without the two fields, with `--adopt`, and
    with a line over 120 characters or holding a backticked name (exit 2, nothing written, the field
    named); `checkItemText` on an open item whose line breaks a rule.
  - Settled entries written before this PRD still parse (a fixture ledger).
  - The porting records list every change to a ported file.
  - `kit/dist/omni.mjs` is rebuilt and committed; `pnpm test` is green.
- **s2:**
  - Acceptance criteria 4 and 5: `formatOutboxPrComment` tests for an open question with options, one
    with person steps, one with the older decision line, and an adopted one; each reads separator,
    heading, intro, quoted question, punchline, then the rest. An item without the pair gets pool lines;
    two renders are identical; two ids hashing to the same line get different lines; adding a question
    leaves the earlier ones' lines unchanged.
  - Acceptance criterion 6: a test lists the game words and finds none in the pool;
    `kit/test/no-literals.test.mjs` passes.
  - The Answered section, the PRD issue's comment and the Slack note are unchanged (their existing tests
    pass untouched).
  - `kit/dist/omni.mjs` is rebuilt and committed; `pnpm test` is green.
- **s3:**
  - Acceptance criterion 7: `/omni:do-work`'s step that raises an item names `introFun` and
    `punchlineFun` among the fields, with the rules (one sentence, at most 120 characters, plain words,
    about the question, never about a person or a team, never mocking whoever answers), and says the
    lines are written for every item.
  - The SKILL.md names no game word, since the kit never mentions the game.
  - `kit/test/plugin.test.mjs` and `kit/test/no-literals.test.mjs` are green.
- **Whole PRD:** acceptance criterion 8; `omni status 50` is green, or red only for items a person must
  answer, and `omni ship 50` has run on the feature branch before the feature PR is marked ready.
