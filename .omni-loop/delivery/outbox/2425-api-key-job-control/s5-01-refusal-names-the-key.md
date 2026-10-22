---
id: s5-01-refusal-names-the-key
prd: 2425
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a person sends an answer just after an API key already answered or dismissed the same question, who tells them which key came first: the page or the server?

## The decision, in plain words

The page does: after a refused send it reads the question again and shows who closed it, an API key by its name and the person it acted for, while the server's own refusal words stay as they are.

## The intro, for fun

Two answers crossed on the way, so the page checks who got there first.

## The punchline, for fun

The key signed the round first, and now the page says so.

## The options, in plain words

A. A. The page reads the question again after a refused send and names the key itself, the server's words unchanged.
B. B. The server's refusal words name the key and the page shows them as they are, with no second read.

## What I had to decide

Which side names the API key in the closed state a person sees after a refused send: the page, by reading again, or the server, in its refusal words.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Built the page's side: after a refused send the drawer reads the question again and shows its closed words, and when the row cannot be read the refusal's words stand. The server was left as it is.

## What it costs to change later

One small function in the page. If the server's refusal words name the key later, the page's second read can go.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The server's refusal words name a login only and read someone for a key, and the server belongs to the slice that builds the key's own answers, so this slice did not change them.
