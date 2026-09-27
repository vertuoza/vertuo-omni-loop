---
id: s1-01-hand-off-blocks-printed-how
prd: 292
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

At the end of a brainstorm, should the folder, the stages and the next steps all be shown as fixed-width text, or only the parts that must line up?

## The decision, in plain words

The folder and the stages are shown as fixed-width text, so the tree and the arrows line up. The next steps are shown as ordinary formatted text, so the heading is bold and the steps read as a list.

## The intro, for fun

Some parts of a reply want a ruler, and some want a bold heading.

## The punchline, for fun

The arrows got the ruler, and the heading got the bold.

## The options, in plain words

A. The folder and the stages as fixed-width text, the next steps as formatted text: the option built.
B. All three as fixed-width text, exactly as the spec draws them, so the heading shows its stars.
C. All three as formatted text, leaving the tree and the arrows free to drift.

## What I had to decide

How the three blocks that end `/omni:brainstorm` step 10, and the two-step block that ends `/omni:plan` step 7 run alone, are printed. The spec draws all three as `text` fences, yet its What is next? block holds `**What is next?**` and a numbered list, which only render as Markdown.

## What I did meanwhile

The folder and the stages are `text` fences, and step 10 says to print each in a code block so the tree and the arrows line up. The What is next? templates in both skills are `markdown` fences, printed as Markdown, with `/omni:yolo <n>` alone on the reply's last line. `kit/test/plugin.test.mjs` reads only the phrases and the last fenced line, so every option below passes it.

## What it costs to change later

A fence language and one sentence per block, in two skills. No code, no command, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec, its before/after page and the plan do not say whether the What is next? block is printed inside a code block or as Markdown: the before/after page draws it in a terminal, where the two look alike.
