<!-- Imported from pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7:reference/audit.md (Apache-2.0) and modified — every change in kit/porting/plugin--pixel-perfect.md -->

# Audit

Run systematic **technical** quality checks and write one report. Don't fix issues; document them
for the other commands to address (under `review`, for its polish batch).

This is a code-level audit, not a design critique. Check what's measurable and verifiable in the
implementation, against the design form's `system` section: the tokens, the type scale and the
components the product says it uses. A choice the form's `deliberate` section explains is not a
finding.

**Web only.** A native screen (iOS, Android) follows the platform's own guidelines: say that this
audit does not cover it, and stop.

## Diagnostic Scan

Run checks across 5 dimensions. Score each dimension 0-4 using the criteria below.

### 1. Accessibility (A11y)

**Check for**:
- **Contrast issues**: text contrast ratios < 4.5:1 (or 7:1 for AAA)
- **Motion sensitivity**: `prefers-reduced-motion` needs an intentional alternative that preserves
  state change and hierarchy; flag a global `0.01ms` kill that destroys useful feedback, flashing
  above threshold, and motion that blocks focus, reading or task completion
- **Missing ARIA**: interactive elements without proper roles, labels or states
- **Keyboard navigation**: missing focus indicators, illogical tab order, keyboard traps
- **Semantic HTML**: improper heading hierarchy, missing landmarks, divs instead of buttons
- **Alt text**: missing or poor image descriptions
- **Form issues**: inputs without labels, poor error messaging, missing required indicators

**Score 0-4**: 0=Inaccessible (fails WCAG A), 1=Major gaps (few ARIA labels, no keyboard nav),
2=Partial (some a11y effort, significant gaps), 3=Good (WCAG AA mostly met, minor gaps),
4=Excellent (WCAG AA fully met, approaches AAA)

### 2. Performance

**Check for**:
- **Layout thrashing**: reading and writing layout properties in loops
- **Expensive animations**: casual layout-property animation, unbounded blur, filter or shadow
  effects, or effects that visibly drop frames
- **Missing optimization**: images without lazy loading, unoptimized assets
- **will-change overuse**: `will-change` applied broadly or left on at rest (it is a targeted hint
  for known expensive animations, not a baseline requirement)
- **Bundle size**: unnecessary imports, unused dependencies
- **Render performance**: unnecessary re-renders, missing memoization

**Score 0-4**: 0=Severe issues (layout thrash, unoptimized everything), 1=Major problems (no lazy
loading, expensive animations), 2=Partial (some optimization, gaps remain), 3=Good (mostly
optimized, minor improvements possible), 4=Excellent (fast, lean, well-optimized)

### 3. Theming

**Check for**:
- **Hard-coded colours**: colours not using the tokens the form's `system` section names
- **Broken dark mode**: missing dark variants, poor contrast in the dark theme, when the product
  has one
- **Inconsistent tokens**: using the wrong tokens, mixing token types
- **Theme switching issues**: values that don't update on theme change

**Score 0-4**: 0=No theming (hard-coded everything), 1=Minimal tokens (mostly hard-coded),
2=Partial (tokens exist but inconsistently used), 3=Good (tokens used, minor hard-coded values),
4=Excellent (full token system, every theme works)

### 4. Responsive Design

**Check for**:
- **Fixed widths**: hard-coded widths that break on mobile
- **Touch targets**: interactive elements < 44x44px
- **Broken touch interaction**: custom sliders, drag surfaces and scrollable control strips whose
  primary gesture fails under touch, that swallow page scroll or lose the drag to it, or that stay
  stuck after an interrupted gesture. Code tells: mouse-only handlers, no `touch-action` on a
  pointer-event drag surface, drag state that nothing clears on cancel, lost capture or blur.
  Exercise the gesture when the session's browser tool can synthesise touch (a rendered viewport
  proves layout, not the gesture), then say what produced the evidence (emulated viewport,
  synthesised touch, which engine, physical device) and what stayed untested
- **Horizontal scroll**: content overflow on narrow viewports
- **Text scaling**: layouts that break when text size increases
- **Missing breakpoints**: no mobile or tablet variants

**Score 0-4**: 0=Desktop-only (breaks on mobile), 1=Major issues (some breakpoints, many failures),
2=Partial (works on mobile, rough edges), 3=Good (responsive, minor touch target or overflow
issues), 4=Excellent (fluid, all viewports, proper touch targets, gestures work under touch)

### 5. Implementation Integrity (CRITICAL)

Run `commands.design` (`node .omni-loop/bin/omni.mjs config commands.design`) when it is set, and
verify each finding in context; when it prints `null`, write `Design lint: not set here` and judge
by reading. Look for repeated implementation shortcuts, drift from the product's design system
(a one-off value where a token exists, a hand-made control where the product has a component),
misleading or decorative content, and structure that is interchangeable with an unrelated
product. Keep lint findings separate from visual judgement, and call out false positives.

**Score 0-4**: 0=systemic drift, 1=major repeated failures, 2=several verified issues, 3=minor
isolated issues, 4=coherent and intentional

## Generate Report

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | ? | [most critical a11y issue or "--"] |
| 2 | Performance | ? | |
| 3 | Theming | ? | |
| 4 | Responsive Design | ? | |
| 5 | Implementation Integrity | ? | |
| **Total** | | **??/20** | **[Rating band]** |

**Rating bands**: 18-20 Excellent (minor polish), 14-17 Good (address weak dimensions), 10-13
Acceptable (significant work needed), 6-9 Poor (major overhaul), 0-5 Critical (fundamental issues)

### Implementation Integrity Verdict
**Start here.** Pass or fail: does the implementation express the product's own design system?
Cite verified evidence and lint findings.

### Executive Summary
- Audit Health Score: **??/20** ([rating band])
- Total issues found (count by severity: P0/P1/P2/P3)
- Top 3-5 critical issues
- Recommended next steps

### Detailed Findings by Severity

Tag every issue with **P0-P3 severity**:
- **P0 Blocking**: prevents task completion. Fix immediately
- **P1 Major**: significant difficulty or WCAG AA violation. Fix before release
- **P2 Minor**: annoyance, workaround exists. Fix in next pass
- **P3 Polish**: nice-to-fix, no real user impact. Fix if time permits

The severity is the screen's, never the loop's: a P0 here never stops a slice, a wave or a gate.

For each issue, document:
- **[P?] Issue name**
- **Location**: component, file, line
- **Category**: Accessibility / Performance / Theming / Responsive / Implementation Integrity
- **Impact**: how it affects users
- **WCAG/Standard**: which standard it violates (if applicable)
- **Recommendation**: how to fix it
- **Suggested command**: which command to use (from: `/omni:pixel-perfect adapt`, `audit`,
  `clarify`, `critique`, `harden`, `layout`, `polish`, `typeset`)

### Patterns & Systemic Issues

Identify recurring problems that indicate systemic gaps rather than one-off mistakes:
- "Hard-coded colours appear in 15+ components, should use the design tokens"
- "Touch targets consistently too small (<44px) throughout the mobile experience"

### Positive Findings

Note what's working well: good practices to maintain and replicate.

## Recommended Actions

List recommended commands in priority order (P0 first, then P1, then P2):

1. **[P?] `/omni:pixel-perfect <command>`**: brief description (specific context from the findings)
2. **[P?] `/omni:pixel-perfect <command>`**: brief description (specific context)

**Rules**: only recommend commands from: `adapt`, `audit`, `clarify`, `critique`, `harden`,
`layout`, `polish`, `typeset`. Map findings to the most appropriate command. End with
`/omni:pixel-perfect polish` as the final step if any fixes were recommended.

Typed by a person, after the summary, say that the commands can be run one at a time, all at once
or in any order, and that a second audit after the fixes shows whether the score moved.

**IMPORTANT**: be thorough but actionable. Too many P3 issues create noise. Focus on what actually
matters.

**NEVER**:
- Report issues without explaining impact (why does this matter?)
- Provide generic recommendations (be specific and actionable)
- Skip positive findings (say what works)
- Forget to prioritize (everything can't be P0)
- Report false positives without verification
- Report a choice the design form's `deliberate` section explains
