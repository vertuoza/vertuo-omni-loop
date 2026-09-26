# Delivery

The folder is the status.

- `inbox/<prd>-<topic>/` — approved, not shipped: `spec.md`, `plan.md`, `before-after.html`.
- `outbox/<prd>-<topic>/` — the decisions agents took while building it, waiting for a person.
- `shipped/<prd>-<topic>/` — merged; its outbox moves inside it as `outbox/`.
- `archive/` — history no PRD issue can be matched to.

Once a PRD's feature PR merges, the omni-loop app opens two pull requests, each for a person to
review and merge.

The **retro PR** adds two files to the PRD's folder, always `shipped/<prd>-<topic>/`:

- `retro.md` — how the delivery went: its findings with their evidence, the lessons proposed, the
  timeline and the decisions.
- `retro.json` — the fact sheet of every retro run, so any number `retro.md` shows can be checked.

The **knowledge PR** (branch `docs/knowledge-<topic>`, label `omni:knowledge`) harvests the PRD:

- **A merge over a red outbox adopts what is still open.** Every outbox item still open when the
  feature PR merged is settled as `adopted` in the ledger, the person who merged it the approver and
  the merge time the approval time, and its file is deleted. Drift that was never reworked gets one
  more `adopted` entry the same way: the merge adopts what was built, and the answer that asked for
  something else stays in the ledger above it.
- **The folder is shipped** to `shipped/<prd>-<topic>/` when it was still in `inbox/`.
- **Every settled decision not yet written back** becomes a decision record, a rule or an invariant
  in the knowledge base, is covered by one already there, or stays here. Its ledger entry gets the
  matching `Became:` or `Stays here:` line. One the harvest could not place gets no line.

`<prd>` is the PRD issue number, zero-padded to four digits. The format is defined by the Omni Loop
kit spec: `inbox/0003-omni-loop-kit/spec.md`.
