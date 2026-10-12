<!-- Imported from pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7:reference/typeset.md (Apache-2.0) and modified — every change in kit/porting/plugin--pixel-perfect.md -->

# Typeset

Read the design form first (`omni kb show design`): its `product`, `system`, `deliberate` and `language` sections (the last, its laws) win over anything here, and a choice its `deliberate` section explains is not a finding. Followed by `review`, fixes stay inside the slice's territory; anything else is an outbox item.

Typography carries information, hierarchy, and voice. Improve it inside the established visual world; do not replace the identity unless the user asked to.

---

## Visitor mode

- **Persuade + Experience:** display type may carry the voice. Use decisive contrast and responsive scale when the composition benefits.
- **Operate + Read:** stability, scanability, and measure come first. A single well-tuned family and fixed role scale are often right.
- **Native:** follow the platform's own guidelines, including platform scaling and accessibility behavior; this reference is for the web.

The faces, weights and scale the design form's `system` section names are authoritative. If typography replacement would create a new identity, it is not this command's: say so, and name `/omni:brainstorm`. Otherwise preserve confirmed families and improve their use.

## Two isolated assessments

Run these as two isolated helper agents when the session can start one; otherwise run them yourself in this order, the first finished before the second is read. Do not let lint findings anchor the design assessment.

1. **Typographic assessment:** inspect representative pages and styles. Answer every question below with a file, selector, or computed value:
   - **Authority and fit:** Which faces, weights, and roles are established? Do they fit the product and selected world, or are they unexamined defaults? Is every family necessary?
   - **Hierarchy:** Can heading, body, label, metadata, and data roles be distinguished at a glance? Are adjacent sizes or weights too close to carry different jobs?
   - **Scale and consistency:** Is there a deliberate role scale, or a collection of arbitrary values? Do repeated roles stay identical across screens and states?
   - **Reading:** Does body copy stay within a comfortable 45–75 character measure? Are line height, paragraph rhythm, contrast, and tracking tuned to the actual face, width, language, and surface?
   - **Stress:** What happens with long headings, localization expansion, zoom, narrow containers, missing weights, and font fallback?
   - **Delivery:** Are only used assets loaded? Do fallback metrics, loading strategy, and variable-font settings avoid invisible text and disruptive reflow?
2. **Mechanical scan:** run `commands.design` (`node .omni-loop/bin/omni.mjs config commands.design`) from the repository root when it is set, on the target's files when it takes paths, and keep its type findings. When it prints `null`, write `Design lint: not set here` and inspect by reading.

Also inspect dynamic or arbitrary font values the lint cannot interpret. Synthesize both assessments before editing, noting what each caught alone. A clean scan is a floor, not proof of good typography.

## Set the system

Before editing, state:

- the roles the interface needs;
- the intended contrast between those roles;
- the reading measure and density;
- which existing faces and weights are authoritative;
- any performance, localization, or accessibility constraints.

Use the fewest roles and families that make the hierarchy unmistakable. Combine size, weight, space, and tone deliberately instead of asking size alone to do all the work. Role names and tokens should describe purpose rather than values.

## Apply

- Keep body copy comfortably readable and zoomable. Use 1rem / 16px as the ordinary web body floor unless a dense role, platform convention, or user setting justifies otherwise.
- Keep prose in the 45–75ch range. Tune line height inversely with measure: wider lines generally need more leading.
- Compensate light text on dark surfaces on all three perceptual axes: slightly more line height, a touch more tracking, and one step more weight when the face needs it.
- Tune line height to the face, width, language, and contrast, not a universal ratio.
- Keep repeated roles consistent across screens and states.
- Use numeric, tabular, code, and label features when their content benefits.
- Load only used font assets and weights. Provide metric-compatible fallbacks and avoid blocking text.
- Let marketing display type respond to available space when useful; keep dense product and reading surfaces spatially predictable.
- Preserve browser zoom, user font settings, Dynamic Type, and platform text scaling.
- Use paragraph spacing or first-line indentation as the primary paragraph rhythm; combining both usually double-marks the boundary.

Do not make type decorative at the expense of comprehension, or introduce a second family without a clear role it alone can perform.

## Verify

- Primary, secondary, body, and metadata roles are recognizable without reading the copy.
- Long text remains comfortable across relevant widths and languages.
- The typography belongs to the product and its established world.
- Loading does not create disruptive reflow or invisible text.
- Zoom, text scaling, focus, contrast, and reduced viewport paths remain usable.
- The final lint, when `commands.design` is set, has no unexplained findings.

Answer each item with rendered or source evidence, then rerun the lint when it is set. Do not substitute a bare “yes” for verification.

When the hierarchy holds, hand off to `/omni:pixel-perfect polish`.
