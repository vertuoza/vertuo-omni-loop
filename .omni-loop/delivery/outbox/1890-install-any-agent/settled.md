# Settled outbox items — PRD 1890

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s6-01-init-claude-only-line-left-out -->

## s6-01-init-claude-only-line-left-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-init-claude-only-line-left-out
prd: 1890
slice: s6
rank: medium
bears-on: none
raised: 2026-10-14
wave: 3
---

## The question, in plain words

The spec asks the setup's closing steps to say that the status line and the band are only in Claude Code, but that code belongs to another part of this change. Should that line be added there too?

## The decision, in plain words

The help and the install guide now say it; the setup's own closing steps do not yet.

## The intro, for fun

One sentence about the status line wanted a home in the setup's goodbye.

## The punchline, for fun

It found rooms in the help and the guide instead, and waits at the door.

## The options, in plain words

A. A. Leave the closing steps as they are: the help and the install guide carry the line.
B. B. Add the line to omni init's closing steps, shown when agents lists an agent other than Claude.

## What I had to decide

Answer A to leave the closing steps as they are (the help and the install guide carry the line), or B to add the one line to the closing steps of omni init in a follow-up slice.

## What I did meanwhile

omni help statusline and the install guide say the status line and the HUD are Claude Code's alone; omni init's closing steps say nothing about it.

## What it costs to change later

B is one line in the init's closing steps and its test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the line belongs in every init or only when agents lists another agent than Claude (author).

```

<!-- /omni-outbox-settled: s6-01-init-claude-only-line-left-out -->

<!-- omni-outbox-settled: s1-01-agents-tests-beside-a-rule-proof -->

## s1-01-agents-tests-beside-a-rule-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-14T09:32:15Z
- Channel: feature pull request #1891
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1891#issuecomment-6165297594
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-23
- Raised: 2026-10-14
- Slice: s1
- Wave: 1
- Stays here: where a test sits beside a proof; no lasting rule beyond this file.

### The answer, as it was given

```text
A. Keep the agents checks in the config's test file, beside the signature rule's proof (built).
```

### The item, as it was raised

```text
---
id: s1-01-agents-tests-beside-a-rule-proof
prd: 1890
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new checks for the setting that lists which coding agents a team uses were added to the test file that also proves the config refuses a bad signature. Is it fine that this file now carries more than that proof?

## The decision, in plain words

Yes: the signature rule and its checks are untouched. The file only gained checks that the new setting is read, defaults to Claude alone and refuses an unknown or repeated agent, and its list of settings names the new one.

## The intro, for fun

One test file guards how the loop signs its work, and now it also counts the agents.

## The punchline, for fun

Same guard, one more name on the clipboard.

## The options, in plain words

A. Keep the agents checks in the config's test file, beside the signature rule's proof (built).
B. Move the agents checks to a test file of their own, so only the list of settings changes in the proof file.

## What I had to decide

Whether the checks of the agents setting stay beside the signature rule's proof or move to a file of their own.

Decided by: Jev (hardToRevert 0.80) · agent said true

## What I did meanwhile

Kept the checks in the config's test file, beside the existing checks of every other setting, as PRD 1804 did for its setup command.

## What it costs to change later

Moving the checks to their own file later is a cut and paste of two tests; the list of settings in the proof file changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the person who answers prefers each new setting's checks in a file of their own; PRD 1804 kept them beside the proof and was agreed.

```

<!-- /omni-outbox-settled: s1-01-agents-tests-beside-a-rule-proof -->

<!-- omni-outbox-settled: s2-01-skills-check-beside-bundle-law -->

## s2-01-skills-check-beside-bundle-law — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-14T09:32:15Z
- Channel: feature pull request #1891
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1891#issuecomment-6165297594
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-5
- Raised: 2026-10-14
- Slice: s2
- Wave: 1
- Stays here: where a test sits beside a law's proof; the law is unchanged.

### The answer, as it was given

```text
A. Keep the skills check beside the bundle law's proof, the proof untouched (built).
```

### The item, as it was raised

```text
---
id: s2-01-skills-check-beside-bundle-law
prd: 1890
slice: s2
rank: high
bears-on: N-PRODUCT-5
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The check that the kit carries every skill now lives in the same test file that proves the kit builds the same bytes wherever it starts. Is it fine there?

## The decision, in plain words

The new check sits beside the law's proof, in the file the plan names. The proof itself is untouched: it builds and compares exactly as before.

## The intro, for fun

One test file, two jobs, no elbows thrown.

## The punchline, for fun

The old proof did not even notice its new neighbour.

## The options, in plain words

A. Keep the skills check beside the bundle law's proof, the proof untouched (built).
B. Move the skills check to a test file of its own, leaving the law's file as it was.

## What I had to decide

Keep the skills check in kit/test/dist.test.ts beside N-PRODUCT-5's proof (A), or move it to a test file of its own (B).

## What I did meanwhile

kit/test/dist.test.ts gained one test that builds the bundle to a scratch file, imports it and compares every file under kit/plugin/skills/ byte for byte; N-PRODUCT-5's own test is unchanged and green.

## What it costs to change later

Moving one test to a new file: a few minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person would rather keep a law's proof file to the law alone (author).

```

<!-- /omni-outbox-settled: s2-01-skills-check-beside-bundle-law -->

<!-- omni-outbox-settled: s3-01-install-law-amended-for-agent-copies -->

## s3-01-install-law-amended-for-agent-copies — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-14T09:32:15Z
- Channel: feature pull request #1891
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1891#issuecomment-6165297594
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-13
- Raised: 2026-10-14
- Slice: s3
- Wave: 2
- Became: N-PRODUCT-13

### The answer, as it was given

```text
A. A. Approve the new wording, so the install may keep the skill copies it lists for the other agents (built)
```

### The item, as it was raised

```text
---
id: s3-01-install-law-amended-for-agent-copies
prd: 1890
slice: s3
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The rule that the install only writes inside its own folder now also lets it write the skill copies for Codex, Cursor and Gemini, and only those it keeps a list of. Do you approve the new wording?

## The decision, in plain words

The rule carries the wording the spec gives, word for word, and its tests now prove the install writes those copies, leaves a team's own skills alone and stops on a folder that is not its own.

## The intro, for fun

The install asked for a bigger room, and promised to keep to its side of it.

## The punchline, for fun

It even wrote its name on every box it carried in.

## The options, in plain words

A. A. Approve the new wording, so the install may keep the skill copies it lists for the other agents (built)
B. B. Keep the old wording, and the install writes no skill copies for the other agents

## What I had to decide

Approve the amended rule as written (A), or keep the old wording and have the install write no skill copies (B). Approval of the feature PR on GitHub by the rule's owner settles it either way.

## What I did meanwhile

N-PRODUCT-13 now reads that omni init and omni update write nothing outside .omni-loop/ except the two Claude settings keys and the .agents/skills/omni-* folders the manifest owns; its Governs line gains kit/lib/agents and kit/lib/update and its Enforced by line gains kit/lib/agents/write.test.ts. The init tests gained the copies' exception: [claude] writes no .agents/ path, [cursor, gemini] writes no .claude/settings.json and installs no plugin, a foreign skill stays byte-identical and an unowned omni-* folder stops init before any write.

## What it costs to change later

Reverting the wording and the init wiring is one commit; a repository that already installed keeps its committed copies until a person deletes them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Only the rule's owner can approve the new wording; the spec records the person's choice at the design, and the approval on the feature PR is still to come (author).

```

<!-- /omni-outbox-settled: s3-01-install-law-amended-for-agent-copies -->

<!-- omni-outbox-settled: s3-02-codeowners-follows-the-amended-law -->

## s3-02-codeowners-follows-the-amended-law — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-14T09:32:15Z
- Channel: feature pull request #1891
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1891#issuecomment-6165297594
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-13
- Raised: 2026-10-14
- Slice: s3
- Wave: 2
- Stays here: CODEOWNERS follows `omni kb owners`; no new rule.

### The answer, as it was given

```text
A. A. Keep the owners list regenerated in this slice, so the checks stay green (built)
```

### The item, as it was raised

```text
---
id: s3-02-codeowners-follows-the-amended-law
prd: 1890
slice: s3
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The amended install rule names one more test as its proof, so the list of files only the rule's owner may approve gained that test, a list outside this slice's ground. Is it fine that this slice updated it?

## The decision, in plain words

The slice regenerated the owners list with the kit's own command, which added the new proof test and changed nothing else, so the repository's checks stay green.

## The intro, for fun

A new test joined the club, and someone had to update the guest list.

## The punchline, for fun

The bouncer only added one name, and spelled it right.

## The options, in plain words

A. A. Keep the owners list regenerated in this slice, so the checks stay green (built)
B. B. Drop the line here and let the wave regenerate the list after merging

## What I had to decide

Keep the regenerated owners list in this slice (A), or leave it to the wave to regenerate after merging (B).

## What I did meanwhile

Ran omni kb owners: .github/CODEOWNERS gained the line /kit/lib/agents/write.test.ts @pierrederval inside its generated block; no line outside the markers changed. Without it, omni check knowledge is red.

## What it costs to change later

One generated line; reverting it is one commit, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the owners list; whether the wave would rather regenerate it once after merging (author).

```

<!-- /omni-outbox-settled: s3-02-codeowners-follows-the-amended-law -->
