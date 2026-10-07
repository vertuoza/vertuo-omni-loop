---
id: s3-01-capital-login-skipped
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

GitHub accounts may be spelt with capital letters (`Serghok`). Should points credited to such an account be skipped until it is spelt in lower case, or credited as GitHub spells it?

## The decision, in plain words

They are credited as GitHub spells them. The login check ignores case, so a capitalised GitHub name keeps earning; only `@`, dots, spaces and other characters no GitHub login can hold are skipped. This departs from the spec's acceptance criterion 7, which also refused upper case.

## The intro, for fun

Somebody signed up to GitHub with their caps lock on.

## The punchline, for fun

The ledger reads their name the way GitHub does: without shouting back.

## The options, in plain words

A. Skip an event credited to a capitalised name, with a warning naming it, as the spec's criterion 7 says.
B. Lower the name before the check, so a capitalised GitHub name is credited under its lower-case spelling.
C. Accept the name in any case, as GitHub issues it, and credit it as spelt.

## What I had to decide

Skip capitalised names, lower them, or accept them as GitHub spells them.

## What I did meanwhile

C. As first built, the slice skipped capitalised names (A), but 12 members of the vertuoza GitHub organisation have a capital in their login, and one (`Serghok`) merged a pull request here: A would have stopped crediting them with every new point, zones secured included. The orchestrator changed the check to ignore case before merging. Contributors stay spelt as GitHub gives them; the board and the roster already match logins whatever their case.

## What it costs to change later

One flag in the projector and a test, no migration.

## What I could not know

(orchestrator) Whether anyone relies on criterion 7 refusing upper case; nothing in the code or the registers does.
