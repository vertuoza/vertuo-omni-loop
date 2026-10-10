<!-- Imported from pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7:reference/craft-floor.md (Apache-2.0) and modified — every change in kit/porting/plugin--pixel-perfect.md -->

# Craft floor

Read this once the direction is settled, before any edit to a screen, and build without announcing
the checklist.

**The design form wins.** What `omni kb show design` says the product is (`product`), how its
design system is laid out (`system`), what it does on purpose (`deliberate`) and its screen
grammar, the laws a person locked (`language`), overrides anything here. A rule below that the form sets aside is set aside: do not apply it, do not report it. Your
own habit overrides nothing. Where the repository sets `commands.design`, its lint already checks
some of the mechanics below: act on its findings rather than re-auditing each rule by hand.

## Verify

Each of these is a check on the built result, not an intention. Run them together in the one
batched inspection round, not as separate screenshot trips; the checks share one render.

- **Contrast:** body and placeholder text ≥4.5:1, large text ≥3:1. On coloured surfaces tint
  secondary text from that hue or the foreground; never grey.
- **Depth:** shadows carry an offset and a soft blur. A zero-offset coloured halo is decoration.
- **Spacing:** tight groups, generous separation, more space above a heading than below it. Read
  the computed values.
- **Type:** body measure 65–75ch, display max 6rem, tracking floor -0.04em, balanced headings,
  obvious scale and weight steps. Run the real copy at every breakpoint and fix what overflows.
- **Motion:** one authored moment, not scattered effects and not one identical entrance on every
  section. Exponential ease-out from an already-visible default. Blur, backdrop-filter, clip-path,
  mask and shadow belong to the palette when they stay smooth.
- **States:** hover, disabled, loading, error, empty. Plus real content, working controls,
  responsive composition, keyboard focus.
- **Browser surfaces:** the parts you did not draw still carry the design. Text selection, the
  caret, custom scrollbars, focus rings, underline offset and the numerals in tabular data all ship
  with browser defaults that belong to no design system. Theme them from the product's palette.
  This is the cheapest signal that a page was built rather than assembled, and the one most often
  skipped.
- **Copy:** the product's own language, as the form's `product` section gives it. Controls name
  their action; errors name the problem and the recovery.
- **Coverage:** every requirement of the spec or the request present and findable within seconds.

## Refuse

These are the category's defaults, not bans: the design form, or the request's own words, can earn
any of them. Reaching for one when nothing asked for it means you were not deciding; recognising
that means rewriting the element, not softening it.

Page scaffolds:

- Same-size cards of icon plus heading plus text as the page structure. Cards are the lazy
  container; nested cards are always wrong.
- The hero-metric template: big number, small label, supporting stats, accent.
- A kicker or eyebrow above a heading, unless the form's `deliberate` section keeps it: the heading
  carries its own weight; delete the label and let the heading speak.
- Section numbers (01 / 02 / 03) unless the sequence itself carries information the reader needs.
- A modal for a task that needs neither interruption nor protected focus.

Surface habits:

- Gradient text. Emphasis comes from weight or size.
- Glass and blur as decoration rather than as a specific effect.
- A coloured `border-left` or `border-right` above 1px on cards, list items, callouts or alerts.
- Hard offset shadows (`box-shadow: 4px 4px 0`) outside a world that actually chose them.
- Sparklines, progress rings and soft-shadowed rounded rectangles standing in for content.
- Monospace as a costume for "technical" rather than for code, data or measurement.
- A system display face (Impact, Arial Black, the platform sans) as the display voice of a page
  with a world of its own, when the product's `system` names a face of its own.
- Unicode glyphs or emoji standing in for an icon system. Icons come from the product's library, or
  one real library, in one consistent stroke and weight.
- Geometric masks standing in for organic contours: a circle or polygon cutout approximating a
  photographic subject's edge reads worse than omitting it.
- Light or dark picked by category. It comes from the scene of use the form's `product` section
  describes: who, where, under what light.

The floor holds the mechanics; it never picks the direction. The direction is the product's.
