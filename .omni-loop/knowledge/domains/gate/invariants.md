# Gate invariants

## N-PRODUCT-3

A raised item is graded by the same check the outbox gate uses before anything is written or adopted, so a bad option or a below-floor rank is refused at the source.

Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s13-01-item-new-json-shape-and-input-flag-rename, PRD #7
Enforced by: kit/bin/item.test.ts
Governs: ^kit/bin/commands/item\.ts$, ^kit/bin/item\.test\.ts$, ^kit/lib/outbox/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Kept id: moved from product, PRD 2346

## N-PRODUCT-4

The outbox gate reads its settings from the base branch, so a pull request can never change the rules it is judged by, such as the override label. From the pull request's head it reads only what is judged: the delivery folder, and the knowledge folder as data compared with the base's, so a law that loses its test is seen (PRD 1342).

Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s1-01-evaluate-reads-two-snapshots, PRD #28
Enforced by: apps/omni-app/src/outbox-check/outbox-check.test.ts
Governs: ^apps/omni-app/src/outbox-check/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29
Kept id: moved from product, PRD 2346

## N-PRODUCT-14

The terminal checks for a bug fix, a visual fix, coverage and the status gate compare the knowledge folder against the base branch's, so a law that loses its test is seen in the terminal just as the server sees it.

Source: .omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md, entry s7-02-terminal-checks-read-the-base-rules, PRD #1342
Enforced by: kit/bin/law-demoted.test.ts
Governs: ^kit/bin/law-demoted\.test\.ts$, ^kit/lib/outbox/, ^kit/bin/commands/(bug|visual|check|status)\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-10
Decided: nobody — adopted when raised (medium), 2026-10-10
Merged: @pierrederval, 2026-10-10, PR #1343
Kept id: moved from product, PRD 2346

## N-PRODUCT-15

The loop's merge gate never merges a pull request into the default branch: `omni flow check merge` refuses one whose base is the default branch, and no skill runs a merge there. Only a person merges into it.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: kit/lib/flow/merge-gate.test.ts, kit/test/plugin.test.ts
Governs: ^kit/lib/flow/merge-gate\., ^kit/plugin/skills/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13
Kept id: moved from product, PRD 2346
