---
id: s2-03-status-line-token
prd: 1628
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Where on the status line does the cloud token show, since the status line never showed the sign-in before?

## The decision, in plain words

It shows at the end of the first line, after the ask-mode marker, as the word token and the token's last four characters.

## The intro, for fun

The status line had no seat for the sign-in, so we pulled up a chair.

## The punchline, for fun

At the end of the row, where latecomers sit.

## The options, in plain words

A. At the end of line 1, after the ask-mode marker, the option built.
B. Right after the model's name, at the start of line 1.
C. On line 2, beside the PRD the session is on.

## What I had to decide

The place of 'token ··<last four>' on the status line: the spec says where it shows the sign-in today, and line 1 shows only the model, the context, the usage and ask on.

## What I did meanwhile

Appended to line 1 as ' · token ··<last four>', after ask on, also on the unreadable-input line 'omni'; read from the variable alone, with no fetch.

## What it costs to change later

Moving it is a change to one function of the status line command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the line still fits a narrow terminal once the token is added was not measured (author)
