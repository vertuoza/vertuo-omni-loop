---
id: s3-02-s3-which-folders-are-skills
prd: 2313
slice: s3
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Which folders of a repository does the Runner skills block list? The spec leaves out a folder with no skill file or a bad name, but does not say what to do with a folder whose name differs from its skill's name, or one named like a skill of the loop itself.

## The decision, in plain words

The block lists a folder only when its skill name is valid and the same as the folder's name, and it leaves out the loop's own skill names, since those can never be allowed.

## The intro, for fun

Some folders wear a name tag that does not match the door.

## The punchline, for fun

The block only opens doors whose tag and number agree.

## The options, in plain words

A. A. List only skills whose name is valid, equals their folder and is not a loop skill, as built.
B. B. List every folder with a skill file, and show a skill that cannot be allowed as disabled.

## What I had to decide

Whether a skill whose name differs from its folder, or that shares a name with the loop's own skills, is listed. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built as the narrow rule: a runner finds a skill by its folder, and the database refuses the loop's own names.

## What it costs to change later

Undone by changing one condition in the skills reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether Claude accepts a skill whose frontmatter name differs from its folder was not checked (author).
