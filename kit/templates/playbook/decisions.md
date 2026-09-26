---
form: decisions
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/adr/index.md — changes in kit/porting/templates--decisions.md -->

# Decision records

Use this page when recording a decision about how this repository is built, or looking one up.

## Where they live
<!-- slot: where · required -->
Decision records live in `{config:paths.adr}`. A decision about how we build (an architecture, a
tool, a trade-off) is a decision record; a decision about what the product should do is a principle,
in the knowledge registers.

## Format
<!-- slot: format · required -->
A record says that a decision was made, and why: the hard-to-reverse choices a future reader would
otherwise have to reverse-engineer. One file per record, named `NNNN-<slug>.md` with four digits,
titled `# NNNN — <the decision>`. Under the title, a status line (accepted; supersedes, or superseded
by, another record), then the decision, the options considered with why each was rejected, and the
consequences.

A record is never deleted and never rewritten to say something new: a later record supersedes it,
and the old one's status line points to its successor. A record that states a product decision is
trimmed to its mechanism, and links the principle instead.

## Numbering
<!-- slot: numbering · optional -->
A new record takes the next free number. `omni kb show decisions` prints it, with every record's
number and title, read from the folder each time: nobody keeps that list by hand. A number belongs
to one record; two records sharing one is a mistake to fix, never a precedent.
