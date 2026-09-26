---
id: s2-01-knowledge-that-crosses-domains-on-the-page
prd: 149
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Some knowledge sits between two domains, and a rule in one domain can serve a principle kept in another. How should the reading page show knowledge that crosses a domain's border?

## The decision, in plain words

The knowledge between two domains gets a tab of its own, drawn like a domain, with its pair named beside each entry. In a domain's list, a principle kept in another domain heads the group of the rules here that serve it, marked with the domain it lives in, and a link to one entry always opens it in its own tab.

## The intro, for fun

Borders are easy to draw on a map, and much harder to draw around an idea.

## The punchline, for fun

So the ideas that cross them get a tab of their own, passport included.

## The options, in plain words

A. A tab of its own for the knowledge between domains, and a principle kept in another domain heading the group of the rules here that serve it, the option built.
B. No tab between domains: show each shared entry in both of its domains, marked as shared.
C. Keep each domain's list to its own principles, and gather the rules that serve another domain's principle in a group of their own at the end.

## What I had to decide

The spec asks for a **Between domains** tab when cross-domain entries exist, but says nothing of its address, of what its diagram shows, or of how a domain's index groups a rule whose `Serves:` names a principle of another domain (or a principle that only other domains serve). This repository has only the `product` domain today, so none of it shows yet; it will as soon as a repository keeps domains.

## What I did meanwhile

The tab is addressed `?domain=cross-domain`, the folder's own name (`BETWEEN` in `apps/galaxy/src/knowledge/view.ts`). Its diagram is the same orrery, every cross-domain entry on its kind's orbit around a sun labelled `between`, and its panel adds a `Domains` row with the pair. In any tab, `indexOf` heads a group with a principle of another tab when an entry here serves it (the row tagged `in <domain>`, a link to that principle in its own tab), and a principle of this tab that only other tabs serve heads a group with no member here. An `?entry=` always wins over `?domain=`: an entry opens in its own tab, so a shared link never lands on the wrong one. `view.test.ts` and `render.test.ts` pin all of it on a fixture with a `billing` domain and one `billing--product` pair.

## What it costs to change later

A constant and one function: the `BETWEEN` key and `indexOf`'s foreign group heads, both in `apps/galaxy/src/knowledge/view.ts`, with their tests. A shared link to a between-domains entry keeps working if the key changes, because the entry decides the tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No repository with domains or cross-domain files was at hand: the grouping has only been seen on the test fixture, never on real registers.
- (author) A domain folder named cross-domain would share the tab's address; the kit does not forbid that name, and the domain's own tab would then be unreachable by address.
