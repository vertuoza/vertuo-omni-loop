---
screen: persona-drawer
status: draft
kind: shared
mock: persona-drawer.html
implements: [apps/galaxy/src/business/PersonasSection.tsx, apps/galaxy/src/business/personas.ts, packages/design/src/personas.ts]
reads: [apps/galaxy/src/business/personas-store.ts]
routes: [/app/products/<id>/knowledge/personas, /app/products/<id>/knowledge/personas/<item>, /app/settings/business]
supersedes: null
---

## Purpose

Adds or edits one persona of a product: who agents picture when they design. Shared by the Knowledge
tab's Personas list and item page, and Settings › Business.

## Regions

- **Portrait:** the chosen portrait, drawn at 4×, beside the fields.
- **Fields:** Name; Stance (three chips: Enthusiastic, Neutral, Skeptical); Trade (a select of
  twenty-one trades, then Other…); Other trade (a text field, only when Other… is chosen); Who they
  are; How they use it.
- **Portrait picker:** 24 variations of the trade's bust, Shuffle for 24 others.
- **Actions:** Save (primary), Cancel.

## States

- **Add:** title "Add a persona", a random portrait for the trade.
- **Edit:** title "Edit <name>", the fields and portrait as saved.
- **Other trade:** a trade with no art of its own is drawn with the generic bust, in the picker and
  on the card.
- **Invalid other trade:** the rule line under the field turns red, and Save keeps the drawer open.
- **Refused:** the database's words above the actions.

## Words

Add a persona · Edit · Name · Stance · Enthusiastic · Neutral · Skeptical · Trade · Other… · Other
trade · Lower-case words, spaces or hyphens · Who they are · How they use it · Portrait · Shuffle ·
Save · Cancel.

## Refusals

- Never a trade outside the rule: lower-case letters, single spaces or hyphens, at most 40
  characters.
- Never a fourth stance.

## Open questions

- Does the Other trade field keep what was typed when the person switches back to a listed trade
  and then to Other… again?

## Source

- /omni:brainstorm, PRD 2779: .omni-loop/delivery/shipped/2779-open-personas/before-after.html
