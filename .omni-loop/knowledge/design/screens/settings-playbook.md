---
screen: settings-playbook
status: draft
kind: page
mock: settings-playbook.html
implements: [apps/galaxy/app/app/settings/playbook/page.tsx, apps/galaxy/src/omni-settings/PlaybookScreen.tsx, apps/galaxy/src/omni-settings/PlaybookView.tsx, apps/galaxy/src/omni-settings/SettingsRepositoryLine.tsx, apps/galaxy/src/omni-settings/PlaybookEditor.tsx, apps/galaxy/src/omni-settings/omni-settings.css]
reads: [apps/galaxy/src/omni-settings/load.ts, apps/galaxy/src/omni-settings/omni-settings.service.ts, apps/galaxy/src/omni-settings/omni-settings.contract.ts, apps/galaxy/src/omni-settings/omni-settings.client.ts, apps/galaxy/src/nav/SectionTabs.tsx, apps/galaxy/src/ask/page/Notice.tsx]
routes: [/app/settings/playbook]
supersedes: null
---

## Purpose

The workspace's tech playbook, under Settings: which repository it is read from, and its pages one
card each. The owner chooses the settings repository and proposes a change to a page; a member reads
both.

## Regions

- **The Settings tabs,** Playbook current.
- **The head card:** Playbook, the sentence `The pages every repository’s agents read.`, the
  **Settings repository line** (below), then `Read from <owner>/<name> at <commit>` once a commit was
  read.
- **The Settings repository line,** one of three states:
  - **Chosen:** `Settings repository: <owner>/<name>`, and **Change** for the owner.
  - **Plan repository by default:** the badge `Using the plan repository <owner>/<name> by default`;
    for the owner, **Keep it as the settings repository** (the primary action, shown only when the
    plan repository is listed) and **Choose another**.
  - **None:** the card `No settings repository yet` in place of the line.
- **The picker,** in place of the line while open (owner only): the label Settings repository, a
  list of the workspace's listed repositories in Settings › Repositories' order, **Save**,
  **Cancel**, and **Clear the choice** when one is chosen.
- **The reason card,** when the repository cannot be read: why, in one sentence.
- **The pages:** one card per page, its name, `In your settings repository` or
  `The kit’s first default`, its text, and the owner's **Edit**.

## States

- Chosen, for the owner and for a member.
- Plan repository by default, for the owner and for a member (badge only).
- None: the owner gets the picker in the card; a member reads `The workspace’s owner chooses it.`
- Picker open; saving (its buttons wait); refused (the refusal in red under the buttons).
- The repository cannot be read: the line still names it, and the reason card says why.
- Closed, signed out, no workspace, unreadable: the notices the page already has.

## Words

- `Settings repository: <owner>/<name>`; Change.
- `Using the plan repository <owner>/<name> by default`; Keep it as the settings repository;
  Choose another.
- No settings repository yet; `Choose the repository that holds the playbook.`;
  `The workspace’s owner chooses it.`
- Settings repository; Save; Cancel; Clear the choice; `Choose a repository`.
- Refusals: `Only the workspace’s owner can change it.`; `That repository is no longer in this
  workspace. Reload the page.`

## Refusals

- A member never sees Change, Keep it, Choose another or the picker.
- The picker never offers a repository the workspace does not list.
- Choosing a settings repository never changes the plan repository.

## Open questions

- Should the badge's line say what the plan repository is also used for (the game, the dossiers)?
- Should Choose another be offered in the default state, or only Keep it?
- Should the picker's list say which repository is the plan repository?

## Source

/omni:brainstorm, PRD 2543: .omni-loop/delivery/shipped/2543-settings-repository/before-after.html
