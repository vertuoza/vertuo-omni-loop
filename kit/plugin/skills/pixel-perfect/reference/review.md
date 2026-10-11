# Review: the bounded auto-review

The kit's own command, not imported: it strings the imported ones into the one pass the loop runs
on UI work. `/omni:do-work` follows it in its review step, before the sub-PR is marked ready, on a
slice that builds or changes a screen; `/omni:visual-fix` follows it at its real check. A person
may type it too.

**Bounded:** one look, one batch of fixes, at most one confirming look. Never a loop.

**Never blocking.** A finding never stops the slice, the wave or the gate, and never turns a check
red. Whatever it finds is fixed and listed, or left and recorded; the caller carries on either way.
A change to a locked screen or law is recorded as a high item, the one a person must answer before
the gate turns green (**A change to a locked screen or law**, below); the slice still carries on.

## What it is given

| input | from |
|---|---|
| the slice, or the fix | the calling skill: the PRD and slice id, or the visual fix's issue |
| the territory | the slice's row of the plan (a visual fix: the paths it changed); every fix stays inside it |
| the base | the branch the work is compared against, for the changed paths |
| the reference picture | the "after" screen of the PRD's before/after page, or, for a visual fix, the variation the person picked; for a screen of the library, its file and mockup (step 0) |

Step 0 of the skill has run: the flag is on (off, the review is the one `design: off` line, and the
caller's **Design review** section is that `—` line alone) and the design form is read.

## Steps

0. **The screens.** Run `node .omni-loop/bin/omni.mjs design touched <base>` (it always exits 0).
   Its `screens:` line names each library screen whose `implements` the work's diff touches, with
   its status and its routes (`quote-editor 🔒 (/quotes/:id) · quote-list (draft) (/quotes)`); no
   such line, no library screen is touched. Read each one's file and mockup (step 0 of the skill
   listed them). The screens the review looks at are those, by their routes, and any other screen
   the work changed. For a locked screen (`🔒`), its file and mockup are the reference picture,
   ahead of the before/after page: it is built as written. A draft is compared with the reference
   picture the caller gave, and its file is a starting point.
1. **Critique** ([critique.md](critique.md)) of the screens the work changed, against the design
   form, its `language` laws included: does each read as this product, in its tokens, components
   and words? Its two assessments as that reference says; no question is asked, and no score is
   persisted anywhere. The critique's word pass: run
   `node .omni-loop/bin/omni.mjs design words <page>…` over the reference picture's page, each
   touched screen's mockup and, when the session's browser tool can save a built screen's HTML to
   a scratch file outside the repository, that file. It exits 0, whatever it finds: each finding
   (`sentence-on-control`, `two-primaries`, `explains-at-rest`, `avoided-word`) is a critique
   finding, fixed in the screen at step 5 or left as any other, never silenced. A locked screen's
   **Words** are its words: a finding there is the owner's to decide (below).
2. **Audit** ([audit.md](audit.md)) of the built result, and the checks of
   [craft-floor.md](craft-floor.md) that the form does not set aside.
3. **Lint.** Run `node .omni-loop/bin/omni.mjs config commands.design`. When it prints a command,
   run it from the repository root and keep what it finds (its exit code is a finding, never a
   failure of the review). When it prints `null`, the step's line is `Design lint: not set here`.
4. **Screenshots** of each screen step 0 named, at its routes, at the widths the form's `review` section names
   (390 and 1440 when it names none), signed in as it says, through the session's browser tool.
   Compare each with the reference picture: what differs, and whether the difference is the
   product's (the design form, the real data) or a defect. A locked screen: compare it with its mock,
   and with its **Regions**, **States** and **Words**, at each width; a difference that is not the
   real data is a defect, or a change to the locked screen (below). When the app cannot run, or cannot be
   seen here (no browser tool, a sign-in the form does not explain), say so in the step's line,
   and nothing is reported as seen: steps 1 and 2 then judge from the source and say so.
5. **Polish** ([polish.md](polish.md)): fix what steps 1 to 4 found, in **one batch**, inside the
   territory, in the order polish triages (broken tasks and inaccessible paths first, cosmetic
   last). Then **one confirming look**, at the same widths, and stop, whatever it shows. On a
   locked screen a fix brings the built screen back to its mock, never away from it.

Steps 1 and 2 report; only step 5 edits. A finding the form's `deliberate` section explains is not a
finding.

## A change to a locked screen or law

The one finding that is not like the others. The work changes a locked screen when the built
result departs from its mock or its file on purpose (the spec or the fix asks for it), and a
locked law when it builds against one. The review never edits a locked screen's body or a locked
law, and never redesigns one to make a finding go: the calling skill records the change as a
**high** outbox item (in `/omni:do-work`, its decisions step says how), naming the screen (or the
law), the change and who locked it (its `locked-by` and `locked-on`, or the law's lock line), so
the gate holds until that person answers. A fix of step 5 that would change a locked screen's
design is not made: it is left, and recorded the same way.

Every other finding stays what it was: fixed, or a decision of its usual rank, never blocking. A
draft changes freely. A person typing the review gets the change in the list, with the owner to
ask and `/omni:pixel-perfect lock <screen>`'s **Amend** as the way that owner records it.

## What it did not fix

Each finding left after the confirming look, and each fix that would leave the territory, is a
decision taken alone: the calling skill records it as an outbox item (in `/omni:do-work`, its
decisions step), naming the screen, what was found, the fix it would make and why it was left. A
person typing the review gets them as a list instead. Nothing is left unsaid, and nothing is
dropped because it is small: a P3 left is one line of the item's gaps.

## What it reports

The calling skill puts a **Design review** section in the sub-PR body (or the visual fix's PR body),
one line per step, and a **Locked** line when a locked screen or law changed, each opening on ✓
(done, nothing left), ✗ (done, something left: the outbox item named) or — (not run, and why):

```markdown
## Design review

- ✓ Critique — reads as the product; word pass 1 fixed (sentence-on-control); 2 fixed (the empty state's copy, the table's header weight)
- ✗ Audit — 1 left: focus ring on the date picker, outside the territory (item s3-02)
- ✗ Locked — quote-editor 🔒: the totals moved above the lines, asks @login (high item s3-03)
- — Design lint: not set here
- ✓ Screenshots — 390 and 1440, beside the before/after page's "after" and quote-editor's mock
- ✓ Polish — one batch, confirmed at 390 and 1440
```

The screenshots go with it when there are any (attached to the pull request, or committed where
the calling skill keeps its record); a screenshot never lands in the slice's territory. Then the
list of what was fixed, one line each.

Typed by a person, the same lines are the report, and nothing is committed beyond the fixes.
