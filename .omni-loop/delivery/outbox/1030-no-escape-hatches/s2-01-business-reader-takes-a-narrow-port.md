---
id: s2-01-business-reader-takes-a-narrow-port
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The agent link reads a business through the same reader as the web address agents call, but asks the database a different question. How does it hand the reader its own question without telling the compiler to trust it?

## The decision, in plain words

The business reader now asks only for something that can call a database function by name, which the real database connection and the agent link's stand-in both are. That shared reader sits in a folder no slice of this feature lists.

## The intro, for fun

One reader, two front doors, and a compiler that wanted proof of both.

## The punchline, for fun

Now the side door carries its own key.

## The options, in plain words

A. A. Narrow the reader's input to a one-method interface, outside this slice's folders: the option built.
B. B. Leave the reader alone and keep the cast in the agent link, which the last slice's guard will then refuse.
C. C. Copy the reader's answer check into the agent link, so the two can drift apart.

## What I had to decide

Whether this slice may change the business reader's input, in a folder outside its own list, so the agent link stops casting its stand-in to a full database client.

## What I did meanwhile

The reader takes a small interface with one method, and the agent link passes a function that calls the token-based database function and hands back its answer and error. Every other caller passes the real client unchanged.

## What it costs to change later

One interface in the business reader's file; undoing it is putting the old parameter type back and the cast with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives no slice the business reader's folder, so no other slice will clear it if it holds a cast later
