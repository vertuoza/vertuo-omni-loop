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
