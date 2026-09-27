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
