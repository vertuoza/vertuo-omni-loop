---
screen: repositories
status: draft
kind: page
mock: repositories.html
implements: [apps/galaxy/app/app/settings/repositories/page.tsx, apps/galaxy/src/repositories/RepositoriesView.tsx, apps/galaxy/src/repositories/RepositoriesScreen.tsx, apps/galaxy/src/repositories/repositories.css]
reads: [apps/galaxy/src/repositories/model.ts, apps/galaxy/src/repositories/load.ts, apps/galaxy/src/repositories/store.ts, apps/galaxy/src/repositories/RepositoriesPage.tsx, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/settings/repositories]
supersedes: null
---

## Purpose

The workspace's repositories, under Settings. The owner adds a repository, removes one, and sets
each one's switches. A member reads the same list, and only switches Public ideas.

## Regions

- **The head card:** Repositories, the sentence `Removing one keeps its history.` for the owner
  (`Only @owner can change repositories.` for a member), a refusal when the last call was refused,
  and **Add repository** for the owner, the page's one primary action.
- **The Add list,** in place of the button while open: the repositories the Omni App can see that
  are not listed yet, one click each, and Close.
- **The install card,** when the workspace has no Omni App installation.
- **Repositories:** one card per listed repository, with:
  - its `owner/name`, when it was last collected, `Omni App has no access · Give access on GitHub →`
    when the App cannot read it, and Ideas board →;
  - one chip per product that links it;
  - the Public ideas, Phase 0 on the server and Tracked switches;
  - **Remove**, quiet, for the owner.
- **Removed (n),** collapsed, under the list, absent at 0: each removed repository, `removed <ago>`,
  and **Add back** for the owner.
- **Missing one? Give the Omni App access on GitHub →** under the list.

## States

- No repositories yet.
- Busy: every control waits while a call is on its way.
- Refused: the refusal in the head card.
- Remove pressed: the browser's confirm, naming the products it leaves and the plan repository it
  clears; cancelled, nothing changes.

## Words

- Remove; Add back; Removed (n); removed <ago>.
- The confirm: `Remove <owner/name>? Its ideas and history are kept, and adding it again brings them
  back.`, then `It leaves <Product>, <Product>.` and `<Product> will have no plan repository.` when
  they apply.

## Refusals

- A member never sees Remove or Add back.
- Remove never deletes a repository's ideas, pull requests or knowledge packs.

## Open questions

- Should removing be offered from the no-access line itself, beside Give access on GitHub?
- Does a member need to see Removed (n) at all?

## Source

/omni:brainstorm, PRD 2188: .omni-loop/delivery/inbox/2188-remove-repository/before-after.html
