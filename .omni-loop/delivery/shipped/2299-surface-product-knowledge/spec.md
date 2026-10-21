---
prd: 2299
title: Agents read the product's knowledge
blocked-by: none
spec: file
phase0: server
---

## Problem

A product's Knowledge tab holds its Constituents, Personas, Legal entries and Glossary (PRD 2240).
Only the constituents reach an agent on their own: the plugin's `SessionStart` hook prints them
(`omni constituents`, PRD 871). The rest stays on the page unless someone asks for it:

- **Glossary.** The skills read the glossary from a file, `paths.glossary`, which is `null` in most
  repositories (this one included), and never from the page. The page's 35 terms reach an agent only
  through `omni kb glossary`, which no skill runs. An agent writes "team" when the product says
  "workspace".
- **Legal.** Read only through `omni kb legal`; no skill reads it, so a spec touching personal data
  names no L-GDPR entry.
- **Personas.** Read by `/omni:brainstorm` alone (`omni business show`, its voice); every other
  session knows nothing of who the product is for.
- **Avoided words.** The code that reads the glossary's avoided words was written in PRD 1795
  (`kit/lib/design/words/product.ts`, `productAvoids`) and nothing calls it.

The session's context budget is also near its ceiling: `omni check context` measures `session` at
9.8 KB of 10 KB, so printing the whole knowledge at every start is not an option.

## Solution

**1. A capped index at session start.** A new read, `omni kb index [--json]`, run by a second
`SessionStart` hook in the plugin, right after `omni constituents` (unchanged):

- One read, `GET /api/business?repo=`, which already answers `legal`, `glossary` and `personas`. The
  copy `omni kb glossary` keeps, `.omni-loop/local/product-knowledge.json`, now also keeps
  `personas` (name and stance).
- It prints one block of at most **3 KB**:

  ```text
  Knowledge of omni-loop (synced just now): words to use, laws to respect, people to build for.
  Words: Workspace (not: team) · Runner (not: bot, worker) · Skill · Fleet · …
         → meanings: omni kb glossary
  Legal: L-GDPR-1 Only members of a workspace may read the personal data it holds… · L-AIACT-1 … · …
         → sources: omni kb legal
  Personas: F-E Developer (skeptical) · B-E DEv (skeptical) · Paul - Product Manager (excited) · …
         → who they are: omni business show
  ```

  Words are the terms, each with its avoided words when it has some, no meaning. Legal is each id
  with its whole statement. Personas are each name with its stance. A list that would pass the cap
  is cut at a whole item and ends `… <n> more: <its command>`; nothing is cut silently.
- Like `omni constituents`, it never holds up a session: one 3-second budget for the whole read,
  exit 0 on every outcome. Offline or failing, it prints the copy with its age
  (`synced 2 d ago, offline`); with no copy, no product, no sign-in or no knowledge, one line ending
  `— agents carry on`. An archived product prints its one line, as `omni kb glossary` does.
- `--json` prints `{ state, product, words, legal, personas, syncedAt, cut }`, the states those of
  `omni constituents`.

**2. The skills pull the full text at the step that needs it.**

| Skill | Step | Reads, beside what it reads today |
|---|---|---|
| `/omni:brainstorm` | its words (steps 4 and 6) and **Risks** | `omni kb glossary`; `omni kb legal`, naming in **Risks** each entry the design touches, as it names locked laws |
| `/omni:plan` | step 2, the spec and its context | `omni kb glossary` |
| `/omni:do-work` | step 4, the context it reads | `omni kb glossary`; `omni kb legal` when the slice touches personal data, keys, logs or licences |
| `/omni:bug-fix` | the nouns and verbs of the reproduction | `omni kb glossary` |

A repository's own glossary file (`paths.glossary`) is still read; when a term is in both, **the
page wins**: it is shared by every repository of the product. Offline or with no product, the
command prints its copy or its one line and the skill carries on with what it has.

**3. The avoided words count.**

- **Screens:** `omni design words` (the word pass) adds the glossary's avoided words, through
  `productAvoids`, to the design form's own. Its finding names the term to use:
  `avoided word: team → say Workspace`.
- **Specs:** `omni check inbox` prints, for each spec in the inbox, one line per avoided word it
  holds, `<folder>/spec.md: "team" ×3 → say Workspace`, matched whole and without case. These lines
  are **warnings: they never turn the check red** and never change its exit code.
- Both read the local copy only, never the server: they stay offline and fast. No copy, no warning.

**The kit:** `kit/bin/commands/kb.ts` gains `index`; `kit/lib/product/knowledge.ts` keeps
`personas` in the copy; a new `kit/lib/product/index.ts` lays out the capped block;
`kit/plugin/hooks/hooks.json` gains the hook; `kit/bin/commands/design.ts` and
`kit/lib/inbox/check-inbox.ts` use `productAvoids`; the four skills and the help entries say what
they read. `kit/dist/` is rebuilt. No app or database change.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | CLI | `omni kb index [--json]` | no written convention: follows `kit/bin/commands/kb.ts` (`omni kb legal`, `omni kb glossary`) and `kit/bin/commands/constituents.ts` (its budget and states) |
| vertuo-omni-loop | lib | `kit/lib/product/index.ts` (`indexLines`) | no written convention: follows `kit/lib/product/knowledge.ts` (`legalLines`, `glossaryLines`) |
| vertuo-omni-loop | hook | the second `SessionStart` entry | no written convention: follows `kit/plugin/hooks/hooks.json` (the `omni constituents` entry) |

## Decisions

- **The design was approved section by section** in chat on 2026-10-21: what agents get and how it
  reaches them; the skills' pull; the avoided words, failures and tests.
- **Approach: a short index at start, the full text on demand** (the person's answer), over the
  whole knowledge at every start (about 10 KB more per session, the budget raised) and over the
  skills alone (an agent outside a skill would never see it).
- **A command and hook of its own,** not more lines from `omni constituents`: the constituents keep
  their command, their contract and their budget unchanged.
- **The cap is 3 KB, cut at a whole item with `… <n> more: <command>`;** the hook's output is not a
  `budgets` target, which measures the repository's files only (`kit/lib/budgets/measure.ts`).
- **The page's glossary wins over `paths.glossary`** on a term both define (the person's answer).
- **The avoided words are counted in this PRD** (the person's answer), as warnings that never turn a
  check red.
- **Everyday avoided words were trimmed from the page's glossary first** (the person's answer):
  user, app, project, docs, command, script, token, role, repo, wiki, prompt, so a warning names a
  word that is wrong in this product, not a common one (never#4: never wastes a person's attention).
- **The voice objected (persona:B-E DEv):** "Another block printed at every session start is more
  fluff I scroll past. If agents only need the glossary when they write a spec, give it to them
  then." Settled **none**: the person approved the index as drawn; the cap, the absence of meanings
  and the on-demand pull answer it.
- **Personas are not pulled by the other skills:** brainstorm reads them whole; the index names them.
- **No proof video** (the person's answer). E2E validation is off in this repository.
- **Not in this PRD, noted as the next ones:** harvesting knowledge at the retro (glossary terms,
  personas, principles, Never lines and Legal entries proposed from outbox answers and rules, held as
  proposed for an owner); a one-time backfill over the shipped PRDs, proposed in batches of five;
  outbox items the knowledge already answers adopted with their source.

## User stories

- As an agent starting a session in a repository of omni-loop, I read that the product says
  "Workspace", never "team", and which Legal entries hold, before my first step.
- As an agent running `/omni:do-work` on a slice that writes logs, I read `omni kb legal` and keep
  L-GDPR-4's retention in mind.
- As a person reviewing a spec, I see `spec.md: "team" ×2 → say Workspace` in `omni check inbox`, and
  the check stays green.
- As an agent offline, I start with the last copy and its age, and nothing waits.

## Scope

In: `omni kb index` and its hook; personas in the local copy; the capped layout; the four skills'
reads; the avoided words in the word pass and in `omni check inbox`; help entries; the rebuilt
`kit/dist/`.

Out: any app, route or database change; printing the meanings or the Legal sources at start;
the retro harvest, the backfill and the outbox auto-adoption (Decisions); changing `paths.glossary`
files.

## Test seams

Following `omni kb show testing` (vitest, one run; never calls GitHub):

- **`omni kb index`, end to end** through `main()` against `kit/test/fake-ask-server.ts`, as
  `kit/bin/kb.test.ts` reads `omni kb glossary`: the block printed, `--json`, exit 0; the cut at the
  cap with `… <n> more`; offline with a copy (its age) and without one; no product; no sign-in; an
  archived product; the 3-second budget held by a server that never answers.
- **The layout,** `kit/lib/product/index.ts`, unit tests: terms with and without avoided words, no
  persona, no legal, the cut at a whole item.
- **The copy** keeps `personas`, and an older copy without them still reads.
- **The word pass:** `omni design words` names a glossary word and its term on an "after" screen;
  none without a copy.
- **`omni check inbox`:** a spec holding an avoided word prints the grouped warning and stays green;
  matched whole, any case, never inside another word.
- **The plugin:** `kit/test/plugin.test.ts` asserts the hook entry, and that each of the four skills
  names `omni kb glossary` (and brainstorm and do-work `omni kb legal`).

## Risks

- **Publishes:** a kit release: a new command, a second session-start hook, and skill text. Rollback:
  revert the feature PR; the copy's added `personas` field is ignored by older kits
  (`omni kb show releasing`).
- **Every session reads more:** at most 3 KB, capped and tested.
- **A hook that hangs or fails:** the read holds one 3-second budget and exits 0 on every outcome, as
  `omni constituents` does.
- **The locked laws** `omni kb laws` prints for the files this design changes:
  - N-PRODUCT-7: a broken hook never blocks a person's message or question. If broken, a person is
    locked out of their own terminal by the new hook. The hook exits 0 within its budget, and the
    hook entry ends `|| true`. Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-8: the ask hooks only call the address the repository set, and only on the host the
    session saved. If broken, a session's sign-in could be sent to a server nobody chose. The read
    uses the repository's `ask.url` and its saved sign-in, as `omni constituents` does. Changing it
    needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-4: a pull request can never change the rules it is judged by. If broken, a change to
    `omni check inbox` could switch its own gate off. The new lines are warnings and never change the
    exit code. Changing it needs @pierrederval to approve the pull request on GitHub.
  - BR-PRODUCT-3, BR-PRODUCT-5, BR-PRODUCT-6, BR-PRODUCT-12, BR-PRODUCT-28, BR-PRODUCT-29,
    BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-63, BR-PRODUCT-64, BR-PRODUCT-94, N-PRODUCT-3,
    N-PRODUCT-13, N-PRODUCT-14, N-PRODUCT-15, N-PRODUCT-16, N-PRODUCT-17: printed for every path, none
    changed by this design. Changing any of them needs @pierrederval to approve the pull request on
    GitHub.
- **The Legal entries it touches:** L-GDPR-1 (only members read personal data): the index prints
  persona names and Legal text, no personal data, and reads with the member's own sign-in.

## Acceptance criteria

1. A session starting in a repository whose product has knowledge prints, after the constituents, the
   `Knowledge of <product>` block: the glossary's terms with their avoided words, each Legal id with
   its statement, each persona with its stance, and the three commands.
2. The block is at most 3 KB; a longer list ends with `… <n> more: <command>`, cut at a whole item.
3. Offline, the block is the last copy with its age; with no copy, no product, no sign-in or no
   knowledge, it is one line ending `— agents carry on`; every outcome exits 0 within 3 seconds.
4. `omni kb index --json` prints `{ state, product, words, legal, personas, syncedAt, cut }`.
5. `/omni:brainstorm`, `/omni:plan`, `/omni:do-work` and `/omni:bug-fix` read `omni kb glossary` at the
   step their words come from; brainstorm names the Legal entries a design touches in **Risks**;
   do-work reads `omni kb legal` for a slice touching personal data, keys, logs or licences; the page
   wins over `paths.glossary` on a shared term.
6. `omni design words` reports a glossary avoided word on an "after" screen as
   `avoided word: <word> → say <term>`.
7. `omni check inbox` prints `<folder>/spec.md: "<word>" ×<n> → say <term>` for each avoided word in
   an inbox spec, and its exit code is unchanged.
8. `omni help kb` lists `index`; `kit/dist/` is rebuilt and `kit/test/dist.test.ts` passes.
