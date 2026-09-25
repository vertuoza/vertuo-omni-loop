<!-- Ported from vertuo-ai-domain@db67fd9da:docs/knowledge/README.md — changes in kit/porting/templates--front-door.md -->

# Knowledge

Use this page when you need to know what is true about the product, or how to work in this
repository. Start here even when the knowledge lives elsewhere: anything kept somewhere else has a
pointer here.

## Two halves

- **What is true.** The knowledge registers, in `{config:paths.knowledge}`: principles (a person's
  decision about what the product should be), business rules (what may or may not happen, each
  serving one principle) and invariants (what must always hold in the code). Decisions about how it
  is built are decision records, in `{config:paths.adr}`.
- **How we work here.** The playbook, in `{config:paths.playbook}`: one form per question an agent
  asks while delivering. How to set up, test, and verify; how CI works and which reds are known; what
  a pull request looks like; what a merge publishes; the rules that cost the most when broken.

## How a form is read

The skills never read a form's file: they call `omni kb show <form>`, which resolves it section by
section, and says where each section came from. Top wins:

1. **A pointer.** The whole form points at a page the repository already has, or one section does,
   with a `See:` line. Nothing is copied.
2. **The repository's section.** What only this repository knows, written from evidence, or by a
   person.
3. **The kit default.** Doctrine every repository shares. It ships with the kit, so a section left
   blank here improves when the kit is upgraded.

A question nobody could answer yet is a `TODO(human)` line: the kit default applies meanwhile.
`omni kb status` lists every form, its state, and its open questions.
