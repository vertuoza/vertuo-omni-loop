---
prd: 1278
title: A mobile trial of the e2e tests
blocked-by: [1276]
spec: file
---

## Problem

The framework's page says the same test API drives iOS simulators, Android emulators and devices, but lists no limit, so mobile is untested. iOS needs a macOS runner with Xcode, and a mobile app has no per-PR address.

## Solution

A trial, not a feature: the same tests tried on one mobile flow of the app, after merge only, against a build pointed at QA, with its cost, its stability and its limits written down.

## Decisions

- **This is a trial:** its output is a written result and, if it holds, the next PRD.
- **Q6 — waits on a person:** Which stack is the mobile app built on (React Native, Flutter, native)?

## User stories

1. As a team deciding whether to test mobile this way, I get a measured answer.

## Scope

In: one mobile flow, one iOS and one Android run, the written result. Out: a mobile job in CI, any other flow.

## Test seams

No product code changes; the trial's result is a document with the runs it rests on.

## Risks

Needs a macOS runner for iOS. Nothing is published to users. Revert is deleting the written result.

## Acceptance criteria

1. The same test runs on an iOS simulator and an Android emulator against a QA build.
2. A result document gives the cost, the stability over repeated runs and each limit met.
3. The document says whether a mobile job is worth a PRD.
