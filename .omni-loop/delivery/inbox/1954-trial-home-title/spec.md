---
prd: 1954
title: "Trial: arcade home shows OMNI LOOP title (e2e 1941 trial)"
blocked-by: none
spec: file
phase0: server
e2e: validate
---

## Problem

Throwaway trial PRD, written only to exercise `/omni:validate-e2e` under `/omni:yolo` (PRD 1941). It must never be merged. The arcade's home page already shows the title OMNI LOOP; this PRD asserts it.

## Solution

Add one e2e test that opens the arcade home page and checks that the title OMNI LOOP is visible. No product code changes.

## Decisions

- Trial only: nothing from this PRD is merged into `main`.
- The persona voice was not asked: the request said no questions.

## User stories

- As a visitor, I open the arcade and see the title OMNI LOOP.

## Scope

In: one e2e test for the criterion below. Out: any change to `apps/galaxy`, to the title or to the page.

## Test seams

The test runs in a browser against the arcade's deployed URL (`e2e.url`). No unit seam.

## Risks

Merging publishes nothing: no product code changes. The locked laws: none touched. Rollback: close the PR.

## Acceptance criteria

- The arcade home page shows the title OMNI LOOP.
