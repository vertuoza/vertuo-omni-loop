---
id: s1-02-reinstall-keeps-first-installation
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

If an org removes Omni Loop and installs it again, GitHub gives the new install a new number. Should the workspace switch to the new number, or keep the first one it recorded?

## The decision, in plain words

The workspace keeps the first installation it recorded; a later one on the same account is ignored, and the person still joins the workspace. Handling removed installs is out of this PRD.

## The intro, for fun

An org uninstalls and reinstalls, and GitHub hands out a fresh ticket.

## The punchline, for fun

The workspace keeps clutching the old one, sentimental to a fault.

## The options, in plain words

A. A: keep the first recorded installation, ignore a later one (built)
B. B: replace the recorded installation with the newest one
C. C: refuse the second installation with an error

## What I had to decide

Whether create_workspace_from_installation should replace a workspace's recorded installation when a different one arrives for the same account.

## What I did meanwhile

It records an installation only when the workspace has none (spec decision 6), so after an uninstall and reinstall the recorded id is stale until someone updates it by hand.

## What it costs to change later

A constant: one condition in the function, no data migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec leaves installation.deleted out of scope and does not say what a reinstall does (author)
