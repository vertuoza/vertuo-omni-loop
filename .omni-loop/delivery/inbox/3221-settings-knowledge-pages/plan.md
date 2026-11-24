# Plan: Business, Jev and Playbook on the settings kit

PRD #3221, spec beside this plan (`spec.md`). Planned against the code as PRD 3218 (the settings
shell, blocked-by 3216 and 3217) will leave it: the `SettingsPage`, `SettingsSection`, `SettingsRow`,
field states, `Notice` and empty state of `apps/galaxy/src/settings-kit/` exist, the layout under
`app/app/settings/` draws the frame, and no page draws its own tab row or heading. One feature branch
`feat/settings-knowledge-pages` into `main` (`Closes #3221`); each slice is a sub-PR from
`feat/settings-knowledge-pages--<slice>` into it (`Part of #3221`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Business is drawn in `SettingsPage` with the sections Products, What you sell, Agent questions and Connect an agent, each at its anchor; claims and agent questions show their first items, the total and Show all; its library screen says so | `apps/galaxy/src/business/` `apps/galaxy/src/agent-connect/` `apps/galaxy/app/app/settings/business/` `.omni-loop/knowledge/design/screens/business-settings.*` `design/baseline.json` | — | 1 | build |
| s2 | Jev is drawn in `SettingsPage` with the sections Provider, Keys and Behaviour, its forms use the kit's field states and Save/Cancel, a failed save keeps the edit, the key stays masked; it gets a library screen | `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` `.omni-loop/knowledge/design/screens/jev-settings.*` `design/baseline.json` | — | 2 | build |
| s3 | Playbook is drawn in `SettingsPage` with the sections Repository, Forms and Editor, its editor uses the kit's field states and Save/Cancel, a failed save keeps the edit; its library screen says so | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/app/settings/playbook/` `.omni-loop/knowledge/design/screens/settings-playbook.*` `design/baseline.json` | — | 3 | build |

**Shared ground.** `design/baseline.json` is declared by s1, s2 and s3: the ratchet must be exact at
every commit (`scripts/design-ratchet.test.ts`), so each slice deletes the lines of the stylesheet and
raw components it retires, and the three edits sit in one file. The waves keep them apart (1, 2, 3).
`packages/design/design-system.json` is generated from the screens and is never listed: the wave
rebuilds it once after merging. `src/product-knowledge/` and `src/ask/page/select-pick.dom.test.ts`
import `src/business/` (personas, constituents): s1 keeps their behaviour and tests green, and
changes no file there. Nothing from the settings kit or the shell is in a territory: 3217 and 3218
own them, and these slices only import them.

## Per slice: done when

**s1** (`ui: yes`)
- AC-1, AC-2: a `settings-sections` assertion in `src/business/business-sections.render.test.ts`: the
  page renders inside `SettingsPage`, with the four sections named in the spec, each a
  `SettingsSection` with its anchor (`#products`, `#what-you-sell`, `#agent-questions`,
  `#connect-an-agent`), and no heading or tab row of its own (`SectionTabs` is no longer imported).
- AC-4: with many claims and many agent questions, the first items show with the total count and a
  Show all control that reveals the full list in its order; the total is always shown, and the
  "Marked wrong" fold keeps its count.
- AC-6: the existing view tests (`render.test.ts`, `check-render.test.ts`, `reveal-render.test.ts`,
  `load.test.ts`) keep passing for demo, signed-out, no workspace, unreadable, unavailable and ready,
  with assertions moved to the kit's markup; an owner, a member and a signed-out visitor see and do
  what they do today; every URL is unchanged.
- AC-7: `business-settings.md` (and its mock) describes the page as it is now; its `implements` list
  matches the files.
- `pnpm design` shows no new breach and `design/baseline.json` is exact.
- No network, no database, no real key.

**s2** (`ui: yes`)
- AC-1, AC-2: `src/jev/settings/render.test.ts` shows Provider, Keys and Behaviour as sections at their
  anchors, inside `SettingsPage`, with kit rows and fields and no heading of its own.
- AC-3: a Jev save that fails shows the field's error state, says what failed and keeps the typed
  edit; saving, saved and dirty use the kit's wording and the same Save/Cancel placement.
- AC-5: with a saved key, the page shows it masked and neither the render nor a save logs it
  (L-GDPR-2 unchanged: no credential in clear).
- AC-6: the owner-only edit and the member's read-only view are as today, for every state (demo,
  signed-out, no workspace, unreadable, unavailable).
- AC-7: a draft screen `jev-settings.md` and its mock describe the page as it is now (the repository
  has none today: recorded as an outbox item).
- `pnpm design` shows no new breach.

**s3** (`ui: yes`)
- AC-1, AC-2: `src/omni-settings/playbook-render.test.ts` shows Repository, Forms and Editor as
  sections at their anchors inside `SettingsPage`, no heading of its own; each state of the
  Settings repository line is kept.
- AC-3: a Playbook proposal that fails shows the error state, says what failed and keeps the
  person's edit.
- AC-6: the owner proposes, a member reads, a signed-out visitor is refused, as today.
- AC-7: `settings-playbook.md` (and its mock) describes the page as it is now.
- `pnpm design` shows no new breach and `design/baseline.json` is exact.
