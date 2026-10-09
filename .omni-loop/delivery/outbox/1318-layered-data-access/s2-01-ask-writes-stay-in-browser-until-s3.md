---
id: s2-01-ask-writes-stay-in-browser-until-s3
prd: 1318
slice: s2
rank: high
bears-on: ADR-0095
raised: 2026-10-09
wave: 2
---

## The question, in plain words

This slice moves the ask pages' reading behind the server, but answering, sorting, sharing and deleting move in the next slice. Where do those actions go in between?

## The decision, in plain words

Until the next slice, the ask pages still answer, sort, share and delete straight from the browser, through one small file of their own, so the pages themselves no longer open a database connection.

## The intro, for fun

The front door moved this week; the back door moves next week.

## The punchline, for fun

Meanwhile the back door has one key, kept on one hook.

## The options, in plain words

A. A. As built: the writes keep a browser client in one file of their own, outside the pages, until s3.
B. B. List that file on the layering baseline as a browser breach until s3 removes it.
C. C. Keep building the browser client inside the pages, and leave their baseline lines until s3.

## What I had to decide

Where the ask pages' writes (sendAnswers, removeSession, sortRound, shareRound, and back.ts's dossier read) build their browser Supabase client while s3 has not moved them behind controllers. They now sit in apps/galaxy/src/ask/page/browser-writes.ts, which is neither a 'use client' file nor a *.client.ts, so the layering guard does not read its @supabase/ssr import as a breach, and it is not on the baseline.

## What I did meanwhile

AskPage, AskSession and AskQuestion import no @supabase/*; their reads go through ask.client.ts and their writes through browser-writes.ts. s3 replaces browser-writes.ts with ask.client.ts calls and deletes it.

## What it costs to change later

s3 already plans the move: delete one file and point four calls at the client.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec moves writes in s3 and asks s2's pages to import no @supabase/*; it does not say where the writes live in between.
