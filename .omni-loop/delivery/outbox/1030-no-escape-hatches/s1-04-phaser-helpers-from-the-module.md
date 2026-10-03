---
id: s1-04-phaser-helpers-from-the-module
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The game engine is only downloaded when someone opens the platform game. How can the new checks on its objects exist without making every page download it?

## The decision, in plain words

The four checks are made from the engine the game has already loaded, instead of loading the engine themselves, so pages that never open the game still never download it.

## The intro, for fun

Checking an engine's work without inviting the engine over is a delicate dance.

## The punchline, for fun

The checks borrow the engine the game already brought.

## The options, in plain words

A. Make the four checks from the engine the scene loaded: the option built.
B. Import the engine in the checks' file and move that file under the platform game's folder, where the lazy loading guard allows it.
C. Check the objects by their shape rather than their class, which needs no engine at all but trusts a shape instead of the engine's own classes.

## What I had to decide

Whether the Phaser checks are standalone functions that import the engine, or are made from the engine module the scene already holds, as the spec writes them one argument each but the lazy loading guard forbids a static import of the engine.

## What I did meanwhile

A single maker takes the engine module and hands back the four checks, each taking the one argument the spec names. The arcade game's slice calls it once where the scene is made.

## What it costs to change later

One extra line in the scene to make the checks; nothing changes for a player.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the arcade game's slice has not yet called the checks from the scene, so the maker is proven on stand-ins only
