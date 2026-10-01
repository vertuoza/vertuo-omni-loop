---
id: s4-01-heading-without-hashes-still-crashes
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

Typing the rules reader showed that a configured invariants heading written without its leading hash signs makes the tool crash instead of saying what is wrong. Should this slice fix it?

## The decision, in plain words

Left as it is: this slice only adds types and must not change what the tool does. The crash is kept, marked, and left for its own fix later.

## The intro, for fun

The compiler pointed at a heading with no hash signs and asked what happens next.

## The punchline, for fun

What happens next is a crash, now with a sticky note on it.

## The options, in plain words

A. A: keep the crash as it is in this typing slice, and fix it in its own pull request later
B. B: have the settings file refuse such a heading, with a message naming the setting
C. C: read such a heading as covering the rest of the rules page, with no crash

## What I had to decide

Whether to change invariantAdrs in kit/lib/laws.ts so a laws.claudeMdHeading with no leading '#' fails with a named error instead of a TypeError, or keep today's behaviour while typing the file.

## What I did meanwhile

invariantAdrs keeps today's behaviour: the heading's '#' run is read with a non-null assertion, on a line marked `// ts-allow:`, so a heading with no '#' that CLAUDE.md does contain still throws the same TypeError as before. Nothing else changed.

## What it costs to change later

One line in kit/lib/laws.ts and a test: refuse such a heading in the config schema (laws.claudeMdHeading must start with '#'), or treat it as level 0 in invariantAdrs. Either is a small, separate fix PR.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any repository sets laws.claudeMdHeading without a leading '#' today is unknown (author)
