# Settled outbox items — PRD 99

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-signature-name-address-shape -->

## s1-01-signature-name-address-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-signature-name-address-shape
prd: 99
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a repository renames who signs the loop's work, should the kit accept any name and address, or refuse one that would break the signature line?

## The decision, in plain words

The kit refuses a name or an address that holds a line break or an angle bracket, and says which one, because either would break the line that credits the signer. Anything else is accepted, and the footer is free text.

## The intro, for fun

A signature is a small thing until someone puts a line break in it.

## The punchline, for fun

Angle brackets belong around the address, not inside the name.

## The options, in plain words

A. Refuse a name or address holding a line break or an angle bracket, and accept anything else, the option built.
B. Accept any non-empty name and address, and let a broken signature line go out as written.
C. Also require the address to look like an e-mail address, refusing more configs.

## What I had to decide

How strict the `signature` config section is about `name` and `email`. The spec (The signature) says an unknown key under `signature` is refused, as everywhere in the config, and that `omni sign trailer` prints `Co-authored-by: <name> <email>`; it says nothing about what a name or an address may hold. A name like `Omni <Man>` or an address with a newline would make `omni sign trailer` print a line no git or GitHub reader takes for a co-author, and `omni phase0` would then look for that broken line.

## What I did meanwhile

`kit/lib/config.mjs`: `signature.name` and `signature.email` must be non-empty, one line, with no `<` or `>` (`trailerPart`); a violation is a config error naming `signature.name` or `signature.email`, like any other bad key. `signature.footer` only has to be non-empty. Tested in `kit/lib/config.test.mjs` (the signature section block).

## What it costs to change later

One regular expression in `kit/lib/config.mjs` and one test. Loosening it later breaks no config that parses today; tightening it further (say, a real e-mail shape) could refuse a config a repository already wrote.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a repository may sign with a name or an address that is not a valid co-author line, or whether the kit should check the address is an e-mail at all.

```

<!-- /omni-outbox-settled: s1-01-signature-name-address-shape -->

<!-- omni-outbox-settled: s1-02-bot-login-older-noreply-address -->

## s1-02-bot-login-older-noreply-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-bot-login-older-noreply-address
prd: 99
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the kit works out which GitHub account a signing address belongs to, should it also understand GitHub's older private addresses, which carry the account name but no number?

## The decision, in plain words

The kit reads the account name from both kinds of GitHub private address, the current one with a number and the older one with the name alone. Any other address belongs to no account.

## The intro, for fun

Some addresses were handed out before GitHub started numbering them.

## The punchline, for fun

Old addresses still get their mail, so they get a name too.

## The options, in plain words

A. Read the account name from both noreply shapes, the option built.
B. Read it only from the current shape, between the plus sign and the at sign, and treat an older address as no account.

## What I had to decide

What `botLogin` in `kit/lib/signature.mjs` returns for a noreply address with no numeric id. The spec (`omni credits`, What it reads) names the bot account as "the login in the email, between `+` and `@`", and its test seams say "the bot login read from a noreply address and `null` from any other". GitHub hands out two noreply shapes: `<id>+<login>@users.noreply.github.com` today, and `<login>@users.noreply.github.com` for accounts that set it before the id was added. The first sentence covers only the first shape; the second covers both.

## What I did meanwhile

`botLogin` matches `^(?:\d+\+)?([^\s@+]+)@users\.noreply\.github\.com$` (case-insensitive): `omni-loop-invader[bot]` from the default address, `octocat` from either shape, `null` for every other address. Tested in `kit/lib/signature.test.mjs` (the bot login block). Only `omni credits` (slices s3 and s4) will call it; nothing in this slice does.

## What it costs to change later

One regular expression and one test in `kit/lib/signature.mjs`. Dropping the older shape later only changes `omni credits` for a repository whose signature address is an older noreply one, which the default is not.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a signature address may be an older noreply address with no id, or what `omni credits` should do with one.

```

<!-- /omni-outbox-settled: s1-02-bot-login-older-noreply-address -->

<!-- omni-outbox-settled: s2-01-footer-guard-what-counts-as-opening -->

## s2-01-footer-guard-what-counts-as-opening — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-footer-guard-what-counts-as-opening
prd: 99
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

How does the automatic check tell that a skill opens a pull request or an issue, and so must end it with the loop's signature line?

## The decision, in plain words

A skill counts when it runs the command that opens one, rewrites a description, or says in words that it opens one. A skill that only posts comments is left alone, since comments are never signed.

## The intro, for fun

A check that reads instructions has to decide what counts as opening a door.

## The punchline, for fun

Knocking is a comment; walking in is a pull request.

## The options, in plain words

A. Count a skill as opening one when it runs the opening command, rewrites a description, or says in words that it opens one, the option built.
B. Count only a skill that runs the opening command itself, so a skill that hands the opening to another skill is not held to the rule.
C. Hold every skill to both signature lines, whatever it does, and stop reading its words.

## What I had to decide

What the new rule in `kit/test/plugin.test.mjs` treats as "a SKILL.md that opens a pull request or an issue" (spec, Acceptance criteria 5; the plan's s2 "done when"). The spec lists the bodies that are signed and says a body a skill rewrites later keeps its footer, but not how a guard reading skill prose recognises them. `/omni:plan`, `/omni:terraform` and `/omni:do-work` open their pull requests through `/omni:pr` and never name `gh pr create` themselves, so a guard that reads commands alone would not hold them to the rule.

## What I did meanwhile

The guard counts a SKILL.md as opening one when it names `gh pr create` or `gh issue create`, rewrites a body with `gh pr edit … --body`, or says "open(s) it/the/a … PR, pull request or issue" in prose, across a line break (a phrase with "in" or "on" before the noun is skipped, so "opens the question in the pull request's outbox comment" is no opening). `gh pr comment` and `gh issue comment` count for nothing. All eight skills name `omni sign footer`, so the live check passes; fixture skills in the same file show each way in, the comment-only case, and a skill dropping either line.

## What it costs to change later

Three regular expressions and their fixture cases in `kit/test/plugin.test.mjs`; no skill's prose changes. Narrowing the rule to commands only stops holding `/omni:plan`, `/omni:terraform` and `/omni:do-work` to it; holding every skill to both lines unconditionally needs no skill change today, since all eight already name both.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how the plugin guard recognises a skill that opens a pull request or an issue, nor whether rewriting a body counts as opening one; it says only that a rewritten body keeps its footer.
- (author) A future skill that opens a pull request in other words ("create a pull request", "raise a PR") would escape the prose rule; the guard reads the verb "open" only.

```

<!-- /omni-outbox-settled: s2-01-footer-guard-what-counts-as-opening -->

<!-- omni-outbox-settled: s3-01-since-narrows-signing-boundary -->

## s3-01-since-narrows-signing-boundary — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-since-narrows-signing-boundary
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When someone asks for the record from a given month on, should the kit judge whether an unsigned pull request was missed only from what it read in that window, or look further back to find when signing really began?

## The decision, in plain words

The kit only reads from the chosen month on, so it judges an unsigned pull request against the first signed one it finds in that window. Asked for the whole history, which is the default, it judges against the real start of signing.

## The intro, for fun

A window onto the past only shows what is inside the frame.

## The punchline, for fun

Nobody can be late to a meeting the diary does not show.

## The options, in plain words

A. A. Narrow every search to the window, and judge against the first signed item inside it, the option built.
B. B. Narrow the label searches only, and read every signed item of the whole history to find the real start of signing.
C. C. Narrow every search, and add one small search per repository for its oldest signed item.

## What I had to decide

Whether `--since` narrows every query `omni credits` runs, or only some. The spec says `--since` narrows to items created from that month on, and that `--since` and `--repo` narrow the searches so they stay under GitHub's 1,000-result cap (Risks, Search limits). It also says an unsigned pull request is `before signing` or `missed` around its repository's first signed item (How each one is classified). When every search is narrowed, a repository's first signed item before the window is never read, so an unsigned pull request early in the window, created before any signed one inside it, reads as `before signing` although signing had begun.

## What I did meanwhile

`kit/lib/credits/reader.mjs` adds `--created >=<month>-01` to every pull request search and `--committer-date >=<month>-01` to the commit search, the signature ones included. `kit/lib/credits/classify.mjs` takes each repository's first signed item among the pull requests it counts, all inside the window. Without `--since` (the default) nothing is narrowed and the boundary is the real one. Tested in `kit/lib/credits/reader.test.mjs` (the queries block) and `kit/lib/credits/classify.test.mjs` (the since block).

## What it costs to change later

Two arguments in `kit/lib/credits/reader.mjs`: leaving `--created` off the body search and `--committer-date` off the commit search reads the signed items of the whole history, at the price of more search results against the cap and the rate limit. No stored data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether `--since` should also narrow the searches that find signed items, or whether the signing boundary should be read from the whole history.

```

<!-- /omni-outbox-settled: s3-01-since-narrows-signing-boundary -->

<!-- omni-outbox-settled: s3-02-credits-other-github-failures -->

## s3-02-credits-other-github-failures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-credits-other-github-failures
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When GitHub fails the record for a reason other than a missing tool, a lost login or a speed limit, should the kit stop with one plain line, or carry on with what it could read?

## The decision, in plain words

If a search fails for any reason, the kit stops and says so in one line, the same way it does for the three failures the design names. If only one pull request, named by a signed commit, cannot be opened, the kit counts the rest and warns about that one.

## The intro, for fun

Sometimes GitHub just says no and does not say why.

## The punchline, for fun

Half a record would look like a whole one, so it stops.

## The options, in plain words

A. A. Any failed search stops the run with one line and exit 2; a pull request a signed commit names that cannot be opened is a warning, the option built.
B. B. Any failed search is a warning, and the report prints with what was read.
C. C. Any failure at all, the single pull request included, stops the run with exit 2.

## What I had to decide

What `omni credits` does when `gh` fails in a way the spec does not name. The spec (`omni credits`, and AC 10) says a missing or logged-out `gh`, or a rate limit, exits 2 with one line saying so. It says nothing of any other failure: a server error, a network cut, or a `(#<n>)` in a signed commit's subject that names an issue or a pull request the login cannot see.

## What I did meanwhile

`kit/lib/credits/reader.mjs` (`unreadable`): any other failed search is a `GitHubUnreadable` with reason `failed`, and `omni credits` exits 2 with one line, `omni credits: gh failed: <gh's first line>`, printing no report. A `gh pr view` of a pull request a signed commit names that fails that way is a warning (`<repo>#<n>, named by a signed commit, could not be read: …`) and that pull request is not counted; a missing or logged-out `gh` or a rate limit there still stops the run. Tested in `kit/lib/credits/reader.test.mjs` (the when gh cannot be read block, and the what it keeps block).

## What it costs to change later

One branch in `kit/lib/credits/reader.mjs`: a failed search could become a warning like the view does, or the view a stop like the searches. The exit code is the only contract a caller reads; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names three ways `gh` cannot be read and says nothing of any other failure, nor of a merged-by number that is not a readable pull request.

```

<!-- /omni-outbox-settled: s3-02-credits-other-github-failures -->

<!-- omni-outbox-settled: s3-03-credits-heading-when-signing-off -->

## s3-03-credits-heading-when-signing-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-credits-heading-when-signing-off
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

In a repository that switched signing off, whose name should head the record of the loop's work?

## The decision, in plain words

The record is headed with the name of the loop itself, because signing off leaves no signer's name to show. The count still covers every labelled pull request, and the line about signing says it is off.

## The intro, for fun

A report with signing off still needs a name at the top.

## The punchline, for fun

When the hero takes the day off, the team takes the credit.

## The options, in plain words

A. A. Head it with the loop's own name, the option built.
B. B. Head it with the kit's default signer's name, as if signing were on.
C. C. Leave the name out, and start the heading with the organisation.

## What I had to decide

The first word of the `omni credits` report when the config says `signature: null`. The spec's example heading is the signature's name, then the organisation, then the period (`omni credits`, What it prints), and it says that with `signature: null` the pull requests still count and the signature line reads `signing is off in this repository`. With signing off there is no configured name to print.

## What I did meanwhile

`kit/lib/credits/report.mjs` (`creditsReport`) prints `Omni Loop · <scope> · <period>` when the name is null, and the signature line reads `signing is off in this repository`. Tested in `kit/lib/credits/report.test.mjs` and `kit/bin/credits.test.mjs` (the signature null cases).

## What it costs to change later

One string in `kit/lib/credits/report.mjs` and its two tests. Nothing reads the heading back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what heads the report when signing is off.

```

<!-- /omni-outbox-settled: s3-03-credits-heading-when-signing-off -->

<!-- omni-outbox-settled: s4-01-credits-app-items-counted-apart -->

## s4-01-credits-app-items-counted-apart — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-credits-app-items-counted-apart
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the loop's own GitHub app opens an issue or a pull request, should the record count it with the loop's other pull requests and PRD issues, or on a line of its own?

## The decision, in plain words

Whatever the app opened is counted on a line of its own, marked as by the app, and never inside the pull request or PRD issue counts. It never decides when signing started in a repository either.

## The intro, for fun

The app and the skills work for the same hero, but they keep separate timesheets.

## The punchline, for fun

Nobody gets counted twice at the same party.

## The options, in plain words

A. Count what the app opened on its own line only, never in the pull request or PRD issue counts, the option built.
B. Also count what the app opened in the pull request and PRD issue counts, with a by-the-app share in each breakdown.
C. Count what the app opened in the pull request and PRD issue counts only when a loop label or the signature also says it is the loop's.

## What I had to decide

Where `omni credits` counts an issue or a pull request the signature's bot account opened (spec, `omni credits`: What it reads, Whose it is, and the signature table's `by the app`). The spec's example prints `Opened by the app: 9 issues` on a line of its own, and its `PRs` and `PRD issues` breakdowns (`signed · before signing · missed`) add up to their totals with no `by the app` share. It does not say whether an item the app opened that also carries a loop label, or any pull request the app opened, counts in those lines too, nor whether it can mark a repository's first signed item.

## What I did meanwhile

`kit/lib/credits/classify.mjs`: an item whose author is the bot account (`<slug>[bot]`, or `app/<slug>` as `gh pr view` prints it) gets the reason `author` and the signature `by the app`, which wins over `signed`, `before signing` and `missed`. `summarize` counts it under `byTheApp` (issues and pull requests apart), never in `prs`, `prdIssues`, `byRepo` or `byMonth`, and `withSignatures` never takes it as a repository's first signed item. A pull request the app opened and closed without merging is not counted, like any other. `kit/lib/credits/report.mjs` prints `Opened by the app: <n> issue(s)`, adding ` · <m> pull request(s)` when there are any. Tested in `kit/lib/credits/classify.test.mjs` (the opened by the app and summarize blocks) and `kit/lib/credits/report.test.mjs`.

## What it costs to change later

A few lines in `summarize` and one in `withSignatures` (`kit/lib/credits/classify.mjs`), and their tests. Nothing is stored: the next run simply counts the other way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether an item the app opened is also counted in the pull request and PRD issue lines, nor whether it can mark the start of signing in a repository.

```

<!-- /omni-outbox-settled: s4-01-credits-app-items-counted-apart -->

<!-- omni-outbox-settled: s4-02-credits-list-after-the-summary -->

## s4-02-credits-list-after-the-summary — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-credits-list-after-the-summary
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When someone asks the record for its list of items, should the summary still print above the list, or should the list stand alone?

## The decision, in plain words

The summary prints first, then a blank line, then one line per item, since the design says the list is added. Asked for the machine-readable form as well, only that prints, because it already holds the list.

## The intro, for fun

The design's words and its picture disagreed about what sits above the list.

## The punchline, for fun

The words won, and the picture keeps its artistic licence.

## The options, in plain words

A. Print the summary, then the list, the option built.
B. Print the list alone, as the before-after page shows it.

## What I had to decide

What `omni credits --list` prints. The spec says `--list` adds one line per item, oldest first (`omni credits`, What it prints), while the before-after page shows `omni credits --list --since 2026-09` printing item lines straight after the command, with no report above them. Neither says what `--list` and `--json` do together, nor where the warnings go under `--json`.

## What I did meanwhile

`kit/bin/commands/credits.mjs`: `--list` prints the report, a blank line, then `creditsList` (`kit/lib/credits/report.mjs`): short repository name, `#<n>`, kind, state, created date (UTC), signature (`-` when none), title, each column padded to its widest. `--json` wins over `--list`, and carries the warnings in its `warnings` field instead of stderr. Tested in `kit/bin/credits.test.mjs` (the --list and --json cases) and `kit/lib/credits/report.test.mjs`.

## What it costs to change later

Three lines in `kit/bin/commands/credits.mjs` and one test. Nothing reads the text back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the list is added, and the before-after page shows it alone; neither says what the list and the machine-readable form do together.

```

<!-- /omni-outbox-settled: s4-02-credits-list-after-the-summary -->

<!-- omni-outbox-settled: s4-03-credits-lines-not-looked-for -->

## s4-03-credits-lines-not-looked-for — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-credits-lines-not-looked-for
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When a repository has switched signing off, or its signing address belongs to no GitHub account, what should the record show for the counts only a signature can find?

## The decision, in plain words

The record leaves out what it never looked for rather than printing zeros: with signing off, the PRD issues count stands alone and the app and co-authored commit lines go. With an address that names no account, only the app line goes.

## The intro, for fun

A zero you counted and a zero you never looked for look exactly the same on paper.

## The punchline, for fun

So the record leaves a gap instead of telling a small lie.

## The options, in plain words

A. Leave out what was not looked for, the option built.
B. Print every line, with zeros where nothing was looked for.
C. Print every line, saying it was not looked for in place of a count.

## What I had to decide

What `omni credits` prints for the lines slice s4 adds when the signature cannot find them. The spec says that with `signature: null` the pull requests and issues are still counted by label and the signature line reads `signing is off in this repository` (`omni credits`, What it prints). It names no rule for the PRD issues breakdown, `Opened by the app` or `Co-authored commits on default branches` then, nor for a signature whose address is not a noreply address, which names no bot account (`botLogin` returns `null`).

## What I did meanwhile

`kit/lib/credits/report.mjs`: with signing off the PRD issues line is `PRD issues <n>` with no breakdown, and the `Opened by the app` and `Co-authored commits on default branches` lines are left out; with signing on but no bot account, only `Opened by the app` is left out. `kit/lib/credits/reader.mjs` runs no author search when there is no bot account. Under `--json`, `totals.byTheApp` and `totals.commits` are `null` when they were not looked for, and `commits` is `[]`. Tested in `kit/lib/credits/report.test.mjs`, `kit/lib/credits/reader.test.mjs` and `kit/bin/credits.test.mjs` (the signature null cases).

## What it costs to change later

Two conditions in `creditsReport` (`kit/lib/credits/report.mjs`), the matching `null`s in `summarize`, and their tests. Nothing reads the text back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says what the signature line reads with signing off, but not what the PRD issues breakdown, the app line or the commits line do then, nor what happens when the signing address names no GitHub account.

```

<!-- /omni-outbox-settled: s4-03-credits-lines-not-looked-for -->
