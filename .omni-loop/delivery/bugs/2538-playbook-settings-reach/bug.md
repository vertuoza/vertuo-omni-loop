# Bug 2538: the Omni-settings playbook level can't be used from the Omni page

## Triage

- **Domain:** Omni page, Settings › Playbook (`apps/galaxy/src/omni-settings/`, the Settings tabs and menu in `apps/galaxy/src/nav/`)
- **Risk:** medium — workspace owners cannot reach or set up the Omni-settings playbook from the app, and a settings repository the Omni app cannot read shows as missing; workaround: type /app/settings/playbook and set `plan_repo` by SQL (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/omni-settings/playbook-reach.test.ts`
- **Level:** unit (the Settings tabs and menu as data; the pages service with a fake GitHub, rendered by the page's screen)
- **Red:** Tests  4 failed (4) — AssertionError: expected { href: '/app/settings/jev', …(1) } to deeply equal { Object (href, label) }; AssertionError: expected 'Fleets Repositories Business API keys…' to contain 'The Omni app is not installed where a…'

## Fix

Settings › Playbook (PRD 2417) drew a Playbook tab on its own page only: the Settings tabs every other
Settings page draws, and the menu's Settings entry, did not list it, so nothing led there. Playbook is
now the last Settings tab and the last page of the menu's Settings entry. And when the Omni app could
not read the settings repository (not installed there, or the repository not readable), the page's
view dropped the repository's name, so the page took it for a workspace naming none and showed "No
settings repository yet"; the view now keeps the name the workspace gives, and the page shows why it
could not read it. The wire answer `omni sync` reads (`/api/omni-settings/playbook`) is unchanged.

Choosing the settings repository on the Omni page is not fixed here: it needs a new owner-only write of
the workspace and a product decision on `plan_repo`, which the plan repository's other readers share.
The issue carries the `/omni:brainstorm` line for it.

## Guard

`apps/galaxy/src/nav/section-tabs.test.ts`: every folder under `app/app/settings/` holding a page is a
Settings tab. It fails on `main`'s tabs (`/app/settings/playbook` unlinked) and passes on the fix, so
the next Settings page cannot ship without its tab.

## Mutation

mutation: no changed core file — the changed files are in `apps/galaxy/`, outside the delivery core Stryker mutates.
