# ADR-0020 — ADR — Each knowledge form's version is read from the kit's own template for that form, not from a kit-wide constant

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec says `omni check kb` fails on "a `form-version` newer than the kit's", and the before/after page says `form-version` "lets the kit add a slot later without breaking older forms". The kit has no form-version constant: each template in `kit/templates/playbook/` carries `form-version: 1`, and s1's parser reads it.

## Decision

omni check kb refuses a form only when its form-version is newer than the form-version in the kit's template for that same form. The templates are the single source of each form's version; there is no kit-wide number.

The option chosen: A. Each page's version is compared with the kit's own copy of that page.

## Consequences

A constant, before or after merge: one kit-wide number is a constant and one comparison in `gradeForm`. Nothing stored changes, since every template and every written form says 1 today.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s3-02-form-version-read-from-each-template`
