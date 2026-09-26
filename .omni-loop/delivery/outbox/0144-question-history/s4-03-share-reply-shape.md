---
id: s4-03-share-reply-shape
prd: 144
slice: s4
rank: high
bears-on: ADR-0002
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The spec names a new way to share a question and says a late answer is refused with who answered, but not exactly what is sent and received; what should it look like?

## The decision, in plain words

Sharing takes the teammate and answers with the link, and a late answer is told who answered first and whether on the page or in the terminal. An answered question may still be shared, read-only.

## The intro, for fun

Two people reach for the same question; somebody has to be told they were second.

## The punchline, for fun

Politely, with the winner's name on the note.

## The options, in plain words

A. Share with member, answered by the link; a late answer told who and which way; any question may be shared
B. Same bodies, but refuse to share a question that is no longer open
C. Share with an email address rather than an account id

## What I had to decide

The exact shape of the share call and of the refusal a second answer gets, and whether an answered question may still be shared.

## What I did meanwhile

Sharing sends the teammate's account id as member and gets back the round, the teammate and the link. A second answer gets a refusal carrying who answered first, by id and name, and which way. Answered or abandoned questions can still be shared, read-only.

## What it costs to change later

No kit sends a share yet and the terminal only reads the refusal's status, so renaming a field is a small change in the app and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the share route and says the refusal names who answered, but gives neither body (author)
- The contract section of ADR-0002 lives outside this slice's files, so it does not yet list the share route (author)
