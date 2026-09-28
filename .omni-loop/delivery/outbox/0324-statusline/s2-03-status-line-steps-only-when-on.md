---
id: s2-03-status-line-steps-only-when-on
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When setup finds someone else's status line, or a settings file it cannot read, should its closing message still say the status line is on for everyone, and tell people to delete the status line setting to remove the loop?

## The decision, in plain words

No: those two sentences appear only while the loop's own status line is in place. Otherwise the message keeps the old removal sentence, which names only the loop's folder, so nobody is told to delete a line the loop did not add.

## The intro, for fun

Setup found a status line it never wrote, and very nearly took the credit for it.

## The punchline, for fun

Now it only talks about the lines it actually wrote.

## The options, in plain words

A. Say both only while the loop's own status line is in place, and otherwise keep the old removal sentence. The option built.
B. Always print both sentences as the spec words them, even when the line in the file is someone else's or the file could not be read.
C. When the line is someone else's, also say how to switch the loop's own line on instead, and keep the old removal sentence.

## What I had to decide

What `omni init`'s closing steps say when it leaves `.claude/settings.json` without the kit's line: someone else's `statusLine`, or a file that is not valid JSON. The spec gives the status line paragraph and the new removal line without saying whether they depend on what init did with the file.

## What I did meanwhile

The paragraph (on for everyone who opens Claude Code in the repository; a person keeps their own in `.claude/settings.local.json`) and the removal line naming the `statusLine` key print only when the key was written or the kit's own was kept. After `kept    .claude/settings.json  (its statusLine is not the kit's)` or `skipped .claude/settings.json: not valid JSON, no status line added`, the paragraph is left out and the removal line stays the old one: `To remove the loop: delete .omni-loop/ and commit. The labels and the App installation stay.`

## What it costs to change later

One condition in `kit/lib/init/steps.mjs` and two cases in `kit/bin/init.test.mjs`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec words the closing steps for a repository where the kit's line is written or kept; it does not say what they say when init leaves someone else's line, or a file it cannot read, alone.
