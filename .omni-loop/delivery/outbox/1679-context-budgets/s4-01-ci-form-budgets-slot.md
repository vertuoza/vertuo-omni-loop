---
id: s4-01-ci-form-budgets-slot
prd: 1679
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The plan asks for a Budgets section in the CI page of the playbook, but the kit only accepts the sections it has on its list of sections for that page. Should this slice add Budgets to that list, outside the files it was given?

## The decision, in plain words

I added Budgets as an optional section of the CI page in the kit's list of sections, with its test and the notes that record how the kit's pages differ from where they came from. Without it, the new section would fail the kit's own checks.

## The intro, for fun

A new shelf was ordered for the CI page, but the cupboard only had four slots.

## The punchline, for fun

So the cupboard got a fifth slot, and a note saying who drilled it.

## The options, in plain words

A. Keep the optional budgets slot in the kit's list, with its test and porting notes (as built).
B. Drop the slot and the template section, and keep the budget guidance in the skills only.

## What I had to decide

Agree to keep the optional `budgets` slot of the ci form (kit/lib/playbook/forms.ts, its forms.test.ts line) and the two porting notes (kit/porting/templates--ci.md, kit/porting/plugin--do-work.md), changed outside s4's territory; or say the section should live elsewhere.

## What I did meanwhile

The ci form has an optional budgets slot; a repository whose ci form lacks it shows the kit default, a short paragraph on budgets.

## What it costs to change later

Undoing it is removing one optional slot and the template section; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s4 did not list kit/lib/playbook/forms.ts, which declares each form's slots; the template test refuses a section the list does not hold, so the done-when could not be met without it.
- (author) Slice s5 fills this repository's own Budgets section in the ci form and needs this slot to pass omni check kb; it lands in the same wave.
- (author) Every repository whose ci form has no Budgets section now prints the kit default in omni kb show ci, about 600 bytes more, so form:ci measures a little larger than before this slice.
