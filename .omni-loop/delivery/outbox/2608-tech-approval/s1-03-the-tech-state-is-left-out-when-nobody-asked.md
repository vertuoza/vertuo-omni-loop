---
id: s1-03-the-tech-state-is-left-out-when-nobody-asked
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

When a PRD has no Tech Approval request, should the approval the terminal reads say nothing about it, or say there is none?

## The decision, in plain words

It says nothing: the tech part appears only once a Tech Approval was requested, so a PRD with no request reads exactly as it does today, for an older terminal too.

## The intro, for fun

Silence is the most backward-compatible answer there is.

## The punchline, for fun

Nobody asked, so nobody hears a word about it.

## The options, in plain words

A. A. Leave the tech part out when nobody asked (what was built).
B. B. Always send it, empty when nobody asked.

## What I had to decide

Keep the tech part absent with no request; it holds the login of the named person and one state of asked, approved or voided once there is one.

## What I did meanwhile

The later slices read a missing tech part as no Tech Approval requested.

## What it costs to change later

A constant to change in one function if an empty value is wanted instead; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec calls the field optional without saying whether it is absent or empty when nobody asked (author).
