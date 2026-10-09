# Delivery

The folder is the status.

- `inbox/<prd>-<topic>/` — approved, not shipped: `spec.md`, `plan.md`, `before-after.html`.
- `outbox/<prd>-<topic>/` — the decisions agents took while building it, waiting for a person.
- `shipped/<prd>-<topic>/` — merged; its outbox moves inside it as `outbox/`, beside its release
  note, `release.md`.
- `archive/` — history no PRD issue can be matched to.

**`visual/<nnnn>-<slug>/`** holds one small visual fix made with `/omni:visual-fix`, outside the
loop: no PRD, spec, plan or outbox. `<nnnn>` is its `omni:visual` issue's number, zero-padded to four
digits, and the folder holds `before-after.html` only: today beside the variation the person picked,
then the ones not picked, self-contained and under the before/after size cap. The fix's pull request
closes that issue, carries the folder, and is proven by `omni visual <n>` before it opens.

**`bugs/<nnnn>-<slug>/`** holds one bug fix made with `/omni:bug-fix`, outside the loop: no PRD,
spec, plan or outbox. `<nnnn>` is its `omni:bug` issue's number, zero-padded to four digits, and the
folder holds `bug.md` only: its **Triage** (domain, risk, regression), its **Reproduction** (the
test or scenario the branch adds or changes, and the line it failed with before the fix), the
**Fix**, the **Guard** and the **Mutation** line. The fix's pull request closes that issue, carries
the folder, and is proven by `omni bug <n>` before it opens.

**`inbox/concepts/<nnnn>-<slug>/`** holds one concept made with `/omni:think-big`: a vast idea
explored by a studio of agents before any PRD, the direction a person crowned, and its areas.
`<nnnn>` is its `omni:concept` issue's number, zero-padded to four digits, and the folder holds
`concept.md` (the brief, the vision, why this one, what was killed and why, the fuel, and the
**Areas** table: PRD-sized areas in build order, the wedge first), `vision.html` (the crowned
concept's clickable vision tour), `board-r1.html`, `board-r2.html`, … (each round's board as it was
shown, the person's reactions at its top) and `debate.md` (the studio's turns), nothing else. It
enters the inbox through its own docs-only pull request into `main`, labelled `omni:concept` and
proven by `omni concept <n>` before it opens, which a person merges. `concepts` is no
`<prd>-<topic>` name, so no reader of PRD folders counts it as a PRD. Each area becomes a PRD through
`/omni:brainstorm --concept <n> <area>`, whose phase-0 pull request fills that area's `PRD` cell.
The concept also has a page on the Omni page, under **Work › Concepts**, filled from this folder by
`omni dossier push <n> --kind concept`: `/omni:think-big` pushes it right after opening the concept's
pull request, and `/omni:brainstorm --concept` pushes it again once it fills an area's `PRD` cell.

**`release.md`** says what the PRD shipped, in plain words for anyone outside: a title and a
one-paragraph description, which `omni check releases` grades. The loop writes it when it ships the
PRD, and the person who merges the feature PR approves its words; a typo is fixed by pull request.
Once the shipped folder reaches `main`, the sync (`pnpm releases:sync`, run by the `releases`
workflow) stamps the PRD with its version, `0.0.<n>`, once and for good, in the table the public
release page reads. A note never carries its own version, except the notes of the PRDs shipped
before release notes existed: they are pinned `version: 0.0.1`, the initial release.

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
