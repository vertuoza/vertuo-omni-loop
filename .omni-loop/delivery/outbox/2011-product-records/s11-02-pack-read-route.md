---
id: s11-02-pack-read-route
prd: 2011
slice: s11
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

How does a person's terminal fetch the latest saved copy of a repository's notes, and what happens when they belong to two teams that both hold it?

## The decision, in plain words

The terminal asks the web app with the person's own sign-in; it gets the newest copy their teams hold, or the copy of one named change, and a person in two teams gets the most recent of the two. Nobody reads another team's copy.

## The intro, for fun

Two teams, one shelf, and a librarian who only hands you books from your own shelf.

## The punchline, for fun

Ask for the newest and you get the newest, never the neighbour's.

## The options, in plain words

A. One read of the whole pack, as the caller, the latest commit's when several workspaces hold it (as built)
B. A list of the pack's files first, then one read per file, so a large pack is never one answer
C. Make the caller name the workspace or the product, and refuse when it is ambiguous

## What I had to decide

Where the read the kit's `omni kb pack get` (s12) calls lives and what it answers. s12's territory holds no web route, and this slice's holds `apps/galaxy/app/api/knowledge-packs/` and `apps/galaxy/src/knowledge-packs/`, so the read is built here: its query, its answer's shape, which pack a member of several workspaces gets, and how it refuses.

## What I did meanwhile

`GET /api/knowledge-packs?repo=<owner/name>[&sha=<commit>]` answers `{repository, sha, committedAt, madeAt, files: [{path, sha256, content}]}`, the files in path order, never cached. It reads as the caller's access token, never a service key, so row-level security decides: a pack of another workspace reads as none (404, BR-PRODUCT-63). With no `sha` it answers the newest pack; a member of several workspaces holding the repository gets the one of the latest commit. It refuses a malformed query (400), no valid sign-in (401), no pack (404), no database here (503), and a database failure (500, logged). It reads the tables, not knowledge_pack_for_token(), which serves agent links and stays unused here.

## What it costs to change later

Small before s12 ships: s12 reads this shape, so a change is one contract file and its reader. After s12, the route and the kit change together.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s12 no web route, so the read is taken to be this slice's because its territory holds the knowledge-packs route folder
- (author) A Vercel function answers at most about 4.5 MB, so a knowledge base larger than that once packed would not be served whole; this repository's is about 1.3 MB
- (author) Nothing says which pack a member of two workspaces holding the same repository should get; the latest commit's is served
