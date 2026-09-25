---
id: s6-03-a-lesson-for-a-page-kept-elsewhere
prd: 45
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When a person's answer teaches a lesson about how to work in the repository, and the page it belongs to is kept elsewhere in the repository rather than in the loop's own folder, where is the lesson written?

## The decision, in plain words

In the page kept elsewhere, so that page stays the one source. When only one part of the loop's page points there, the record of the answer still names that part; when the whole page points there, the record says in words where the lesson went.

## The options, in plain words

A. Write it in the page kept elsewhere; the record names the part of the loop's page when there is one, and otherwise says where the lesson went.
B. Write it into the loop's own page anyway, beside the pointer, so the record can always name it; agents reading the page would not see it while the pointer stands.
C. Keep it in the record of the answer only, and let a person copy it where it belongs.

## What I had to decide

Spec decision 10: a process lesson lands in a playbook section, `by: human`, and the settled entry records `Became: playbook/<form>#<slot>`, which `omni check outbox` resolves only when the form's own file holds that slot and it is not blank (s1's `resolvePlaybookId`). Decision 4 keeps pointers, not copies. A form with `state: pointer` holds no slot (s3-01) and `omni kb show` prints its target, not its slots; a section holding a `See:` line prints the page it names. The spec does not say where a lesson goes when the form, or the section, points elsewhere.

## What I did meanwhile

`/omni:yolo-fix` §3 (write-back): a section that `omni kb show <form>` prints from another page takes the lesson in that page, and the entry still records `Became: playbook/<form>#<slot>`, since the `See:` line keeps the slot non-blank. A form that points elsewhere as a whole takes the lesson in its target, and the entry records `Stays here:` with a reason naming where it went: there is no slot to name, and a `Became:` would fail `omni check outbox`.

## What it costs to change later

Prose only, before or after merge: two sentences in `kit/plugin/skills/yolo-fix/SKILL.md`. A ledger that already holds such a `Stays here:` line keeps it, since the ledger only grows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the kit should later accept a `Became:` naming a page outside the playbook, so a lesson written into a pointed page is traced like any other.
