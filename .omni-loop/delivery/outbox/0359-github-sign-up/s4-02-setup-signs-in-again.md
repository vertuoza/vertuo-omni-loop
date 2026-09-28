---
id: s4-02-setup-signs-in-again
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

After someone installs Omni Loop, we must check they really belong to the org they installed it on, and that needs a fresh look at their GitHub account. How do we get that look, since we never keep their GitHub key?

## The decision, in plain words

Coming back from the install, the visitor is quietly signed in with GitHub once more, which takes a blink and asks nothing since they already agreed. That fresh sign-in is what proves who they are before any workspace is made.

## The intro, for fun

The bouncer forgot your face between the coat check and the dance floor.

## The punchline, for fun

So you flash your badge again, and he pretends he knew it was you.

## The options, in plain words

A. A: sign the visitor in with GitHub again on the way back, silently (built)
B. B: keep the visitor's org list from their last sign-in, briefly, and check against it
C. C: add the members read permission to the App and ask GitHub with the App's own key

## What I had to decide

How /signup/installed learns the visitor's GitHub login and orgs, given the provider token is never stored and the App has no members permission.

## What I did meanwhile

/signup/installed validates the address, then starts GitHub's sign-in from the server (signInWithOAuth with skipBrowserRedirect, read:org) coming back to /signup/installed/callback with the setup in its query; the callback exchanges the code, reads the account once, joins by org, checks the installation, makes the workspace and links GitHub. It also signs in a visitor who arrives straight from GitHub. Supabase's redirect allow-list must accept that callback (the README's '/**' entries do). setup_action=update is read as an install, since making the workspace is idempotent.

## What it costs to change later

A constant: the check could read orgs kept from the last sign-in instead, in the one route that starts the sign-in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says to check the visitor against the installation's account but not where their orgs come from at that moment; the App's permissions exclude reading org members
- (author) Not proven live: that GitHub skips its consent screen on the second sign-in, and that the session cookie set in the route survives the redirect (the auth callback relies on the same)
