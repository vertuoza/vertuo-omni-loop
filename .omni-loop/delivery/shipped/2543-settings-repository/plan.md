# Plan: A workspace owner chooses the settings repository

PRD #2543, its spec beside this plan (`spec.md`). The feature branch `feat/settings-repository`
merges into `main` with `Closes #2543`; each slice is a sub-PR from
`feat/settings-repository--<slice>` into the feature branch, with `Part of #2543`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The settings repository is stored and read: `workspaces.settings_repository`, the owner-only `set_workspace_settings_repository()`, and `settingsRepositoryOf` reading it before the plan repository, so `/api/omni-settings/playbook` and the page's pages read the chosen repository | `supabase/migrations/` `supabase/checks/settings_repository.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/omni-settings/omni-settings.service.ts` `apps/galaxy/src/omni-settings/omni-settings.repository` `apps/galaxy/src/omni-settings/omni-settings.controller.test.ts` `apps/galaxy/src/omni-settings/omni-settings.pages.test.ts` `apps/galaxy/src/omni-settings/omni-settings.proposal` `apps/galaxy/src/omni-settings/playbook-reach.test.ts` `apps/galaxy/src/omni-settings/settings-repository.migration.test.ts` `apps/galaxy/src/product-knowledge/repositories/settings-level.test.ts` | — | 1 | deep |
| s2 | The guide says the settings repository is its own setting, chosen on Settings › Playbook, with the plan repository its default; the SQL workaround goes | `docs/guide/playbook.md` | — | 1 | light |
| s3 | On Settings › Playbook, the Settings repository line in its three states, the picker and Keep it as the settings repository, saved through `POST /api/omni-settings/settings-repository` | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/app/settings/playbook/` `apps/galaxy/app/api/omni-settings/settings-repository/` | s1 | 2 | build |

**Shared ground.** s1 and s3 both declare files under `apps/galaxy/src/omni-settings/`: s1 names
the service, the repository and the tests that build a `SettingsWorkspace`; s3 owns the whole folder
for the line, the view, the contract, the client, the controller and the choice's call. s3 waits
for s1 (wave 2), so it starts from the `SettingsWorkspace` and the repository s1 settled, and adds
the `set_workspace_settings_repository()` call to the repository s1 changed. The migration test
(`settings-repository.migration.test.ts`) reads the migration s1 writes and is s1's. s2 shares no
ground. `kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and no slice
changes their sources.

## Per slice: done when

### s1 (deep: a migration and an owner-only function, an access rule)

- A migration `<version>_settings_repository.sql`, dated after the newest on `main`
  (`node scripts/migration-order.ts`; conventions › A new migration takes the next free version, A
  migration stays the newest until it merges), whose header names its rollback, adds the nullable
  `workspaces.settings_repository` with a column comment, and `set_workspace_settings_repository(
  p_workspace uuid, p_full_name text) returns public.workspaces`: security definer,
  `search_path = ''`, `repository_owner_only(p_workspace)` first, the name trimmed and lowercased,
  a repository the workspace does not list (or removed) refused with P0002 and the hint
  `full_name`, null or empty clearing it; execute revoked from `public` and `anon`, granted to
  `authenticated` (spec › Solution 1).
- `supabase/checks/settings_repository.sql`, its own named step of the `supabase` workflow's
  `check` job (conventions › A new database check runs in CI), proves: the owner stores
  `acme/plans` from `Acme/Plans`; a member is refused with 42501; an unlisted and a removed
  repository are refused with P0002; null clears it; `anon` cannot execute it (acceptance 1).
- `supabase/database.types.ts` is what `node scripts/supabase-types.ts` writes from a fresh local
  database (`supabase stop --no-backup` first; conventions › The database types are generated,
  never written).
- `settings-repository.migration.test.ts` reads the migration: security definer, the owner check,
  the grant to `authenticated` only.
- `SettingsWorkspace` gains `settingsRepository`, selected and parsed by the workspace read
  (`omni-settings.repository.test.ts`; conventions › A new returned column lands with its readers).
- `settingsRepositoryOf` returns the chosen repository first, then the plan repository
  (`owner/name` or a bare name under the GitHub account), then null; the service tests prove each,
  and `/api/omni-settings/playbook`, the pages and a proposed change read the chosen repository
  (acceptance 2 and 3). The answers keep their shape: no kit change.
- No reader of `plan_repo` other than `settingsRepositoryOf` changes (acceptance 7).

### s2 (light: docs only)

- `docs/guide/playbook.md`, as it is on `main` when the slice runs, rewrites "A name that means two
  things" and "How to set the settings repository": the settings repository is chosen on Settings ›
  Playbook; the plan repository is its default while none is chosen; **Keep it as the settings
  repository** makes it the choice; only the workspace's owner changes it; the SQL goes
  (acceptance 8).
- When the file is not on `main` yet (PR #2536 still open), the slice stops and records an outbox
  item naming the pull request it waits for, rather than writing a page of its own.

### s3 (`ui: yes`)

- `POST /api/omni-settings/settings-repository` `{workspace, repository}`: no session is refused; a
  body that does not read is 400; the repository calls `set_workspace_settings_repository()` on the
  signed-in person's client; 42501 answers 403, P0002 404, a save `200 {repository}`
  (controller tests, as `omni-settings.proposal.controller.test.ts`).
- The page's view carries the line's state (chosen, plan repository by default, none), the plan
  repository and the workspace's listed repositories, read as the signed-in person
  (`load.test.ts`).
- The Settings repository line renders each state as spec › Solution 3's table says, for an owner
  and for a member, with the words of the draft screen `settings-playbook`; the picker lists exactly
  the workspace's listed repositories and offers **Clear the choice** only when one is chosen; a
  refusal is said in the line (render tests, acceptance 4).
- **Keep it as the settings repository** stores the plan repository in one click, offered only when
  it is listed; **Save** stores the one picked; **Clear the choice** stores null; after each, the
  page reads again (client tests, acceptance 5 and 6).
- The **None** card and the head card read the spec's new words; "Name a plan repository" is gone.
- The demo (`pnpm galaxy:dev`) shows the line as an owner, starting in **Plan repository by
  default**, with the same rules in memory.
- `apps/galaxy/src/page-width.test.ts` and `design-system.test.ts` stay green: the picker's field
  is never wider than 900 px, and `omni-settings.css` names no colour of its own.
