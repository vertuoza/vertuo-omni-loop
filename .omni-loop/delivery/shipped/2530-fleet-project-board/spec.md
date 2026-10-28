---
prd: 2530
title: A fleet's pull requests go on its GitHub project board
blocked-by: none
spec: file
phase0: server
areas: [game, access]
---

## Problem

A team that follows its work on a GitHub project board has to add every pull request the loop opens
to that board by hand, or it never shows there. The loop already knows who the team is: a
workspace's **fleets** group its members (`public.teams`, each member's fleet in `players.team`), and
the loop signs every pull request it opens. What it lacks is the link between a fleet and the board
its people read, and someone to put the card there.

A member asked for exactly that: when the loop opens a pull request for one of five named people,
the team's board should show it right away, so the team stops copying cards by hand.

## Solution

V1 is narrow on purpose: only pull requests **the loop opens**, only **into the default branch**,
and the card is **only added**: the board's own GitHub workflows move it from there.

1. **A fleet names its board.** `public.teams` gains `project_url`, nullable: the link of a GitHub
   organization project, `https://github.com/orgs/<org>/projects/<number>`. A new function
   `set_fleet_project(p_workspace, p_name, p_url)` writes it, security definer, refused unless the
   caller owns the workspace (`fleet_owner_only()`, as every fleet function), refused unless the link
   reads as an organization project and `<org>` is the workspace's `github_org` (case-insensitive),
   refused on a retired fleet. An empty or null `p_url` clears it, and clearing also clears the note
   (item 4). `update_fleet()` is unchanged.
2. **The owner sets it on Settings › Fleets.** The fleet form (`FleetsView.tsx`, **New fleet** and
   **Edit**) gains one field, **GitHub project**, a link, optional, under **Mascot**. Saving sends
   the look as today, then `set_fleet_project` when the link changed; a refusal shows next to the
   field, as the other fields' do. Each active fleet's card shows, under its motto, its board as
   `Board: <org> project <number>`, linked, and the App's last note (item 4) in muted text. A member
   reads the same, without the field.
3. **The App routes a loop pull request.** `src/webhook/webhook.ts` turns a `pull_request` delivery
   whose action is `opened`, `reopened`, `ready_for_review` or `edited` into one `fleet-board` event,
   beside whatever else it becomes, when all three hold:
   - its base is the repository's default branch (a sub-PR never is);
   - the loop signed it, read from the delivery alone: its body carries the signature's marker
     (`isSignedBody`) or its author is the loop's bot (`OMNI_LOGIN`), the test `pr-stats/signed.ts`
     already uses, without its commit trailers, which the delivery does not carry;
   - it is open.

   `edited` is there so a body that gains its signature after opening still counts. A pull request
   typed by hand produces no event.
4. **The `fleet-board` function adds the card.** A new Inngest function in
   `apps/omni-app/src/fleet-board/`:
   1. **The workspaces.** Every workspace that tracks the repository (`repositories`, `tracked`) and
      whose `github_installation_id` is the delivery's installation. Each is handled on its own, with
      its own fleets only.
   2. **The fleet.** The fleet of the pull request's author in that workspace (`players.github_login`
      matched case-insensitively → `players.team`, an active fleet). When the author has none, the
      fleet of the person who sent the runner job whose `prs` holds this pull request's link
      (`runner_jobs.sent_by` → their `players.team` in the job's workspace). A job sent by an API key
      has no person: it gives no fleet. A runner reports its pull requests a little after opening
      them, so when no job holds the link yet the function sleeps one minute and looks again, ten
      times at most, then stops quietly.
   3. **The card.** When that fleet has a `project_url`: read the project's node id from its
      organization and number (GraphQL `organization.projectV2`), then
      `addProjectV2ItemById(projectId, contentId: <the pull request's node id>)`. Adding a pull
      request already on the board returns its card and changes nothing, so a second delivery is
      harmless.
   4. **The note.** It writes the outcome on the fleet: `project_note` (at most 200 characters) and
      `project_noted_at`, through the service role. `Added #<n> · <owner>/<repo>` on success. On a
      refusal, one short line: `Not added: ask an org admin` (the App cannot write organization
      projects), or `Not added: no such project`. The card shows the full reason as the note's
      title, and the guide says what the org admin does. A refusal is never retried; a GitHub error of 5xx
      or a rate limit is retried twice by Inngest. Nothing is ever posted on the pull request.
   No fleet, or a fleet with no board: nothing is called and nothing is written.
5. **The App may write organization projects.** `apps/omni-app/app.yml` gains
   `organization_projects: write`, and `test/app-yml.test.ts` allows exactly that one more
   permission. GitHub asks each organization's admin to accept it once; until then, the note of item
   4 says so on the fleet's card.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | `teams.project_url`, `teams.project_note`, `teams.project_noted_at` | no written convention: follows `teams.retired_at`, `teams.motto` ← `supabase/migrations/20260925150000_fleets_and_players.sql:7-13` |
| omni-loop | database | `set_fleet_project(p_workspace, p_name, p_url)` | no written convention: follows `update_fleet` and `retire_fleet` ← `supabase/migrations/20261003090000_own_fleets.sql:223-225` |
| omni-loop | database | migration `<version>_fleet_project_board.sql` | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md:45` |
| omni-loop | database check | `supabase/checks/fleets.sql`, extended | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md`, beside `supabase/checks/fleets.sql` |
| omni-loop | app event | `fleet-board` | no written convention: follows `main-watch` ← `apps/omni-app/src/main-watch/events.ts` |
| omni-loop | app folder | `apps/omni-app/src/fleet-board/` | no written convention: follows `apps/omni-app/src/main-watch/` (one folder per function, its store behind a `store.boundary.ts`) |
| omni-loop | ui | **GitHub project** field, `Board:` line | no written convention: follows the **Motto** field and `fleet-card-motto` ← `apps/galaxy/src/fleets/FleetsView.tsx`, `FleetCard.tsx` |

## Decisions

Taken with the person during the brainstorm:

- **Only pull requests into the default branch:** feature PRs, bug fixes and visual fixes. Sub-PRs
  stay off the board, or a PRD would fill it with one card per slice.
- **Only pull requests the loop opens (V1).** The person narrowed it after first choosing every
  pull request of a member: a pull request typed by hand stays off the board.
- **Only add the card.** The App sets no Status or other field: the board's built-in workflows do
  (item added, pull request merged).
- **Only the workspace's owner sets a fleet's board,** as every other part of a fleet today.
- **A runner's pull request counts for the person who sent the job,** since GitHub names the
  runner's account as its author.
- **The App adds the card (approach A),** not the kit at `gh pr create` (each person's login would
  need the `project` scope, and runners would need the server to name the fleet) and not GitHub's
  own auto-add (it filters by label and repository, never by author).
- **The voice's objection, accepted.** persona:B-E DEv: "I open a PR by hand and the bot puts it on
  a board I never asked for: that's exactly the fluff I expected." Settled `accepted`: only a pull
  request the loop signed goes on a board.
- **No video.** The person said no to the proof question.

Taken without asking, the most reversible option:

- **A new function, not a wider `update_fleet()`:** the arcade and the form call `update_fleet` with
  five arguments today; a sixth would change every caller.
- **The note lives on the fleet,** written by the App, so the settings page shows whether the board
  works without calling GitHub itself.
- **Only the workspace's own organization's boards:** a board in another organization would need the
  App installed there, and would send a workspace's pull requests outside it (never#5).
- **A member in no fleet, or a fleet with no board:** nothing happens, silently: it is the normal case
  for most workspaces.
- **Signing off means no card.** A repository whose `signature` is off signs nothing, so its pull
  requests never count as the loop's: the guide says so beside the field.
- **Every workspace that tracks the repository through this installation** is handled, each with its
  own fleets: a person in fleets of two such workspaces lands on both boards, never on a board of a
  workspace they are not in.

## User stories

- As a PM whose team follows a GitHub project board, I see every pull request the loop opens for my
  team on our board, without adding it by hand.
- As a workspace owner, I give a fleet its board's link on Settings › Fleets, and I read on its card
  whether the App could add the last pull request, or what to ask the org admin.
- As a back-end developer, the pull requests I open by hand never show on a board I did not choose.
- As a member who sends jobs to a runner, the runner's pull requests land on my fleet's board as if I
  had opened them.

## Scope

In:

- a migration: `teams.project_url`, `project_note`, `project_noted_at`, `set_fleet_project()`; its
  checks in `supabase/checks/fleets.sql`; the regenerated `supabase/database.types.ts`;
- `apps/galaxy/src/fleets/` (store, model, view, card, styles) for the field, the `Board:` line and
  the note;
- `apps/omni-app/app.yml` and `test/app-yml.test.ts`;
- `apps/omni-app/src/webhook/webhook.ts` (the routing), `src/fleet-board/` (the function, its store,
  its GitHub calls), `src/functions.ts` (registration);
- the App bundle rebuilt (`apps/omni-app/api/`);
- `docs/guide/join.md` (**Join a fleet**): a fleet's board, and what the owner and the org admin do.

Out:

- setting a Status or any other field of the card;
- pull requests typed by hand, and sub-PRs;
- user-owned (`/users/<login>/projects/…`) or another organization's boards;
- several boards per fleet;
- removing a card when a pull request closes, or moving it when the fleet changes.

## Test seams

Following `omni kb show testing`: beside the code, on fixtures, never calling GitHub or Supabase.

- **The database:** `supabase/checks/fleets.sql`: the owner sets and clears a board; a member, a
  stranger and anon are refused; a link that is not an organization project, or names another
  organization, is refused; a retired fleet is refused; clearing the link clears the note.
- **The routing:** `apps/omni-app/src/webhook/webhook.test.ts`: a signed pull request into the
  default branch becomes one `fleet-board` event for each of `opened`, `reopened`,
  `ready_for_review` and `edited`; a pull request typed by hand, a sub-PR, a closed one and
  `synchronize` become none; every event it became before still comes out unchanged.
- **The function:** `apps/omni-app/src/fleet-board/fleet-board.test.ts`, with GitHub and the store
  faked: the author's fleet with a board adds one card and writes `Added #<n>`; the author in no
  fleet but the job's sender in one adds the card once the job reports the link, after a sleep; a
  job never reporting it stops after ten looks with no call; an API key's job gives no fleet; a
  fleet with no board calls nothing; GitHub's permission refusal writes its note and is not retried;
  a project that does not exist writes its note; two workspaces on one installation each use their
  own fleet.
- **The manifest:** `apps/omni-app/test/app-yml.test.ts` allows `organization_projects: write` and
  nothing else new.
- **The page:** `apps/galaxy/src/fleets/render.test.ts` and `store.test.ts`: the field shows for the
  owner only, saves through `set_fleet_project` only when changed, shows its refusal next to it; the
  card shows `Board:` and the note, and neither when the fleet has no board.

## Risks

Merging publishes a migration on production Supabase (three nullable columns and one function), a
new event and function on the omni-loop App, a new permission in its manifest, and a changed
Settings › Fleets page. Rollback: revert the merge; the function stops, the field is gone, and a
follow-up migration drops the function and the columns. Cards already added stay on their boards,
as any card a person added would.

- **The new permission.** Until an org admin accepts `organization_projects: write`, GitHub refuses
  every add: the fleet's note says so, and nothing else changes. Registering the manifest change on
  the App already registered is done by hand in its settings, as PRD 902 did.
- **A workspace's work on a board.** The card is added only to a board of the workspace's own
  organization, chosen by its owner; a board's own visibility (public or private) is GitHub's, and
  the guide says that a public board shows its cards to anyone.
- **GitHub's budget.** Two GraphQL calls per loop pull request into the default branch, and none for
  every other delivery; `edited` repeats them, and adding an existing card is a no-op.

The Legal entries it touches:

- L-GDPR-1: the note names a pull request number and a repository, never a login; the board's
  readers are the organization's, as for any GitHub card.
- L-GDPR-2: no credential is stored; the App uses its installation token, never a person's.
- L-AIACT-1: the card is the pull request itself, already signed as the loop's.

The locked laws it touches:

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees; a fleet's board is
  set by the workspace's owner only, and fleets still take only linked members. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work; the function reads only the
  workspaces that track the repository through the delivery's own installation, each with its own
  fleets. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent; this PRD
  adds no agent link and reads no key. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- BR-PRODUCT-12: an answer could change after it is given; this PRD writes no answer. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions; this PRD touches no ask session. Changing
  it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a session with no workspace could leak or be lost; this PRD touches no session.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact; the migration alters `teams` but
  writes no ledger event and renames no fleet. Changing it needs @pierrederval or @dervalp to approve
  the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the workspace's paid AI key; this PRD reads no key. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- An owner sets a fleet's board to an organization project of the workspace's organization on
  Settings › Fleets; the card shows `Board: <org> project <number>`.
- A link to another organization's project, a user's project or anything else is refused next to the
  field, and nothing is saved.
- A member reads the board and the note on the card, and has no field.
- A pull request the loop signed, into the default branch, by a member whose fleet has a board, is
  on that board within a minute, and the fleet's note reads `Added #<n> · <owner>/<repo>`.
- A runner's pull request for a job a member of that fleet sent lands on the same board within
  eleven minutes.
- A pull request typed by hand, a sub-PR, or one by a member in no fleet is on no board, and no note
  changes.
- Before an org admin accepts the new permission, the note reads `Not added: ask an org admin`,
  its title says the App cannot write organization projects, and the pull request carries no comment or check from this.
- Clearing the link stops any new card and clears the note.
