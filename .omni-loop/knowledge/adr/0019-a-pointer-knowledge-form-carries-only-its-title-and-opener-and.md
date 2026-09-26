# ADR-0019 — A pointer knowledge form carries only its title and opener, and the check asks it for no section

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec says `omni kb init` writes every missing form with "the front matter with `state: blank`, the title, the opener, every slot heading and marker, empty bodies", and writes the decisions form "as a pointer" when `paths.adr` is outside the front door's `adr/` (the glossary form when `paths.glossary` is set). It does not say whether a pointer form keeps the slot headings. `omni check kb` fails on "a required slot whose marker is missing" without saying whether that holds for a pointer form, whose target resolves the whole form (s1's `resolveForm` ignores its slots). The before/after page's one pointer example, the decisions form in the vertuo-ai-domain column, has no slot.

## Decision

When omni kb init writes a form that points elsewhere, it writes only the front matter, title and opener, with no slot headings. omni check kb requires no slot of a pointer form, since its target answers the whole form.

The option chosen: A. A pointing page carries its title and opening line only, and the check asks it for no section.

## Consequences

A constant before s5 and s7 write pointer forms: one branch in `blankForm` and one condition in `gradeForm`, with their tests. After s7 merges, a pointer form this repository already holds keeps its shape, since `omni kb init` never changes a file that exists; choosing B then turns such a form red until its headings are added by hand.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s3-01-pointer-form-holds-no-sections`
