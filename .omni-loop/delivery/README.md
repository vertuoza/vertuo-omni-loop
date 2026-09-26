# Delivery

The folder is the status.

- `inbox/<prd>-<topic>/` — approved, not shipped: `spec.md`, `plan.md`, `before-after.html`.
- `outbox/<prd>-<topic>/` — the decisions agents took while building it, waiting for a person.
- `shipped/<prd>-<topic>/` — merged; its outbox moves inside it as `outbox/`.
- `archive/` — history no PRD issue can be matched to.

Once a PRD's feature PR merges, the omni-loop app opens a retro PR that adds two files to the PRD's
folder — `shipped/<prd>-<topic>/`, or `inbox/<prd>-<topic>/` when it merged without being shipped:

- `retro.md` — how the delivery went: its findings with their evidence, the lessons proposed, the
  timeline and the decisions.
- `retro.json` — the fact sheet of every retro run, so any number `retro.md` shows can be checked.

`<prd>` is the PRD issue number, zero-padded to four digits. The format is defined by the Omni Loop
kit spec: `inbox/0003-omni-loop-kit/spec.md`.
