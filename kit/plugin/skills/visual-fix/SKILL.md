---
name: visual-fix
description: Takes a small visual change from one line to one pull request a person merges — opens (or reads) its issue, shows today beside four or five rendered variations and asks which one, applies the pick on a fix branch, looks at the real screen once, records a before/after page with the pick and every round of variations, proves it with omni visual, opens the PR into the default branch and sends the record to the fix's page on the Omni page. No PRD, spec, plan, phase-0 PR, feature branch or wave, and an outbox only when the range changes a law — one high item per change, in the fix's folder, for a person to answer. With design craft on, it word-passes its rounds before showing them and writes the pick to the screen library as a draft, never locked, a change to a locked screen being one more high item for whoever locked it. Stops and hands over the /omni:brainstorm line when the change needs data, a route, an API, a stored shape, a new screen or a new behaviour. Never merges. Triggers on "visual fix", "change the colour of", "this looks off", "make the sidebar darker", "/omni:visual-fix".
---

# Visual fix: one line to one pull request

A fast lane beside the loop, not inside it. A small visual change (a colour, a spacing, a label, a
hover state) gets an issue, a set of rendered variations the person picks from, one fix branch and
one pull request. There is no PRD, inbox folder, spec, plan, phase-0 PR, feature branch, wave or
outbox, except one item per change to a law the fix makes (**A change to a law**) or to a screen
someone locked (**A change to a locked screen**): the person takes every visual decision by picking. The record (the before/after page, who
picked what, and every round of variations shown) is committed with the fix and sent to the fix's
own page on the Omni page, a Visual Update. No release note and no retro follow a visual fix. It
ends at a review gate: **a person merges.**

In order: **start** (step 0, the flow's step 1); open or read the **issue** (2); **locate** the screen and check the **boundary**
(3); draw the **variations** and ask (4); cut the **branch** (5); **apply** the pick (6); the
**real check** (7); **record** the before/after page (8), with **a change to a law** when the range
makes one; **ship** (9); **hand off** (10).

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Input

| input | example | what it is |
|---|---|---|
| one line | `/omni:visual-fix 'the sidebar background is too light'` | the change, in the person's words; the skill opens its issue |
| an issue number | `/omni:visual-fix 612` | an issue that already says what to change; the skill uses it as it is |

With neither, say that this skill takes one line of the change or an issue number, and stop.

## Step 0

**Start** (the flow's step 1). Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say
so in one line: the Omni Loop kit is not installed in this repository. Keep the JSON; later steps
read `repo.*`, `branches.fix`, `worktrees`, `paths.delivery`, `labels.visual`, `labels.autoCreate`,
`commands.preflight` and `limits.beforeAfterMaxBytes` from it. `<remote>` below is `repo.remote`.

Then read the design flag: `node .omni-loop/bin/omni.mjs config design.enabled`. Keep what it
prints. Anything but `true` (or a failure) means design craft is off here: step 7 runs no design
review, and the PR has no **Design review** section. Off, the design memory is off too: step 3 reads
no screen library, step 4 marks no screen and runs no word pass, step 8 writes no draft screen,
**A change to a locked screen** does not apply, and the PR has no **Draft screen** section. Nothing
else in this skill changes.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below. Then read `node .omni-loop/bin/omni.mjs kb show verification`: how
this repository sees a change working, which step 7 follows. Each `omni kb show <form>` prints one
form of the repository's playbook, section by section: a section the repository left blank prints
the kit default, and a `[hole]` is a question for a person, never a reason to stop. A form adds to
the steps below; it never overrides this skill's rules.

## The boundary

Read it before step 3; it holds at every step after.

- **Allowed:** styles, design tokens, copy, markup and layout of screens that already exist, and
  small presentational logic in a component: a prop that shows or hides an element, a hover or
  focus state, a class chosen by an existing value.
- **Not allowed:** data, fetching, routes, APIs, a stored shape, a new screen, a new flow, or any
  behaviour a user did not have before.

A small diff is not the test: a one-line change can still change behaviour. The test is the two
lists above.

**The stop.** Crossing the line, at step 3 or at any later step, stops the skill. Comment on the
issue (a comment is never signed) with what crossed the line, in plain words, and the command to
run instead:

```bash
gh issue comment <n> --body-file <file>
```

```markdown
This is more than a visual fix: <what crossed the line, in one or two sentences>.

Run this instead, to design it first:

`/omni:brainstorm <the issue's line>`
```

Then stop. Open no pull request and push nothing. A worktree step 5 had already cut stays where it
is, unpushed, and the hand-off names its path and its branch.

## 2. Issue

- **With a line:** check `labels.visual` exists (`gh label list --search "<labels.visual>" --json
  name`) and follow `/omni:pr`'s **Labels** rules for a missing one. Then open the issue, signed
  (**Signing**):

  ```bash
  gh issue create --title "Visual: <line>" --label "<labels.visual>" --body-file <file>
  ```

  ```markdown
  <the line, as the person wrote it>

  A visual fix: `/omni:visual-fix` shows today beside four or five variations, applies the one
  picked, and opens one pull request that closes this issue.

  <the line `omni sign footer` prints>
  ```

- **With a number:** read it with `gh issue view <n> --comments`, and use it as it is. When it does
  not carry `labels.visual`, add it (`gh issue edit <n> --add-label "<labels.visual>"`), subject to
  the same **Labels** rules.

`<n>` below is the issue's number, `<nnnn>` is `<n>` zero-padded to four digits, and `<slug>` is a
short kebab-case name of the change.

## 3. Locate

Find the screen or screens the line is about, and where their look comes from: design tokens,
stylesheets, component markup. Read only; nothing changes yet. Say in one line what will be
touched (the screen, and the files its look comes from), then check it against **The boundary**.
Past the line, follow **The stop**.

A repository with no screen at all stops here too: comment on the issue that there is nothing
visual to change in this repository, and stop.

**The design memory,** only when step 0 read the design flag as `true`. Read
`node .omni-loop/bin/omni.mjs kb show design`, its `language` laws included, then run
`node .omni-loop/bin/omni.mjs design screens` and find the library screen the line is about: the one
whose `implements` meets the files its look comes from, or whose `routes` show it. Read its file, in
the folder `node .omni-loop/bin/omni.mjs config design.screens` prints, and its mockup. A **draft**
is a starting point, and step 8 brings it up to the pick. A **locked** screen is that person's
decision: its file and its mockup are the reference the variations start from, and a pick that
departs from them is **A change to a locked screen**. No library screen: step 8 drafts one. Say
which, in the same line as what will be touched.

## 4. Variations, always

Always, even when the line is precise: the person picks, the skill never does.

1. Write **one self-contained HTML page** to the session's scratchpad directory, never the
   repository yet: it is the first **round**. Build it from the real screen's markup and styles,
   copied in (inline CSS, inline SVG, no network, **no base64 raster image**, at most
   `limits.beforeAfterMaxBytes` bytes, since step 8 commits it as it is): **today** first, then
   **four or five distinct variations**, labelled A to E. Each is a real direction, not a shade of
   the same one: when the line asks for "darker", show darker in different ways (a tone, a
   contrast, a border, a weight), not five greys.

   **The word pass,** only when step 0 read the design flag as `true`, before the page is shown.
   Mark **today** and each variation as a screen, with `data-screen` (`today`, `A` … `E`), and the
   one primary action of each with `data-primary`, the convention every mockup the kit's skills
   write uses. Then run `node .omni-loop/bin/omni.mjs design words <page>`; it exits 0 whatever it
   finds. Fix each finding in the variation it names (a shorter label on the control, one primary
   action, a sentence that stands at rest cut or moved to where it is needed, an avoided word
   replaced) and run it again. The rule is fixed in the screen, never silenced: never drop a mark,
   unmark a primary action or reword the finding away. A finding on **today** is what the product
   shows now: say it under today, never redraw today to hide it. A finding a variation keeps on
   purpose (the line asks for exactly that) is said under it. With a locked screen (step 3), a
   variation that departs from its mockup or its file says so under its letter, in one line.
2. Open it in the person's browser when the session can, and give its path either way.
3. Ask which one, as **one question** through the session's question tool, with A to E as its
   options; the person may answer "another round", with a note. Ask mode carries the question to
   the Omni page when it is on.
4. "Another round" writes a **new** page, beside the old one, from the note, under the same rules.
   Repeat until one variation is picked. Keep every round's page as it was shown, and its number,
   k = 1, 2, … in the order shown.
5. Note **who picked**, and the day: in ask mode, the GitHub login the Omni page gives with the
   answer; otherwise the login of the person at the terminal, `gh api user --jq .login`. Step 8
   writes it in the pick line.

## 5. Branch

Cut a worktree on `branches.fix`, with `{topic}` = `<n>-<slug>`, from the default branch:

```bash
git fetch <remote>
git worktree add -b <fix branch> <worktrees>/<n>-<slug> <remote>/<repo.defaultBranch>
```

Every change below is made in this worktree. Never commit on `repo.defaultBranch`.

## 6. Apply

Apply the pick in code, in the repository's own patterns: its design tokens before a raw value, its
components before new markup. Read `node .omni-loop/bin/omni.mjs kb show conventions` for the
naming and formatting it binds.

- A small component tweak that changes logic (a prop, a state, a class chosen by a value) is
  written test-first: read `node .omni-loop/bin/omni.mjs kb show testing`, write the failing test,
  watch it fail, make it pass.
- A change of styles or copy alone needs no new test.

Then run `commands.preflight` until it is green. When it is null, say so, and name it in the PR's
**Verified** section. A change that turns out to cross **The boundary** here follows **The stop**.

## 7. Real check

Run the app as `omni kb show verification` says, and look at the changed screen once, with a
screenshot when the session has a browser tool. Compare it with the pick: a mockup can differ from
the real screen.

When that cannot be done here (no way to run the app, no browser, a screen behind a sign-in the
session lacks), say so plainly: the PR's preview becomes the check. **Nothing is reported as seen
that was not.**

**Design review,** only when step 0 read the design flag as `true`, and on its own: no one asks
for it. Follow `/omni:pixel-perfect review`: that skill's step 0, then its `reference/review.md`,
as written there. Give it the issue, the paths the fix changed as its territory, the base
`<remote>/<repo.defaultBranch>`, and, as its reference picture, the variation the person picked in
step 4. Its fixes stay inside **The boundary** as well as the territory, and are part of step 6's
change: run `commands.preflight` again after them. A fix that would cross **The boundary** is not
made: the review never crosses it to finish a fix, and it is never **The stop**.

The review never blocks: no finding stops the fix, holds the preflight or keeps the PR from
opening. A visual fix has no outbox, so what it did not fix is listed in the PR's **Design review**
section (step 9), one line each, with the fix it would make and why it was left. When the app
cannot be seen here, the review says so and judges from the source, as its reference says. Its
screenshots stay in the scratchpad, never in the fix's folder (step 8 allows nothing else there):
attach them to the PR when the session can.

## 8. Record

The fix's folder is `<paths.delivery>/visual/<nnnn>-<slug>/`. Write in it:

- `before-after.html`:
  - **the pick line**, once, in exactly this shape, with the letter, the login and the day of
    step 4 (no other attribute, no other words; the Omni page reads it as it is):

    ```html
    <p data-omni-pick>Picked <letter> by @<login> on <YYYY-MM-DD></p>
    ```

  - **today** beside **the pick**, at full size, each labelled;
  - then the variations not picked, smaller, under a heading **Not picked**, each with its letter.
- `variations-r<k>.html`: every round's page of step 4, one file per round shown, k = 1, 2, … in
  the order shown, copied as the person saw it.

Nothing else goes in that folder, but the `outbox/` of **A change to a law** and **A change to a
locked screen**. Every page in it is self-contained: inline CSS and inline SVG, no
script from the network, and **no base64 raster image** (a `data:image/` URL that is not SVG). Each
is at most `limits.beforeAfterMaxBytes` bytes. Build `before-after.html` from the round pages, never
by linking to them.

**The draft screen,** only when step 0 read the design flag as `true`. The pick is written to the
screen library, the folder `node .omni-loop/bin/omni.mjs config design.screens` prints, never to the
fix's folder: it is a draft, a starting point the next skill reads, and never locked here. Only a
person locks, through `/omni:pixel-perfect lock`; a pick is a draft until its person locks it.

- **No library screen** (step 3): write `<name>.md`, `<name>` the screen's short kebab-case name,
  and beside it its mockup `<name>.html`: the pick at full size, copied from its round as the
  person saw it, `data-screen` and `data-primary` kept, under the page rules above.

  ```markdown
  ---
  screen: <name>
  status: draft
  mock: <name>.html
  implements: [<the files its look comes from, step 3>]
  routes: [<the routes that show it, when the router says>]
  supersedes: null
  ---

  ## Purpose
  ## Regions
  ## States
  ## Words
  ## Refusals
  ## Open questions
  ## Source
  ```

  Each section says what the pick and the code show, and nothing else: what is not shown goes under
  **Open questions**. **Source** names where it came from, in one line: `/omni:visual-fix #<n>, pick
  <letter> by @<login> on <YYYY-MM-DD>: <paths.delivery>/visual/<nnnn>-<slug>/before-after.html`.
  The front matter holds only the fields above: the library's reader refuses any other.
- **A draft already there:** bring its mockup and its sections up to the pick, its draft amendment,
  and add the line of this fix to its **Source**. A draft changes freely.
- **A locked screen:** never edit its file or its mockup. The pick, when it departs from them, is
  **A change to a locked screen**.

Then run `node .omni-loop/bin/omni.mjs check design` and
`node .omni-loop/bin/omni.mjs design screens`: a refusal that names the draft is fixed in it.

## A change to a law

Only when `laws.source` is `knowledge`; otherwise skip this section. A law is a rule or an invariant
of the knowledge base, and its proof is the test its `Enforced by:` line names. A fix may change a
law only with a person's answer. Step 9's `node .omni-loop/bin/omni.mjs visual <n>` names each
change to a law the range makes, one `not ok` line each, by its rule:

| rule | the range |
|---|---|
| `law-proof` | changes a file a law's `Enforced by:` names |
| `law-text` | rewords, adds or removes a law in a register |
| `test-removed` | deletes a test, a law's among them |
| `law-demoted` | turns a law's `Enforced by:` path back to `pending` or `unenforced`, or removes the law |

Each line reads `- <path> (<rule>): a change to a law needs an item ranked high in
<folder>/outbox/ and an account naming it in <folder>/outbox/accounts/.`

First ask whether the fix needs that change. When it does not, undo it and rerun: that is the most
reversible answer. When it does, keep it and raise it for a person, in the fix's folder
(`<paths.delivery>/visual/<nnnn>-<slug>/`), under `outbox/`: **one item per change**, never two changes in one item.

1. **The items.** `omni item new` writes a PRD's items only, so write each by hand as
   `outbox/s1-<k>-<slug>.md`, in the shape every outbox item takes, `<k>` counting `01`, `02` … in
   the order the lines came:

   ```markdown
   ---
   id: s1-<k>-<slug>
   prd: <n>
   slice: s1
   rank: high
   bears-on: <law id>
   raised: <YYYY-MM-DD>
   wave: 1
   ---

   ## The question, in plain words

   <one or two sentences a business person reads: what the fix changes about the rule, and why>

   ## The decision, in plain words

   <what this fix did, in the same plain words>

   ## The intro, for fun

   <one sentence, at most 120 characters, about the question, never about a person>

   ## The punchline, for fun

   <one sentence, at most 120 characters, following the intro>

   ## The options, in plain words

   A. <what the fix did> (built).
   B. <keep the law as it was, and what the fix then does instead>

   ## What I had to decide

   <the law, its id, and the change the range makes to it>

   ## What I did meanwhile

   <what the branch holds now>

   ## What it costs to change later

   <what undoing it takes>

   ## What I could not know

   <what the knowledge, the issue and the code do not settle, each line marked (author)>
   ```

   The plain-words fields name no path, no code and no id. `<law id>` is the law's register id,
   the one `omni knowledge <id>` explains. Never invent a rationale: a gap goes in the last
   section, marked `(author)`.
2. **The account.** Write `outbox/accounts/s1.md` in the same folder, naming each change once per
   rule, as a line of `omni visual <n>` names it:

   ```markdown
   ---
   prd: <n>
   slice: s1
   graded: <YYYY-MM-DD>
   ---

   ## Risky changes

   - `<path>`
     <rule>
     item s1-<k>-<slug>
   ```

3. **Commit** the items and the account on the fix branch, signed (**Signing**), and rerun
   `omni visual <n>` until it prints `ok`: an open item is not a failure there.

On the pull request, the outbox check posts each item and stays red until a person answers it,
through the same replies as a feature PR's outbox: a person answers, never this skill. That red is
not an attempt at the fix. The PR's body and the hand-off name each item and the law it bears on.

## A change to a locked screen

Only when step 0 read the design flag as `true` and step 3 found the screen locked in the library.
A locked screen is the decision of the person who locked it: the pick may change it only with their
answer. The pick changes it when the fix makes the real screen depart from its mockup or its
**Regions**, **States** or **Words**. A pick that stays inside them changes nothing locked: carry on.

Step 4's page says it under each variation that departs from the locked screen, so the person
picks knowing it; the pick stays theirs. When the pick does change it, apply it in code as step 6
says, and leave the screen's file and its mockup as they are: never edit a
locked screen's body, never write an amendment line (it needs its owner's words) and never lock
anything. Then raise it, in the fix's folder, under `outbox/`, as one item per locked screen, in the
shape **A change to a law** gives, numbered on after its items, with these differences:

- `rank: high`, and no `bears-on` line: a screen is no law.
- **The question** names the screen, the change and who locked it (its `locked-by` and
  `locked-on`), so the check holds until that person answers.
- **The options:** A, the change as built; B, the screen as locked, with the change undone.
- **What I had to decide** carries the amendment line its owner would add, with their words left for
  them: `> Amended <YYYY-MM-DD> · @<login> · "<their words>": <what changed>`. Its owner gives it
  through `/omni:pixel-perfect lock <screen>`, in their own words; this skill never does, even when
  the person who picked is the one who locked it.

It needs no account: no check names it. Commit it on the fix branch, signed (**Signing**). The PR's
body and the hand-off name each item, the screen and who locked it.

## 9. Ship

1. **Commit** on the fix branch as `fix(<scope>): <line> (#<n>)`, with the session's co-author
   trailer, then the `omni sign trailer` line (**Signing**). The scope follows
   `omni kb show conventions`.
2. **Prove it:** `node .omni-loop/bin/omni.mjs visual <n>`. Run it until it prints `ok`:

   | exit | what you do |
   |---|---|
   | `0` | `ok`: carry on. |
   | `1` | `not ok`, one line per failed check: fix each (a second folder, a missing page, a page or a round too big, a raster image, a round not named `variations-r<k>.html`, any other file in the folder, an unsigned commit), commit, and rerun. A line naming `law-proof`, `law-text`, `test-removed` or `law-demoted` follows **A change to a law**. |
   | `2` | The kit is not installed here, or its config does not read: say so and stop. |

3. **Push** the fix branch: `git push -u <remote> <fix branch>`.
4. **Send the record to its page:** follow `/omni:dossier-push <n> --kind visual`, and carry on
   whatever it prints. Keep the link it printed for the hand-off.
5. **Open the PR through `/omni:pr`**, as a standalone PR: base `repo.defaultBranch`, label
   `labels.visual` (subject to its **Labels** rules), title the commit's subject, and this body,
   signed (**Signing**):

   ```markdown
   Closes #<n>

   ## What changed

   <the screen, and what now looks different, in plain words; the files touched>

   ## The pick

   <p data-omni-pick>Picked <letter> by @<login> on <YYYY-MM-DD></p>

   <its letter>: <one sentence on the direction>.

   ## Before/after

   `<paths.delivery>/visual/<nnnn>-<slug>/before-after.html`, and the rounds of variations shown:
   `variations-r1.html`<, `variations-r2.html` …> beside it

   ## Laws

   <none | each item of **A change to a law**, its id and the law it bears on, for a person to
   answer on this PR>

   ## Draft screen

   <the screen of the library step 8 drafted or brought up to the pick, its file and its mockup, a
   draft for its owner to lock with `/omni:pixel-perfect lock <screen>`; or each item of **A change
   to a locked screen**, the screen and who locked it, for that person to answer on this PR>

   ## Verified

   - <commands.preflight>: <green, or "none set here">
   - `omni visual <n>`: ok
   - `omni check design`: <ok> (only with the design flag on)
   - `omni design words`: <what it found on the rounds, and what was fixed>
   - <the real check: what was looked at, and how; or the sentence saying it was not done and the
     preview is the check>

   ## Design review

   <step 7's review: one ✓, ✗ or — line per step, then what was fixed and what was left, one line
   each>

   ## Risk and rollback

   <what else shares the changed tokens or styles>; roll back by reverting this PR.

   <the line `omni sign footer` prints>
   ```

   The **Design review** and **Draft screen** sections, and the two design lines of **Verified**,
   are there only when the design flag is on; off, leave them out.
   The pick line is the one in `before-after.html`, copied as it is. The before/after line is a
   repository path, never a URL. `/omni:pr` watches it until it is green or stuck.

## 10. Hand off

Print, in a few lines: the issue, the PR, the fix's page beside it, what was verified and what was
not (the preflight, the `omni visual` line, the real check or why it was not done), each item a
change to a law raised and the law it bears on, and, with the design flag on, the draft screen
written (or each item of **A change to a locked screen**, and who locked it), then:

> Open the PR's preview and merge it if it looks right.

The fix's page is the link step 9's push printed. When the push was skipped, run
`node .omni-loop/bin/omni.mjs dossier link <n> --kind visual`; when it prints `none` or cannot reach
the app, say the fix has no page yet and give its issue, `https://github.com/<repo.slug>/issues/<n>`.

After **The stop**, the hand-off is the issue, the comment and the `/omni:brainstorm` line, and the
worktree left behind, when there is one.

## Never

- **Never merge.** A person merges the PR; the skill stops at the hand-off.
- **Never pick for the person.** Four or five variations, always, and one question.
- **Never cross the boundary** to finish a fix: stop, and hand over the `/omni:brainstorm` line.
- Never commit on `repo.defaultBranch`, and never write a round of variations into the repository
  before step 8, nor change one after it was shown.
- Never report a screen as seen that was not.
- Never open a PRD, an inbox folder, a plan or an outbox item for a visual fix, save the items
  **A change to a law** and **A change to a locked screen** ask for, and never batch several visual
  fixes into one PR.
- Never lock a screen or a law, never edit a locked screen's file or mockup, and never write an
  amendment line: a pick is a draft, and only a person locks, through `/omni:pixel-perfect lock`.
- Never answer an item of the fix's outbox: a person does.
