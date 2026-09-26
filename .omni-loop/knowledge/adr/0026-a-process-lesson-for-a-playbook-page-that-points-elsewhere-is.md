# ADR-0026 — A process lesson for a playbook page that points elsewhere is written in the page it points to

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

Spec decision 10: a process lesson lands in a playbook section, `by: human`, and the settled entry records `Became: playbook/<form>#<slot>`, which `omni check outbox` resolves only when the form's own file holds that slot and it is not blank (s1's `resolvePlaybookId`). Decision 4 keeps pointers, not copies. A form with `state: pointer` holds no slot (s3-01) and `omni kb show` prints its target, not its slots; a section holding a `See:` line prints the page it names. The spec does not say where a lesson goes when the form, or the section, points elsewhere.

## Decision

A lesson whose playbook section or form points elsewhere is written in the target page, which stays the one source. A pointing section is still recorded as Became: playbook/<form>#<slot>; a wholly pointing form is recorded as Stays here, naming where the lesson went.

The option chosen: A. Write it in the page kept elsewhere; the record names the part of the loop's page when there is one, and otherwise says where the lesson went.

## Consequences

Prose only, before or after merge: two sentences in `kit/plugin/skills/yolo-fix/SKILL.md`. A ledger that already holds such a `Stays here:` line keeps it, since the ledger only grows.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s6-03-a-lesson-for-a-page-kept-elsewhere`
