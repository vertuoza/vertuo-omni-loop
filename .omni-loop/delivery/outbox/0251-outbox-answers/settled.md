# Settled outbox items — PRD 251

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-terminal-post-takes-objections -->

## s1-01-terminal-post-takes-objections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-terminal-post-takes-objections
prd: 251
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

When someone answers in the terminal, may their reply also object to a decision that was already adopted?

## The decision, in plain words

Yes. The terminal only asks the blocking questions, but the reply it posts may also carry an objection to an adopted decision, exactly as a reply typed on the pull request can.

## The intro, for fun

The terminal asks only the urgent questions, but it still listens when you have more to say.

## The punchline, for fun

Nobody is asked about the settled ones, and nobody is stopped from reopening them.

## The options, in plain words

A. Accept an objection to an adopted decision in the terminal's reply, as the pull request does.
B. Refuse any number the terminal did not ask, so its reply answers only the blocking questions.

## What I had to decide

The spec says the terminal never asks the adopted, medium questions. It does not say whether the posting command must refuse an answer to one when the answers file carries it.

## What I did meanwhile

The posting command accepts every number the pull request comment lists that is still open or adopted, the same set the reply reader answers. The asking command still lists only the open human-action and high questions.

## What it costs to change later

One filter in the posting command: dropping the adopted questions from the set it accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person at the terminal would ever want to object there, rather than on the page or the pull request

```

<!-- /omni-outbox-settled: s1-01-terminal-post-takes-objections -->

<!-- omni-outbox-settled: s3-01-outbox-dossier-title -->

## s3-01-outbox-dossier-title — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-outbox-dossier-title
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When the questions of a plan reach the Omni page before its documents do, what should the new page for that plan be called?

## The decision, in plain words

It is called after the plan's number, like "PRD 7", until the plan's documents arrive and give it their own title.

## The intro, for fun

Every page needs a name, even one that shows up early.

## The punchline, for fun

"PRD 7" is no poem, but it will answer to it until the spec arrives.

## The options, in plain words

A. Name it after the plan's number until its documents arrive (as built).
B. Have the App send the plan's own title along with its questions.
C. Refuse the questions until the plan's documents have reached the page.

## What I had to decide

The spec says the outbox route finds or creates the PRD's dossier by its key, but a dossier needs a title (1 to 200 characters) and the App's body carries none. I had to pick the title of a dossier the outbox creates.

## What I did meanwhile

dossier_outbox_put() titles a dossier it creates `PRD <n>`. The next kit push or PRD 216's fallback retitles it from the spec, as they already do; a dossier that already exists keeps its title.

## What it costs to change later

One string in the migration's function (and the fake store). A later title rule is a follow-up migration replacing the function; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the relay should carry the spec's title instead, which the App could read from the head's delivery folder.

```

<!-- /omni-outbox-settled: s3-01-outbox-dossier-title -->

<!-- omni-outbox-settled: s3-02-outbox-last-send-route -->

## s3-02-outbox-last-send-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-outbox-last-send-route
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When a plan's pull request is merged or closed, which part of the GitHub helper should send the Omni page its questions one last time?

## The decision, in plain words

The same part that checks the questions on every push sends the last copy too, but it writes no check and no comment on the closed pull request.

## The intro, for fun

Last orders at the bar, served by the usual bartender.

## The punchline, for fun

Same bartender, no new round on the tab.

## The options, in plain words

A. The usual checker sends the last copy, without checking (as built).
B. A separate helper sends only the last copy.
C. No last copy: the page keeps the questions as they were before the merge.

## What I had to decide

The spec wants one last send with state merged or closed from the pull_request.closed delivery, which today only starts the retro and the knowledge harvest. It does not say which function sends it.

## What I did meanwhile

The webhook turns every pull_request.closed into an outbox-check event with trigger pull_request.closed and its state; the outbox-check function then skips its check run and its comment and runs only evaluate and relay. It shares the function's per-pull-request debounce, so the last event of a burst wins.

## What it costs to change later

A small change in the webhook and the function: a separate relay function would be a new function id, and Inngest must be resynced when it is added.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a closed, unmerged pull request should also clear the page's open questions, which today it does by sending state closed.

```

<!-- /omni-outbox-settled: s3-02-outbox-last-send-route -->

<!-- omni-outbox-settled: s3-03-outbox-own-comment -->

## s3-03-outbox-own-comment — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-outbox-own-comment
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

How does the GitHub helper tell its own comments apart, so rewriting its question list does not start another check forever?

## The decision, in plain words

It skips a comment written by its own robot account, and still checks again on a person's comment, even one sent from the Omni page with its help.

## The intro, for fun

A helper that answers its own echo never gets any rest.

## The punchline, for fun

So it learned its own name, and nothing else.

## The options, in plain words

A. Recognise its own robot account by name (as built).
B. Recognise it by the App's numeric id, set as a setting on the deployment.
C. Check again on every comment, its own included, and rely on the delay to absorb the echo.

## What I had to decide

The spec says a comment the App wrote itself does nothing. A reply sent from the Omni page is posted as the person but is marked as made with the App, so the App's involvement alone cannot be the test.

## What I did meanwhile

The webhook ignores an issue_comment whose author login is `omni-loop[bot]`, the registered name plus GitHub's bot suffix; a test ties that login to `app.yml`'s name. A person's comment made with the App is still checked.

## What it costs to change later

One constant. If the App is registered under another name, the constant and the manifest change together; the test fails until they agree.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the App is registered in production under the name omni-loop, which the manifest says but I cannot see.

```

<!-- /omni-outbox-settled: s3-03-outbox-own-comment -->

<!-- omni-outbox-settled: s3-04-outbox-open-count-after-merge -->

## s3-04-outbox-open-count-after-merge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-outbox-open-count-after-merge
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Once a plan's pull request is merged or closed, should the list of plans still show how many of its questions were open?

## The decision, in plain words

No: a merged or closed plan shows no open questions, because whatever was still open was adopted when it merged.

## The intro, for fun

A shipped plan with a question badge looks like homework handed in late.

## The punchline, for fun

The badge retires the day the plan does.

## The options, in plain words

A. Show no open questions once merged or closed (as built).
B. Keep counting what was open at the last check, whatever the state.

## What I had to decide

The spec says the list's open count is the number of open items in the dossier's outbox, 0 when it has none. The last send of a merged pull request still lists the items that were open just before the merge.

## What I did meanwhile

dossier_list() counts the stored outbox's open items only while its state is open, and 0 once it is merged or closed.

## What it costs to change later

One condition in dossier_list(): a follow-up migration replaces the function. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether someone wants closed-but-unmerged plans to keep showing their open questions.

```

<!-- /omni-outbox-settled: s3-04-outbox-open-count-after-merge -->

<!-- omni-outbox-settled: s4-01-context-closed-on-phones -->

## s4-01-context-closed-on-phones — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-context-closed-on-phones
prd: 251
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

On a phone, should the plan's context above the questions start open or closed?

## The decision, in plain words

It starts closed on a narrow screen, so the first question is visible right away; one tap opens the before and after page, the spec or the brainstorm. On a wide screen it always sits open beside the questions.

## The intro, for fun

A phone screen has room for one thing at a time, so something had to wait.

## The punchline, for fun

The questions go first; the homework is one tap away.

## The options, in plain words

A. A. Start closed on a narrow screen, open beside the questions on a wide one.
B. B. Start open everywhere, so the context always shows first.
C. C. Remember what the person chose last time on this device.

## What I had to decide

The spec says that on a tall screen the context rail becomes a Context disclosure above the questions, but not whether it starts open or closed.

## What I did meanwhile

The disclosure is rendered open by the server (what a wide screen and a page without scripts show) and closes itself in the browser when the screen is narrower than 960 pixels.

## What it costs to change later

One default in one small component: flipping it is a one-line change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people answering on a phone mostly want the before and after page in front of them first.

```

<!-- /omni-outbox-settled: s4-01-context-closed-on-phones -->

<!-- omni-outbox-settled: s4-02-page-line-needs-repo-name -->

## s4-02-page-line-needs-repo-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-page-line-needs-repo-name
prd: 251
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

When a repository's settings do not name the repository itself, should the question list on the pull request still point at the Omni page?

## The decision, in plain words

No: without the repository's name the short link cannot be written, so the list leaves the line out and people answer on the pull request as before.

## The intro, for fun

A link needs an address, and this one was missing a street name.

## The punchline, for fun

No address, no signpost; the old road still works.

## The options, in plain words

A. A. Leave the line out when the settings do not name the repository.
B. B. Have the GitHub helper pass the repository's name it already knows, so the line is always there.
C. C. Point at the plans list instead of the plan when the name is missing.

## What I had to decide

The spec says the list points at the Omni page when the answers switch is on and the page address is set. The short link also needs the repository's owner and name, which a repository's settings may leave out.

## What I did meanwhile

The line is written only when the switch is on, the page address is set, the settings name the repository and the plan's number is known; otherwise the comment reads exactly as before.

## What it costs to change later

One condition in the kit's comment writer, and a rebuilt bundle. The helper could read the name from the pull request instead, which it knows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many installed repositories leave their own name out of their settings.

```

<!-- /omni-outbox-settled: s4-02-page-line-needs-repo-name -->

<!-- omni-outbox-settled: s5-01-settled-meanwhile-asks-before-github -->

## s5-01-settled-meanwhile-asks-before-github — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-settled-meanwhile-asks-before-github
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

When some answers are left out because their questions were settled while the person was answering, should the page stop and say so before going to GitHub, or go straight on?

## The decision, in plain words

The page stops, names the questions it left out, and offers one button to send the rest through GitHub. When nothing is left out, it goes straight to GitHub.

## The intro, for fun

Someone else answered while you were still thinking it over.

## The punchline, for fun

The page tells you before it posts, not after.

## The options, in plain words

A. Stop and say which questions were left out, then send the rest on one click.
B. Go straight to GitHub and say which were left out once the person comes back.
C. Refuse to send at all until the person reviews the page again.

## What I had to decide

The spec says a pick settled meanwhile is dropped and the tab says so, but the send then leaves the page for GitHub at once, so a note on the tab would never be seen.

## What I did meanwhile

The send answer lists the dropped question numbers; the tab removes those picks, shows which questions were left out, and waits for the person to press Send the rest through GitHub.

## What it costs to change later

One branch in the tab's send handler: going straight on instead is a few lines, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people would rather not have the extra click in the rare case a question is settled meanwhile.

```

<!-- /omni-outbox-settled: s5-01-settled-meanwhile-asks-before-github -->

<!-- omni-outbox-settled: s5-02-sent-result-through-the-dossier-page -->

## s5-02-sent-result-through-the-dossier-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-sent-result-through-the-dossier-page
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

To show what became of a sent reply on the Outbox tab, may this slice touch the dossier page itself, which belongs to another part of the plan?

## The decision, in plain words

Yes, by the smallest change: the dossier page now hands the send's outcome through to the Outbox tab, and does nothing else with it.

## The intro, for fun

The message had to pass through a room this slice does not own.

## The punchline, for fun

It walked through without moving the furniture.

## The options, in plain words

A. Pass the outcome through the dossier page as one optional input.
B. Have the Outbox tab read the outcome itself from the address in the browser.
C. Show the outcome above the whole dossier page instead of on the tab.

## What I had to decide

The plan gives this slice the outbox folder, the outbox routes and the PRD pages, but the tab is drawn inside the dossier page component, which lives in the dossier folder.

## What I did meanwhile

The dossier page component takes one more optional input, the send's outcome, and passes it to the Outbox tab unchanged; nothing else in it changed.

## What it costs to change later

One optional input on one component: moving the outcome some other way later is a small change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the dossier page component to be shared ground for the Outbox tab's slices.

```

<!-- /omni-outbox-settled: s5-02-sent-result-through-the-dossier-page -->

<!-- omni-outbox-settled: s5-03-github-returns-to-the-host-it-left -->

## s5-03-github-returns-to-the-host-it-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-github-returns-to-the-host-it-left
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

When the page sends a person to GitHub to post their answers, should GitHub bring them back to the address they left from, or always to the one main address?

## The decision, in plain words

GitHub is asked to bring them back to the address they left from. That address must be listed in the omni-loop App's settings, or GitHub refuses and nothing is posted.

## The intro, for fun

Every round trip needs a return ticket with the right station on it.

## The punchline, for fun

GitHub only stops at the stations it was told about.

## The options, in plain words

A. Ask GitHub to return to the host the person left from.
B. Let GitHub return to the first way back the App lists.

## What I had to decide

The spec names the way back and says a person adds it to the App's settings, but not whether a send names that way back itself or leaves GitHub to use the first one listed.

## What I did meanwhile

The send asks GitHub to return to the same host the person used, so the sign-in cookie and the send's cookie are there when they come back.

## What it costs to change later

One line in the send: leaving the way back to GitHub's default instead is a one-line change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which addresses the omni-loop App's settings will list; a preview deployment will not work unless it is listed.

```

<!-- /omni-outbox-settled: s5-03-github-returns-to-the-host-it-left -->
