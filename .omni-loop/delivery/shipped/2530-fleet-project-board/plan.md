# Plan: a fleet's pull requests go on its GitHub project board

PRD #2530, spec beside this plan (`spec.md`). The feature branch `feat/fleet-project-board` merges
into `main` through one feature PR (`Closes #2530`); each slice is a sub-PR from
`feat/fleet-project-board--<slice>` into the feature branch (`Part of #2530`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The owner gives a fleet its board on Settings › Fleets, and every member reads it on the fleet's card | `supabase/migrations/` `supabase/checks/fleets.sql` `supabase/database.types.ts` `apps/galaxy/src/fleets/` `apps/galaxy/app/app/settings/fleets/` | — | 1 | build |
| s2 | A pull request the loop signed, into the default branch, by a member whose fleet has a board, goes on that board, and the fleet's note says what happened | `apps/omni-app/app.yml` `apps/omni-app/test/app-yml.test.ts` `apps/omni-app/src/webhook/` `apps/omni-app/src/fleet-board/` `apps/omni-app/src/functions` `apps/omni-app/entries/` | s1 | 2 | deep |
| s3 | A runner's pull request goes on the board of the person who sent the job | `apps/omni-app/src/fleet-board/` | s2 | 3 | build |
| s4 | The guide says how a fleet gets its board, what the org admin accepts, and that only the loop's pull requests into main go on it | `docs/guide/join.md` | — | 1 | light |

Shared ground: `apps/omni-app/src/fleet-board/` is declared by s2 and s3; s3 is blocked by s2 and
sits in wave 3, so they never share a wave. `supabase/database.types.ts` is written by s1 only; s2
and s3 read the new columns from it after s1 merged. `apps/omni-app/api/` is generated: no slice
lists it, and the wave rebuilds it once after merging.

## Per slice: done when

### s1 (`ui: yes`)

- A migration, the next free version after the newest on `main`, adds `teams.project_url`,
  `project_note`, `project_noted_at` and `set_fleet_project(p_workspace, p_name, p_url)` as the
  spec's Solution items 1 and 4 say; `supabase/database.types.ts` is regenerated.
- `supabase/checks/fleets.sql` proves: the owner sets and clears a board; a member, a stranger and
  anon are refused; a link that is not an organization project, or names another organization, is
  refused; a retired fleet is refused; clearing the link clears the note.
- On Settings › Fleets the owner's form has a **GitHub project** field under Mascot; saving sends
  `set_fleet_project` only when the link changed, and its refusal shows next to the field with the
  look already saved.
- Each active card shows `Board: <org> project <number>`, linked, and the note with its full reason
  as its title, in muted text (the error colour for a `Not added:` note); a fleet with no board shows
  neither; a member sees the same with no field.
- `render.test.ts` and `store.test.ts` cover the field, the save, the refusal, the line and the note.
- The page matches the draft screen `fleet-settings` (`.omni-loop/knowledge/design/screens/`).

### s2 (deep: a new App permission, routing every pull request delivery, and GitHub's GraphQL) (`ui: yes`)

- `app.yml` adds `organization_projects: write`; `test/app-yml.test.ts` allows exactly that.
- `webhook.ts` turns `opened`, `reopened`, `ready_for_review` and `edited` of an open pull request
  into the default branch, signed by the loop (`isSignedBody` or `OMNI_LOGIN`), into one
  `fleet-board` event beside its other events; `webhook.test.ts` proves a hand-made pull request, a
  sub-PR, a closed one and `synchronize` give none, and every event it gave before is unchanged.
- The `fleet-board` function, registered with the others, finds each workspace that tracks the
  repository on the delivery's installation, the author's active fleet there, and, when it has a
  board, adds the pull request with `addProjectV2ItemById`, writing `Added #<n> · <owner>/<repo>`.
- A permission refusal writes `Not added: ask an org admin`, a missing project
  `Not added: no such project`; neither is retried; nothing is posted on the pull request.
- `fleet-board.test.ts`, with GitHub and the store faked, covers the add, no fleet, no board, both
  refusals and two workspaces on one installation.

### s3 (`ui: yes`)

- When the author is in no fleet, the function finds the runner job whose `prs` holds the pull
  request's link and uses its sender's fleet; a job sent by an API key gives none.
- When no job holds the link yet it sleeps a minute and looks again, ten times at most, then stops
  with no call and no note.
- `fleet-board.test.ts` covers the job found at once, found after a sleep, never found, and an API
  key's job.

### s4 (light: docs only)

- `docs/guide/join.md` (**Join a fleet**) says: the owner pastes an organization project of the
  workspace's organization on Settings › Fleets; an org admin accepts the App's
  `Organization projects` permission once; only pull requests the loop signs, into the default
  branch, go on the board, and a runner's count for the person who sent the job; a public board
  shows its cards to anyone; a repository with signing off adds none.
