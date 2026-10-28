---
prd: 2543
title: A workspace owner chooses the settings repository
blocked-by: none
spec: file
phase0: server
---

## Problem

The Omni settings level of the playbook (PRD 2417) reads its pages from the workspace's **settings
repository**. Today that repository is the workspace's plan repository, `workspaces.plan_repo`
(`settingsRepositoryOf` in `apps/galaxy/src/omni-settings/omni-settings.service.ts`), and nothing
in the app writes that column: only SQL does. A workspace with no plan repository sees "No settings
repository yet" on Settings › Playbook and has nothing to click; the page tells it to "Name a plan
repository", which no page lets it do.

`plan_repo` also means other things, so it cannot simply be given a picker:

- which dossier is the planet's (`apps/galaxy/src/data/dossiers.ts` and the dossier-list SQL
  functions);
- the points an answer pays (`every_answer_pays`);
- which repository the game reads PRD issues from (`game/cli/workspace.ts`, the projector, the
  banner).

Pointing `plan_repo` at a playbook repository would move a workspace's planets, points and game
history with it. Issue #2538 (fixed by PR #2541) made the page reachable and made it say when it
cannot read the settings repository, and stopped on this part. The user guide's Playbook page
(`docs/guide/playbook.md`, PR #2536) documents an SQL workaround for it.

## Solution

The settings repository becomes its own setting, chosen on Settings › Playbook, with the plan
repository as its default while none is chosen. The game, the dossiers and the points keep reading
`plan_repo`, untouched.

1. **Stored.** A new nullable column, `workspaces.settings_repository`: the repository's full name,
   `owner/name`, in lower case, or null while none is chosen. An owner-only security-definer
   function sets it, built like `set_repository_phase0()`
   (`supabase/migrations/20261122090000_phase0_flag.sql`):

   ```sql
   set_workspace_settings_repository(p_workspace uuid, p_full_name text) returns public.workspaces
   ```

   - it calls `repository_owner_only(p_workspace)` first: anyone but the workspace's owner is
     refused with 42501;
   - `p_full_name` is trimmed and lowercased; it must name a repository the workspace lists
     (`public.repositories`, same workspace, `removed_at is null`), else it is refused with P0002
     and the hint `full_name`;
   - null (or an empty string) clears the choice, so the workspace falls back to its plan
     repository again;
   - it answers the workspace row it saved;
   - execute is revoked from `public` and `anon` and granted to `authenticated` only.

   One new migration, `supabase/migrations/<version>_settings_repository.sql`, dated after the
   newest on `main` (`node scripts/migration-order.ts`), with a column comment and a rollback
   paragraph. `supabase/database.types.ts` is regenerated as the conventions form says. A new
   database check, `supabase/checks/settings_repository.sql`, runs as its own named step of the
   `supabase` workflow's `check` job.

2. **Read.** `settingsRepositoryOf` reads `settings_repository` first, then falls back to
   `plan_repo` (as today: `owner/name`, or a bare name under the workspace's GitHub account), then
   none. The workspace read in `omni-settings.repository.ts` selects the new column beside
   `plan_repo`. Everything that calls the lookup follows it with no other change:
   `/api/omni-settings/playbook` (what `omni sync` reads), the page's pages and an owner's proposed
   change. Their answers keep their shape, so the kit does not change.

3. **Shown and chosen, on Settings › Playbook.** A **Settings repository** line sits in the head
   card, under its sentence, in one of three states:

   | state | the owner sees | a member sees |
   |---|---|---|
   | **Chosen** | `Settings repository: <owner>/<name>` · **Change** | `Settings repository: <owner>/<name>` |
   | **Plan repository by default** (none chosen, a plan repository named) | the badge `Using the plan repository <owner>/<name> by default`, the button **Keep it as the settings repository**, and **Choose another** | the badge only |
   | **None** (none chosen, no plan repository) | the card `No settings repository yet`, with the picker in it | the card, saying the owner chooses one |

   - **Keep it as the settings repository** stores the plan repository as the settings repository
     in one click (the one-click migration): the line then reads **Chosen**. It is offered only
     when the plan repository is one the workspace lists; otherwise the owner chooses from the
     picker.
   - **The picker** lists the workspace's listed repositories, the same list as Settings ›
     Repositories (`public.repositories` of the workspace, not removed), in that page's order, with
     **Save** and **Cancel**. When one is chosen, it also offers **Clear the choice**, which stores
     null: the line returns to **Plan repository by default**, or to **None**.
   - The page posts the choice to a new galaxy route, `POST /api/omni-settings/settings-repository`
     `{workspace, repository}` (`repository` null to clear), built like the proposal route beside
     it (ADR-0095: client → controller → service → repository): the controller checks the session,
     and the repository calls `set_workspace_settings_repository()` on the signed-in person's
     client, so the database's own rule decides who may change it. It answers
     `200 {repository}` (the stored name, or null), `403` for 42501, `404` for P0002, and `400` for
     a body that does not read. A refusal is said in the line (403: `Only the workspace’s owner can
     change it.`; 404: `That repository is no longer in this workspace. Reload the page.`), and
     nothing else on the page moves. After a save, the page reads again, so the pages below come
     from the repository just chosen.
   - The demo (`pnpm galaxy:dev`) keeps the same rules in memory, seen as an owner, starting in
     **Plan repository by default**.
   - The page's existing words that told the person to "Name a plan repository" go: the **None**
     card says `Choose the repository that holds the playbook.` for the owner, and
     `The workspace’s owner chooses it.` for a member.
   - The head card's sentence becomes `The pages every repository’s agents read.`, so the card
     stays short now that it carries the line (the word pass's finding on today's 22-word sentence).

4. **The guide.** `docs/guide/playbook.md`'s sections "A name that means two things" and "How to
   set the settings repository" are rewritten: the settings repository is its own setting, chosen
   on Settings › Playbook; the plan repository is only its default while none is chosen, and
   **Keep it as the settings repository** makes that default the choice; the SQL workaround goes.
   The slice edits the file as it is on `main` when it runs (PR #2536 adds it).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | column `workspaces.settings_repository` (text, null, `owner/name` lower case) | no written convention: follows `products.plan_repository` ← `supabase/migrations/20261212100000_knowledge_packs.sql:240` and `repositories.full_name` lower case ← `supabase/migrations/20261215090000_remove_repository.sql:31` |
| omni-loop | database | function `set_workspace_settings_repository(p_workspace, p_full_name)` | no written convention: follows `set_repository_phase0(p_workspace, p_full_name, …)` ← `supabase/migrations/20261122090000_phase0_flag.sql:27` |
| omni-loop | database | migration `<version>_settings_repository.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md` (Naming) |
| omni-loop | database check | `supabase/checks/settings_repository.sql` | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md` (Naming), beside `supabase/checks/repositories.sql` |
| omni-loop | galaxy repository | `SettingsWorkspace.settingsRepository` | no written convention: follows `SettingsWorkspace.planRepo` ← `apps/galaxy/src/omni-settings/omni-settings.repository.ts:30` |
| omni-loop | galaxy route | `POST /api/omni-settings/settings-repository` | no written convention: follows `/api/omni-settings/proposal` ← `apps/galaxy/app/api/omni-settings/proposal/route.ts:4` and `PLAYBOOK_PROPOSAL_ROUTE` ← `apps/galaxy/src/omni-settings/omni-settings.contract.ts:23` |
| omni-loop | galaxy view | `SettingsRepositoryLine` (`apps/galaxy/src/omni-settings/SettingsRepositoryLine.tsx`) | no written convention: follows `PlaybookEditor.tsx` beside `PlaybookView.tsx` ← `apps/galaxy/src/omni-settings/PlaybookView.tsx:3` |

## Decisions

Taken with the person during the brainstorm:

- **Its own setting (option A), not a picker on `plan_repo` (option B).** `plan_repo` drives the
  game's PRD issues, the planet's dossier and the points an answer pays: a picker on it would move
  those too. A new column changes only what the playbook reads.
- **No copy at the start.** The migration fills nothing: an empty `settings_repository` falls back
  to `plan_repo`, so every workspace reads exactly what it reads today. The badge and the one-click
  **Keep it as the settings repository** let an owner make the default the choice. The fallback may
  go in a later PRD, once workspaces have chosen (out of scope here).
- **The picker offers the workspace's listed repositories only,** the same list as Settings ›
  Repositories. A repository made only for the playbook is listed there first, like any other.
- **The voice's objection, accepted.** persona:Irisa: "I don't master the technical harness; one
  more setting I have to pick before the defaults work slows me down." Settled `accepted`: the
  fallback and the one-click **Keep it** mean nothing breaks and nothing waits if nobody picks.
- **No video.** The person said no to the proof question.

Taken without asking, the most reversible option:

- **A galaxy route, not a call from the browser.** Settings › Repositories calls its functions
  from the browser, a breach `layering/baseline.json` still lists; a new one would fail the layering
  guard (ADR-0095). The choice goes through `POST /api/omni-settings/settings-repository`, like the
  proposal route, and the function still runs as the signed-in person, so the database's own rule
  decides who may change it. The kit's routes keep their shape.
- **Choose another in the default state.** The owner who does not want the plan repository can open
  the picker from the badge's line without keeping it first.
- **Keep it only for a listed plan repository.** The function refuses a repository the workspace
  does not list, so the button is not offered for a plan repository that is not listed: the picker
  is.
- **A shorter head sentence.** The design word pass flags the head card's 22-word sentence; the
  after cuts it to `The pages every repository’s agents read.` rather than leaving a finding on the
  new screen. The words are a draft: the person reviewing the PRD may keep the old sentence.
- **Removing a repository keeps the choice.** `remove_repository()` is unchanged: a chosen
  repository that is later removed from Settings › Repositories stays chosen until the owner
  changes it, and the page still reads it as the Omni app. Whether removing should clear it is left
  for a later PRD.

## User stories

- As a workspace owner, I choose which repository holds our playbook on Settings › Playbook, without
  writing SQL.
- As a workspace owner whose plan repository already holds the playbook, I keep it as the settings
  repository in one click.
- As a workspace owner, I change the settings repository without moving our planets, points or game
  history.
- As a member, I see which repository the playbook is read from, and that only the owner changes it.
- As a person running `omni sync`, I read the same pages as before until the owner chooses a
  different repository.

## Scope

In:

- the migration (column, comment, `set_workspace_settings_repository()`, grants), its database check
  and its step in `.github/workflows/supabase.yml`, and the regenerated `supabase/database.types.ts`;
- `apps/galaxy/src/omni-settings/omni-settings.repository.ts` and `omni-settings.service.ts`
  (`settingsRepositoryOf`'s order, the new column read);
- Settings › Playbook: `apps/galaxy/src/omni-settings/` (the line, the picker, the view's new
  fields, the load, the demo, the choice's contract, client, controller, service and repository
  call) and `apps/galaxy/app/app/settings/playbook/page.tsx`;
- the route `apps/galaxy/app/api/omni-settings/settings-repository/route.ts`;
- `docs/guide/playbook.md`;
- the screen library's draft `settings-playbook`.

Out:

- creating a new repository from the page;
- removing the `plan_repo` fallback;
- changing what `plan_repo` drives: the game, the dossiers, the points;
- clearing the choice when the chosen repository is removed from Settings › Repositories;
- any change to the kit or to `omni sync`.

## Test seams

Following `omni kb show testing`: beside the code, on fixtures, never calling GitHub or Supabase from
a vitest test.

- **The database function:** `supabase/checks/settings_repository.sql`, run by the `supabase`
  workflow: the owner sets a listed repository (stored lower case); a member is refused with 42501;
  a repository the workspace does not list, or one it removed, is refused with P0002; null clears
  it; `anon` cannot execute it.
- **The migration's text:** a migration test beside the omni-settings code, as
  `runners.skills.migration.test.ts` does: the function is security definer, calls
  `repository_owner_only`, and is granted to `authenticated` only.
- **The lookup's order:** `omni-settings.service` tests: chosen wins over the plan repository; no
  choice falls back to `plan_repo` (`owner/name` and a bare name); neither is none. The read of
  `/api/omni-settings/playbook` and the pages read from the chosen repository.
- **The repository read:** `omni-settings.repository.test.ts`: the new column is selected and parsed.
- **The screen:** a render test per state (`playbook-render.test.ts` or a test of its own beside the
  line): **Chosen** for an owner (with **Change**) and a member (without); **Plan repository by
  default** for an owner (badge, **Keep it as the settings repository**, **Choose another**) and a
  member (badge only); **None** for an owner (the picker) and a member; the picker lists the
  workspace's repositories and offers **Clear the choice** only when one is chosen; a refusal is
  said in the line.
- **The call:** the controller's tests, as `omni-settings.proposal.controller.test.ts` does: no
  session is refused; a body that does not read is 400; the repository is called with
  `p_workspace` and `p_full_name` (null to clear); 42501 answers 403 and P0002 404. The client's
  tests: each answer reads as the page's words.

## Risks

Merging publishes a migration to production Supabase (one nullable column, one function, its
grants) and a new control on Settings › Playbook. Every workspace reads its settings repository
exactly as today until an owner chooses one, because an empty column falls back to `plan_repo`.
Rollback: revert the merge, then a follow-up migration drops `set_workspace_settings_repository()`
and `workspaces.settings_repository`; any choice an owner made is lost, and the page reads the plan
repository again.

- **Who may change it.** A member who could set it would point every repository's agents at
  another playbook. The function is the owner's only (`repository_owner_only`), refuses an unlisted
  repository, and the database check proves both.
- **Two readers.** The choice reaches the page and `omni sync` through one lookup; the game, the
  dossiers and the points never read the new column.

The Legal entries: none touched.

The locked laws it touches (`omni kb laws` names them through the migration and the database types;
the design changes none of them):

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees, if anyone
  but a member could link a GitHub account to it. Changing it needs @pierrederval or @dervalp to
  approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work, if an agent link read a
  repository outside its workspace; the new choice is limited to the workspace's own listed
  repositories. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent, if an agent
  link outlived its maker's membership. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- BR-PRODUCT-12: the terminal would act on words a person no longer stands behind, if an answer
  changed after it was given. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers, if ask mode let in anyone
  but the workspace's members. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it, if a session in no
  workspace were read or deleted. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, if the game's ledger were
  rewritten; this PRD leaves `plan_repo`, which the game reads, untouched. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the workspace's paid AI key, if anyone but the owner saw it.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- An owner calling `set_workspace_settings_repository(<workspace>, 'Acme/Plans')` for a listed
  `acme/plans` stores `acme/plans`; a member's call is refused with 42501; a repository the
  workspace does not list, or one it removed, is refused with P0002; a null call clears the column.
- With `settings_repository` set, `/api/omni-settings/playbook?repo=<a listed repository>` and
  Settings › Playbook read the pages from it, whatever `plan_repo` holds.
- With `settings_repository` null and `plan_repo` set, both read from the plan repository, as
  today; with both null, both say the workspace has no settings repository.
- Settings › Playbook shows the **Chosen**, **Plan repository by default** and **None** states as
  the table in **Solution** says, for an owner and for a member; a member sees no control that
  changes it.
- In **Plan repository by default**, one click on **Keep it as the settings repository** stores the
  plan repository and the line then reads `Settings repository: <owner>/<name>`.
- The picker lists exactly the workspace's listed repositories; **Save** stores the one picked;
  **Clear the choice** returns the line to the default state.
- The game, the dossiers and the points read `plan_repo` as before: no reader of `plan_repo` other
  than `settingsRepositoryOf` changes.
- `docs/guide/playbook.md` describes choosing the settings repository on Settings › Playbook and the
  plan repository as its default, and no longer gives SQL to set it.
- `supabase/checks/settings_repository.sql` runs in the `supabase` workflow's `check` job, and
  `supabase/database.types.ts` holds the new column and function.
