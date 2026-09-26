# Settled outbox items — PRD 100

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-migration-after-ask-mode -->

## s1-01-migration-after-ask-mode — adopted

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
id: s1-01-migration-after-ask-mode
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Two projects change the game's database at the same time: workspaces, and the ask mode. In which order should their changes apply?

## The decision, in plain words

The workspaces change is dated after the ask mode's, so it applies last whichever ships first. If the ask mode ships first, the workspaces change stops with an error instead of quietly removing the ask mode's access rules, and the workspaces branch rewrites those rules for membership before it ships.

## The intro, for fun

Two database changes walk into production. Only one of them can go first.

## The punchline, for fun

We picked the polite one: it waits its turn, and it complains loudly if pushed.

## The options, in plain words

A. Date the workspaces change after the ask mode's, and let it stop loudly if the ask mode landed first. This is what was built.
B. Date it today, before the ask mode's, so the ask mode must be re-dated and rewritten if it ships second.
C. Have the workspaces change remove the ask mode's access rules by force when they exist, and rebuild them for membership in the same change.

## What I had to decide

The migration's timestamp. PRD #71 (ask-mode, `feat/ask-mode`) adds `20260926090000_ask_sessions.sql` and `20260926100000_ask_cli_codes.sql`, whose policies call `is_crew()`, which this migration drops. `supabase db push` refuses a local migration dated before the last one applied to production, so a workspaces migration dated today (`20260925…`) would be refused outright if #71 shipped first.

## What I did meanwhile

Named it `supabase/migrations/20260926120000_workspaces.sql`, after both of #71's. `drop function public.is_crew()` carries no `cascade`: if #71 has shipped first, the drop fails on #71's policies and the deploy stops, rather than silently dropping #71's row-level security. The spec's Risks already say #71 must move to `is_member()`; whichever PRD ships second merges `main` and does that rewrite.

## What it costs to change later

Renaming one file before the feature PR merges. Once production has applied it, the name is history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which of #71 and #100 ships first is not decided anywhere (author)

```

<!-- /omni-outbox-settled: s1-01-migration-after-ask-mode -->

<!-- omni-outbox-settled: s1-02-theme-colours-lowercase -->

## s1-02-theme-colours-lowercase — adopted

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
id: s1-02-theme-colours-lowercase
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should a workspace's colours be accepted only in lowercase, as the fleets' colours are, or in any case?

## The decision, in plain words

Only lowercase six-digit colours are accepted, the same rule the fleet colours already follow. A browser's colour picker gives colours in that form.

## The intro, for fun

Is a colour written in capital letters shouting, or just very excited about purple?

## The punchline, for fun

The database decided it is shouting, and asked for its indoor voice.

## The options, in plain words

A. Lowercase only, like the fleet colours. This is what was built.
B. Any case, turned into lowercase when it is stored.
C. Any case, stored exactly as typed.

## What I had to decide

`valid_theme()` checks each value against `^#[0-9a-f]{6}$`, as `teams_color_hex` does. The spec writes `#rrggbb` but does not say whether `#A45CFF` passes. s6's zod schema must apply the same rule, since its `theme.test.ts` reads the token list from this migration.

## What I did meanwhile

Lowercase only. `supabase/checks/access.sql` pins it: `{"plasma": "#A45CFF"}` is refused.

## What it costs to change later

The regex in `valid_theme()` (a forward migration that redefines it) and the matching zod rule in s6. Themes already stored stay valid either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how PRD 3's settings page will let people type a colour, and so whether capitals will reach the database at all, is not known yet (author)

```

<!-- /omni-outbox-settled: s1-02-theme-colours-lowercase -->

<!-- omni-outbox-settled: s1-03-link-github-needs-a-workspace -->

## s1-03-link-github-needs-a-workspace — adopted

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
id: s1-03-link-github-needs-a-workspace
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should someone who belongs to no workspace be able to link their GitHub account?

## The decision, in plain words

No: linking answers only people who belong to at least one workspace, as it answered only Vertuoza accounts before. Its refusal no longer names Vertuoza.

## The intro, for fun

Linking GitHub without a workspace is like getting a locker key without a gym membership.

## The punchline, for fun

Harmless, maybe, but the front desk still asks which gym you are with.

## The options, in plain words

A. Refuse people who belong to no workspace, as other domains were refused before. This is what was built.
B. Answer anyone signed in; someone with no workspace simply has no player to update.

## What I had to decide

`link_github()` used to refuse any caller for whom `is_crew()` was false, with 'Sign in with your vertuoza.com account first.' The spec says what it refreshes (every player row of the caller) but not whom it refuses. It now raises 42501 for a caller with no `workspace_members` row: 'Sign in with an account of a workspace first.' The auth callback shows that message, so s5 should call `join_by_domain()` before `link_github()`; otherwise a session that predates the migration and links GitHub first is refused once.

## What I did meanwhile

Membership guard in `link_github()`; `supabase/checks/access.sql` proves an outsider with GitHub linked is refused, and a member is answered.

## What it costs to change later

One condition and one message in `link_github()`, redefined by a forward migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the order in which s5's auth callback calls join_by_domain() and link_github() is s5's to settle, and is not built yet (author)

```

<!-- /omni-outbox-settled: s1-03-link-github-needs-a-workspace -->

<!-- omni-outbox-settled: s4-01-game-scripts-refuse-stray-arguments -->

## s4-01-game-scripts-refuse-stray-arguments — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-game-scripts-refuse-stray-arguments
prd: 100
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a game command is given something it does not understand, should it stop, or carry on as if it had not been given it?

## The decision, in plain words

It stops and says what it did not understand. Before, the polling command ignored everything it was given, so a misspelt workspace option would have quietly polled whichever workspace the setting named.

## The intro, for fun

A command that nods politely at words it does not know is how the wrong workspace gets polled.

## The punchline, for fun

Now it frowns and asks again, which is less polite and much kinder to the ledger.

## The options, in plain words

A. Stop on anything not understood, and say what it was. This is what was built.
B. Ignore what is not understood, as the commands did before, and use whichever workspace is named.
C. Warn about what is not understood, and carry on.

## What I had to decide

The spec asks every game script to take `--workspace <slug>`, falling back to `OMNI_LOOP_WORKSPACE`, and to fail loudly without one (D11), but says nothing of other arguments. `game/cli/project.mjs` read no argument at all, and `game/cli/banner.mjs` and `game/cli/export.mjs` ignored anything after their first. Once the flag exists, a misspelt `--worksapce acme` would have been ignored while `OMNI_LOOP_WORKSPACE` named another workspace, and the poll would have appended to that one.

## What I did meanwhile

`openWorkspace()` in `game/cli/workspace.mjs` parses each script's own arguments before any read: `game:project` takes none, `game:banner` exactly one PRD number, `game:export` exactly one directory, and `game:score` what `scoreArgs()` already accepted (it already refused the rest). Anything else exits 2 with the usage line, before Supabase or GitHub is called. `game/cli/scripts.test.mjs` pins it for all four scripts.

## What it costs to change later

A constant per script: the `parse` function each passes to `openWorkspace()`. Nothing stored changes, and the game workflow passes no extra argument.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anything outside this repository runs the game scripts with arguments they used to ignore is not known (author)

```

<!-- /omni-outbox-settled: s4-01-game-scripts-refuse-stray-arguments -->

<!-- omni-outbox-settled: fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace -->

## fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: fix-s1-01-migration-after-ask-mode
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace
prd: 100
slice: fix-s1-01-migration-after-ask-mode
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Now that people reach the game through workspaces, who may use ask mode, the page where Claude's questions are answered?

## The decision, in plain words

Anyone who belongs to at least one workspace, whichever it is, and each person still sees only their own questions. A company email address alone is no longer enough.

## The intro, for fun

Ask mode used to check your email address at the door. Now it checks your badge instead.

## The punchline, for fun

Any company's badge opens it, and nobody gets to read anyone else's questions.

## The options, in plain words

A. Anyone who belongs to at least one workspace may use ask mode, and sees only their own questions. This is what was built.
B. The same, and signing in from the terminal first joins the person to their company's workspace, so ask mode works before the arcade is ever opened.
C. Only the members of one workspace, Vertuoza today, may use ask mode, and each question is filed under it.
D. Anyone signed in may use ask mode, member of a workspace or not.

## What I had to decide

PRD #71 shipped first. Its migrations `20260926090000_ask_sessions.sql` and `20260926100000_ask_cli_codes.sql` gate ask mode on `is_crew()` (a token email ending in `@vertuoza.com`): six row-level policies on `ask_sessions` and `ask_rounds`, and the body of `ask_cli_code_issue()`. s1's migration drops `is_crew()`, so the chain failed on an empty database. Item s1-01 settled that the branch shipping second rewrites them for membership. The spec says crew becomes membership (`is_member(workspace)`), and s5's row says crew means has a workspace; but the ask tables carry no `workspace_id`, and the spec does not say which workspace, if any, an ask session belongs to.

## What I did meanwhile

In `supabase/migrations/20260926120000_workspaces.sql`, before `drop function public.is_crew()` (still without cascade): a new `public.has_workspace()`, stable and security definer, true when `auth.uid()` has a `workspace_members` row in any workspace. `alter policy` on the six ask policies trades `public.is_crew()` for `(select public.has_workspace())` and keeps every owner check as #71 wrote it. `ask_cli_code_issue()` is redefined with the same guard and `link_github()`'s refusal, 'Sign in with an account of a workspace first.' (item s1-03); `link_github()` now calls `has_workspace()` too. No workspace column is added. `supabase/checks/access.sql` proves it for a member of either workspace, an account in no workspace (a vertuoza.com one included) and an anonymous visitor, and fails on any function body still calling `is_crew()`; `supabase/checks/ask.sql`'s two askers now belong to Vertuoza.

## What it costs to change later

One function body: `has_workspace()` in `supabase/migrations/20260926120000_workspaces.sql`, edited in place before the feature PR merges, redefined by a forward migration after. Option B adds one line to `ask_cli_code_issue()` in the same file. Option C would add a workspace column to `ask_sessions`, a migration with a backfill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec does not say whether an ask session belongs to a workspace or only to the person, so which workspace it would name is not known (author)
- the `omni signin` return (`next=ask-cli` in `apps/galaxy/app/auth/callback/route.ts`, then `apps/galaxy/src/ask/cli-code.ts`) never calls `join_by_domain()`, so a vertuoza.com account that has not opened the arcade since the migration is refused a sign-in code until it does; `src/ask/` is outside every slice's territory (author)
- `apps/galaxy/src/ask/auth.ts` and `cli-code.ts` still let any @vertuoza.com address through as crew (`isCrewEmail()`), so for an account in no workspace the ask API meets the database's refusal instead of its own 403 (author)

```

<!-- /omni-outbox-settled: fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace -->

<!-- omni-outbox-settled: s2-01-letters-take-five-stripes -->

## s2-01-letters-take-five-stripes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-letters-take-five-stripes
prd: 100
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The Vertuoza V is drawn in four stripes. How should the other letters of the alphabet be drawn so that each one stays readable?

## The decision, in plain words

Every letter but the V is drawn in five stripes, set closer together, so that letters with a middle stroke, like B, E, H, R and S, keep it. The V stays exactly as it is today.

## The intro, for fun

Most letters have a middle. The V never needed one.

## The punchline, for fun

So the other twenty-five got a fifth stripe, and the V kept its figure.

## The options, in plain words

A. Five stripes, closer together, for every letter but the V. This is what was built.
B. Four stripes spaced like the V's for every letter, accepting that letters with a middle stroke, like B, E and S, read less clearly.
C. Four stripes for the letters that read well with four, and five only for those that need a middle stroke.

## What I had to decide

The spec draws every letter in the V's bars (6-pixel pills with the V's stepped caps, on its 36-pixel grid, under its gradient and shade) and allows other letters to "space their rows differently to stay legible", without saying how. The V has four rows 10 pixels apart. Four rows leave no middle row for B, E, F, H, K, P, R and S, so their middle stroke has to sit high or low, and B, E and R blur together. I drew the whole sheet both ways (four rows and five) and compared them before choosing.

## What I did meanwhile

`LETTERS` in `apps/galaxy/src/arcade/mark.ts`: the V keeps today's four rows (`top: 0, pitch: 10`, pinned run for run against today's `MARK_RUNS` in `mark.test.ts`); every other letter has five rows 7 pixels apart (`top: 1, pitch: 7`, so y 1 to 35, a 1-pixel gap between rows), with stems 11 pixels wide. `bootMark` in `scenes/common.ts` spreads the reveal's row lag over the letter's rows (0.36 from the first row to the last), so a five-row letter is whole at 0.9 s, as the V is; for the V the lag is 0.12 per row, exactly today's. `mark.test.ts` holds every letter inside the 36-pixel box, in the V's pills, with no two bars of a row touching and no two letters alike.

## What it costs to change later

A constant: the glyph table in `mark.ts`. No column holds the letter (the spec), so nothing stored changes, and `mark.test.ts` still pins the V whatever the other letters become.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- nobody but the author has looked at the letters yet: whether a 1-pixel gap between stripes still reads as the brand's stripes at the boot's size is a designer's call (author)
- which letters the next workspaces will need first is not known before PRD 2 opens sign-up (author)

```

<!-- /omni-outbox-settled: s2-01-letters-take-five-stripes -->

<!-- omni-outbox-settled: s5-01-ask-mode-keeps-its-email-check -->

## s5-01-ask-mode-keeps-its-email-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-ask-mode-keeps-its-email-check
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The game now lets in whoever belongs to a workspace, whatever their email address. Should ask mode, the page where Claude's questions are answered, stop checking the email address too?

## The decision, in plain words

Not in this part of the work: the game no longer looks at the email address, but ask mode keeps its own check for a Vertuoza address in front of the workspace check. With Vertuoza the only workspace, nobody sees a difference yet.

## The intro, for fun

The game swapped its email check for a badge reader. Ask mode, next door, still squints at the address.

## The punchline, for fun

Both doors open for Vertuoza today; the second company will find out which one is stricter.

## The options, in plain words

A. Leave ask mode's own email check as it is, and let the database's membership check stand behind it. This is what was built.
B. Change ask mode to ask for a workspace instead of the email, in a follow-up slice of this plan.
C. Leave it for PRD 2, which opens sign-up to other companies and rewrites the sign-in anyway.

## What I had to decide

Whether to replace ask mode's own `isCrewEmail()` (`apps/galaxy/src/ask/auth.ts`, used by `authenticate()` and twice in `apps/galaxy/src/ask/cli-code.ts`) with a membership check. s5's row says "crew" means "has a workspace", and s5 removed the arcade's `isCrewEmail()` from `apps/galaxy/src/data/supabase-server.ts`. `src/ask/` is outside s5's territory, and outside every slice of this plan.

## What I did meanwhile

Left `src/ask/` untouched. The arcade's check is gone: the page reads memberships (`src/data/workspace.ts`) and `Session.crew` is true for a member of any workspace. Ask mode keeps its email check in front of the database's (`has_workspace()` in its policies and in `ask_cli_code_issue()`, item fix-s1-01-migration-after-ask-mode-01). In the callback, which is s5's, the terminal's sign-in (`next=ask-cli`) now calls `join_by_domain()` before its code is issued (`joinBeforeIssue()` in `src/data/sign-in.ts`), so a vertuoza.com account that has not opened the arcade since workspaces gets its code.

## What it costs to change later

A follow-up that edits `apps/galaxy/src/ask/auth.ts` and `cli-code.ts` (and their tests) to ask the database, for example `has_workspace()` through an RPC, instead of the email: a few lines and their tests, no stored shape. Until then, a member whose email is not @vertuoza.com is refused by ask mode's own 403, and a vertuoza.com account in no workspace meets the database's refusal instead of that 403.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether ask mode should follow the arcade now, or wait for PRD 2, which opens sign-up to other domains and rewrites the sign-in copy (author)
- which slice or PRD owns `src/ask/`: none of this plan's rows names it (author)

```

<!-- /omni-outbox-settled: s5-01-ask-mode-keeps-its-email-check -->

<!-- omni-outbox-settled: s5-02-out-of-reach-is-not-outsider -->

## s5-02-out-of-reach-is-not-outsider — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-out-of-reach-is-not-outsider
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When the game's database cannot be reached, the arcade cannot tell whether a signed-in person belongs to a workspace. Should it treat them as a member or turn them away?

## The decision, in plain words

It treats them as a member: they see the message that the galaxy is out of reach, never the screen that says their account is the wrong one.

## The intro, for fun

The guest list is locked in a room nobody can open right now. Who gets in?

## The punchline, for fun

Everyone gets to the lobby, and a sign there says the party is delayed.

## The options, in plain words

A. Treat them as a member, and show the out-of-reach message. This is what was built.
B. Treat them as an outsider, and show the wrong-cartridge screen until the database answers again.
C. Fall back to the email address while the database is out of reach, as before workspaces.

## What I had to decide

What `Session.crew` is when the page cannot read the person's memberships. The spec says a signed-in person with no workspace gets the outsider screen, and its Risks say an arcade deployed a few minutes before the migration shows "THE GALAXY IS OUT OF REACH" for those minutes; it does not say what "crew" is while membership cannot be read. Today's error path took crew from the email, so a Vertuoza account went on to the gate.

## What I did meanwhile

`arcadeFor()` in `apps/galaxy/src/data/arcade.ts`: when any read fails (the memberships, `join_by_domain()` or a loader), the page renders the attract mode with the built-in fleets, `problem` set to the out-of-reach message, and `crew: true`, keeping the workspace's brand when it was read before the failure. START then leads to the gate, and every galaxy screen answers with the out-of-reach toast, as before. `arcade.test.ts` pins it. Nothing becomes readable: row-level security still refuses a non-member.

## What it costs to change later

One boolean in `arcadeFor()`'s error path, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person outside every workspace should rather see the wrong-cartridge screen during an outage, at the price of a Vertuoza member seeing it too (author)

```

<!-- /omni-outbox-settled: s5-02-out-of-reach-is-not-outsider -->

<!-- omni-outbox-settled: s5-03-joining-at-sign-in-is-best-effort -->

## s5-03-joining-at-sign-in-is-best-effort — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-joining-at-sign-in-is-best-effort
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Every sign-in now adds the person to their company's workspace. If that step fails, should the sign-in fail with it?

## The decision, in plain words

No: the sign-in goes on, the failure is written to the server's log, and the arcade tries the joining once more when the page opens.

## The intro, for fun

The door opened, but the guest book pen ran out of ink.

## The punchline, for fun

We let the guest in and asked them to sign on the way to the coat rack.

## The options, in plain words

A. Carry on, log the failure, and let the page join once more. This is what was built.
B. Stop the sign-in and send the person back to INSERT COIN with a message asking them to try again.

## What I had to decide

What the auth callback does when `join_by_domain()` fails after a sign-in. The spec says the callback calls it after every sign-in, beside `link_github()`, and that the page calls it once more for a person with no membership; it does not say whether a failed call stops the sign-in.

## What I did meanwhile

`afterSignIn()` and `joinBeforeIssue()` in `apps/galaxy/src/data/sign-in.ts` catch the error, log it, and carry on: a plain sign-in returns to the arcade as usual, whose page joins once more (`memberWorkspace()` in `src/data/workspace.ts`); a GitHub link goes on to `link_github()`, which refuses a person in no workspace with its own message; the terminal's sign-in goes on to `ask_cli_code_issue()`, which refuses the same way. `sign-in.test.ts` pins all three.

## What it costs to change later

A few lines in `apps/galaxy/src/data/sign-in.ts` and their tests: returning a `signin_error` instead of carrying on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often the joining could fail while the sign-in itself succeeded, since both reach the same Supabase project, is not known (author)

```

<!-- /omni-outbox-settled: s5-03-joining-at-sign-in-is-best-effort -->

<!-- omni-outbox-settled: s6-01-game-boy-body-colours-are-tokens -->

## s6-01-game-boy-body-colours-are-tokens — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-game-boy-body-colours-are-tokens
prd: 100
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The Game Boy's body is drawn in seventeen colours of its own, not in the arcade's shared colours. Should a workspace be able to change those too?

## The decision, in plain words

Yes: each colour of the body is now a named colour a workspace can change, like the arcade's others, and the database accepts the same names. With nothing changed, the Game Boy looks exactly as it does today.

## The intro, for fun

The Game Boy arrived wearing seventeen colours that nobody had given a name.

## The punchline, for fun

Each one now wears a name tag, and the database checks it at the door.

## The options, in plain words

A. Every colour the Game Boy's body is drawn in becomes a named colour a workspace can change, and the database learns the names in the workspaces change itself. This is what was built.
B. Only the body colours that carry the brand's purple become named colours; the dark parts, the frame around the screen and the buttons' pad, keep today's colours.
C. The body keeps its own colours; a workspace's colours reach it only where it already used the arcade's shared ones, the ends of its shell and the A button.
D. Every body colour becomes a named colour, but the database learns the names in a separate, later change instead of the workspaces change.

## What I had to decide

The spec and the plan expected #94 to put its Game Boy body colours on `arcade.css`'s `:root`, where every colour custom property becomes a token ("Every colour custom property on `:root` must be a token, so the Game Boy's body colours are themeable the day #94 adds them"). #94 drew the body in literal colours in `shell.css` instead: seventeen opaque ones, and `--ink` declared on `.form-handheld, .form-advance`. So no body colour reached `:root`, and a theme would have moved only the shell's two gradient ends (`plasma`, `plasma-dark`) and A (`red`). Making them tokens changes the token list, and `valid_theme()` in `supabase/migrations/20260926120000_workspaces.sql`, written before #94, must list the same names (`theme.test.ts` holds the two equal); `supabase/` is outside s6's territory.

## What I did meanwhile

Every opaque colour of `shell.css` moved onto `arcade.css`'s `:root` as a `--body-*` custom property at its old value (`body-mid`, `body-ink`, `body-ink-soft`, `body-lens-1`, `body-lens-2`, `body-lens-text`, `body-led-off`, `body-pad-1`, `body-pad-2`, `body-pad-arrow`, `body-pad-down-1`, `body-pad-down-2`, `body-a-shine`, `body-b-shine`, `body-pill-1`, `body-pill-2`, `body-grille`; `--ink` became `--body-ink`), and each is a token in `apps/galaxy/src/arcade/theme.ts`. `valid_theme()`'s list was edited in place in the workspaces migration, which has never been applied anywhere, and `supabase/checks/access.sql` now also accepts a theme overriding `body-mid`. The light and shadow on the body (translucent white and black, and one translucent purple shadow under the buttons) stay literal. `theme.test.ts` fails if `shell.css` writes a colour of its own again. With the theme `{}`, `pnpm galaxy:shots` gives 72 of 72 screenshots pixel-identical to the feature branch's.

## What it costs to change later

Before the feature PR merges: renaming or dropping a body token is a constant in `theme.ts`, a line each in `arcade.css` and `shell.css`, and the list in the migration, edited in place. After it merges, the same plus a forward migration redefining `valid_theme()`, and a rewrite of any stored theme that uses an old name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the seventeen names are the author's; PRD 3's settings page will show them to people, and nothing says how they should read there (author)
- a theme that overrides `plasma` and `plasma-dark` but not `body-mid` gets a body with a band of today's purple across its middle; whether `body-mid` should rather follow `plasma` unless it is set is not settled (author)

```

<!-- /omni-outbox-settled: s6-01-game-boy-body-colours-are-tokens -->

<!-- omni-outbox-settled: s6-02-what-follows-a-theme -->

## s6-02-what-follows-a-theme — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-what-follows-a-theme
prd: 100
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When a workspace changes one of the arcade's named colours, which parts of the screen should change with it?

## The decision, in plain words

Every part drawn in exactly that colour changes with it, the animated scenes included: the glow around the heroes, the pulse of a planet in trouble, the planets' status labels. The see-through shading over panels, and the colour of a planet no fleet holds, keep today's colours.

## The intro, for fun

Change the purple, and you learn how many things were quietly purple all along.

## The punchline, for fun

Most of them now change along; the shadows stayed as they were, to keep the lights low.

## The options, in plain words

A. Every part drawn in exactly one of the named colours follows it; see-through shading and a planet no fleet holds keep today's colours. This is what was built.
B. The same, and the see-through shading over panels follows the colour it shades too.
C. Only the page's named colours follow a theme; the animated scenes keep today's colours, except the letter and the heroes' stripes.

## What I had to decide

The spec makes every colour custom property on `:root` a token and says the canvas scenes read the same resolved values, but not which of the canvas's colours are tokens. The scenes wrote their colours as literals: some are a token's value (`#a45cff` for OmniMan's glow and the plasma trail, `#6a2fd0` in the trail, `#ff3b5c` for a distress pulse and the map's hyperlanes, `#6ff0ff` for the away bar and a terraformed planet's atmosphere, `#ffd84a` for the map's brackets, `#07061c` for space), others are no token's (nebulae, star layers, the `#0b0a26` outlines). The stylesheets also write translucent shades of tokens as `rgba()` (panels over `deep`, `void` and `navy`), and `fleets.ts` gives a planet no fleet holds `#8a90d6`, `dim`'s value, which the canvas draws too.

## What I did meanwhile

A canvas literal equal to a token's default now reads that token from `FrameState.theme` (`scenes/common.ts`, `attract.ts`, `join.ts`, `map.ts`, `menu.ts`, `planet.ts`): `theme.test.ts` fails if a scene writes a token's default again, and `scenes/theme.test.ts` draws every scene with every token overridden. Every canvas sprite goes through `sprite()` in `scenes/common.ts`, which passes the theme's stripes. `STATE_LOOK` and `WOUND_LOOK` in `fleets.ts`, read only by the DOM panels, write their token colours as `var(--token)`. Translucent `rgba()` shades, the page background behind the Game Boy, and the uncrewed fleet's colour (read by the canvas, where a custom property cannot reach) keep their literals.

## What it costs to change later

Constants: a literal swapped for a theme read, or back, in the scene files and `fleets.ts`, and their tests. Nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a panel's see-through background should follow `deep` and `navy`: writing it as a mix of the token would need checking that it renders pixel for pixel as today (author)
- nobody but the author has looked at a themed workspace, and only at one teal test brand on a local copy (author)

```

<!-- /omni-outbox-settled: s6-02-what-follows-a-theme -->
