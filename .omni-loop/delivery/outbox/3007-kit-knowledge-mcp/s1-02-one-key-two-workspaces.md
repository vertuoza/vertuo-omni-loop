---
id: s1-02-one-key-two-workspaces
prd: 3007
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

A person who belongs to two workspaces may find a product with the same short name in each. Which one does their agent read?

## The decision, in plain words

Their agent reads the oldest of those products whose knowledge is switched on. A product that is off, archived, or in a workspace they are not in is never chosen.

## The intro, for fun

Two products, one name, one curious agent.

## The punchline, for fun

The elder sibling answers the door first.

## The options, in plain words

A. As built: the oldest of the products of that key whose knowledge is on, among the person's workspaces.
B. Refuse when two of the person's workspaces hold a product of that key that is on, until the terminal names the repository, so the route can pick the product that holds it.
C. Have the terminal send the repository too, and pick the product that holds it, falling back to the oldest.

## What I had to decide

Whether the route picks one product when a person's workspaces hold two with the same key, or refuses until the request names which.

## What I did meanwhile

The new database function picks, among the products of that key in the person's workspaces that are on and not archived, the one created first (then by id), as the existing product lookup by key picks among a person's products. An API key never meets the question: it belongs to one workspace.

## What it costs to change later

A constant in one database function; changing it is one new migration redefining that function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The terminal sends only the product's key, never the repository, so the route cannot prefer the workspace that holds the session's repository as the existing lookup does when it is given one.
