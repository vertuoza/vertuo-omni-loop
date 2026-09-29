---
name: visual-fix
description: Takes a small visual change from one line to one pull request a person merges — opens (or reads) its issue, shows today beside four or five rendered variations and asks which one, applies the pick on a fix branch, looks at the real screen once, records a before/after page with the pick and every round of variations, proves it with omni visual, opens the PR into the default branch and sends the record to the fix's page on the Omni page. No PRD, spec, plan, phase-0 PR, feature branch, wave or outbox. Stops and hands over the /omni:brainstorm line when the change needs data, a route, an API, a stored shape, a new screen or a new behaviour. Never merges. Triggers on "visual fix", "change the colour of", "this looks off", "make the sidebar darker", "/omni:visual-fix".
---

# Visual fix: one line to one pull request

A fast lane beside the loop, not inside it. A small visual change (a colour, a spacing, a label, a
hover state) gets an issue, a set of rendered variations the person picks from, one fix branch and
one pull request. There is no PRD, inbox folder, spec, plan, phase-0 PR, feature branch, wave or
outbox: the person takes every visual decision by picking. The record (the before/after page, who
picked what, and every round of variations shown) is committed with the fix and sent to the fix's
own page on the Omni page, a Visual Update. No release note and no retro follow a visual fix. It
ends at a review gate: **a person merges.**

In order: **start** (step 0, the flow's step 1); open or read the **issue** (2); **locate** the screen and check the **boundary**
(3); draw the **variations** and ask (4); cut the **branch** (5); **apply** the pick (6); the
**real check** (7); **record** the before/after page (8); **ship** (9); **hand off** (10).

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

## 4. Variations, always

Always, even when the line is precise: the person picks, the skill never does.

1. Write **one self-contained HTML page** to the session's scratchpad directory, never the
   repository yet: it is the first **round**. Build it from the real screen's markup and styles,
   copied in (inline CSS, inline SVG, no network, **no base64 raster image**, at most
   `limits.beforeAfterMaxBytes` bytes, since step 8 commits it as it is): **today** first, then
   **four or five distinct variations**, labelled A to E. Each is a real direction, not a shade of
   the same one: when the line asks for "darker", show darker in different ways (a tone, a
   contrast, a border, a weight), not five greys.
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

Nothing else goes in that folder. Every page in it is self-contained: inline CSS and inline SVG, no
script from the network, and **no base64 raster image** (a `data:image/` URL that is not SVG). Each
is at most `limits.beforeAfterMaxBytes` bytes. Build `before-after.html` from the round pages, never
by linking to them.

## 9. Ship

1. **Commit** on the fix branch as `fix(<scope>): <line> (#<n>)`, with the session's co-author
   trailer, then the `omni sign trailer` line (**Signing**). The scope follows
   `omni kb show conventions`.
2. **Prove it:** `node .omni-loop/bin/omni.mjs visual <n>`. Run it until it prints `ok`:

   | exit | what you do |
   |---|---|
   | `0` | `ok`: carry on. |
   | `1` | `not ok`, one line per failed check: fix each (a second folder, a missing page, a page or a round too big, a raster image, a round not named `variations-r<k>.html`, any other file in the folder, an unsigned commit), commit, and rerun. |
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

   ## Verified

   - <commands.preflight>: <green, or "none set here">
   - `omni visual <n>`: ok
   - <the real check: what was looked at, and how; or the sentence saying it was not done and the
     preview is the check>

   ## Risk and rollback

   <what else shares the changed tokens or styles>; roll back by reverting this PR.

   <the line `omni sign footer` prints>
   ```

   The pick line is the one in `before-after.html`, copied as it is. The before/after line is a
   repository path, never a URL. `/omni:pr` watches it until it is green or stuck.

## 10. Hand off

Print, in a few lines: the issue, the PR, the fix's page beside it, what was verified and what was
not (the preflight, the `omni visual` line, the real check or why it was not done), then:

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
- Never open a PRD, an inbox folder, a plan or an outbox item for a visual fix, and never batch
  several visual fixes into one PR.
