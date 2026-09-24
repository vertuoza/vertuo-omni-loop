# Delivery

The folder is the status.

- `inbox/<prd>-<topic>/` — approved, not shipped: `spec.md`, `plan.md`, `before-after.html`.
- `outbox/<prd>-<topic>/` — the decisions agents took while building it, waiting for a person.
- `shipped/<prd>-<topic>/` — merged; its outbox moves inside it as `outbox/`.
- `archive/` — history no PRD issue can be matched to.

`<prd>` is the PRD issue number, zero-padded to four digits. The format is defined by the Omni Loop
kit spec: `inbox/0003-omni-loop-kit/spec.md`.
