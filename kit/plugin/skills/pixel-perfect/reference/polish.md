<!-- Imported from pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7:reference/polish.md (Apache-2.0) and modified — every change in kit/porting/plugin--pixel-perfect.md -->

# Polish

Polish is refinement, never concealed redesign. Preserve the product's visual world, content,
behaviour and everything outside scope. If the concept itself is wrong, say so and name
`/omni:brainstorm` as the way to redesign it, instead of smuggling in a replacement.

A lint result is defect evidence, not proof of quality. Inspect the rendered experience and the
real interaction path.

Followed by `review`, this is its step 5: **one batch** of fixes, from what steps 1 to 4 found,
inside the slice's territory, then **one confirming look**, and stop.

## 1. Establish the system

Read the design form's `system` section (and the file it points at, when it is a pointer) and the
representative tokens, shared components, patterns and neighbouring flows it names. When it is a
`[hole]`, use the project's coherent conventions as the code shows them.

Classify each drift before fixing it:

- **missing token:** the system needs a reusable value;
- **one-off implementation:** an existing shared component or pattern should replace it;
- **conceptual mismatch:** the flow, information architecture or hierarchy differs from comparable
  product areas;
- **local defect:** the implementation is simply incomplete or inconsistent.

Fix the cause at the narrowest correct level. A fix whose level is outside the territory (a new
token, a change to a shared component) is not made here: under `review` it is an outbox item, typed
by a person it is a question. When a binding system principle cannot be inferred, ask (typed by a
person) or record it (under `review`).

## 2. Gather the evidence

Use the feature yourself at the widths of the form's `review` section (390 and 1440 when it names
none), through the session's browser tool when it has one. Determine:

- whether the path is functionally complete;
- the intended quality bar and time available;
- known constraints or deliberately unfinished work (the form's `deliberate` section, the spec);
- the states, content lengths, roles and input methods users will actually encounter.

If a critique or an audit ran in this session on the same target, use its priority issues as one
input, and name it. Perform an independent pass either way.

## 3. Triage

Separate functional defects from cosmetic ones and fix in this order:

1. broken or blocked tasks, data loss, misleading state and inaccessible paths;
2. missing loading, empty, error, success, disabled and permission states;
3. flow, hierarchy, responsive and design-system drift;
4. visual and motion inconsistencies;
5. code and asset cleanup.

Do not perfect one corner while leaving the rest below the same quality bar.

## 4. Polish the whole path

### Flow and hierarchy

- Match neighbouring mental models, terminology, disclosure, routing, save behaviour and optimistic
  or pessimistic patterns.
- Make the primary task and current state obvious without flattening every element to equal
  weight.
- Ensure arrival, transition, empty and recovery paths connect instead of behaving as isolated
  screens.

### Layout and type

- Align to the product's grid and spacing scale; fix optical as well as mathematical alignment.
- Group related content tightly and separate distinct groups generously.
- Keep same-role typography consistent; test measure, wrapping, localization expansion, zoom and
  font loading.
- Verify every supported viewport rather than correcting only the current screenshot.

### Colour, imagery and icons

- Use the product's semantic tokens and stable colour meanings across themes.
- Verify text, control and focus contrast in every state.
- Keep icon families, stroke and weight, sizing and optical alignment coherent.
- Prevent image layout shift; use correct aspect ratios, responsive sources and useful alt text.

### Interaction and state

- Every control needs appropriate default, hover, focus, active, disabled, loading, error and
  success behaviour.
- Preserve visible keyboard focus, logical tab order, labels and platform-appropriate touch
  targets.
- Keep motion coherent, interruptible and performant. Do not add animation merely to make polish
  visible.
- Validate long, missing, localized, offline, slow and permission-limited content where the product
  can encounter it.

### Content and code

- Keep terminology, capitalization, punctuation and factual copy consistent, in the words of the
  form's `product` section. Never change a claim: ask, or record it.
- Remove debug output, dead code, unused imports, obsolete styles and polish-created duplication.
- Replace custom implementations with the product's shared components where the system owns the
  pattern.
- Promote genuinely reusable values to tokens when the token file is inside the territory; do not
  create a system abstraction for one local exception.

## 5. Verify and finish

Walk the complete path again with mouse, keyboard and touch where applicable: under `review`, this
is its one confirming look. Check:

- the narrow and wide widths, and an intermediate one when the layout changes between them;
- loading, empty, error, success, disabled, long-content and missing-content states;
- zoom, contrast, focus, semantics and screen-reader names;
- console errors, layout shift, interaction latency and image loading;
- agreement with the design form, neighbouring features and the scope.

Run `commands.design` once more when it is set; never add another lint of your own. Fix real
defects and document only narrow intentional exceptions. A clean lint does not replace visual
judgement.

Finish with a source diff: remove accidental churn, orphaned code, redundant values and temporary
artifacts. Ship only when the feature is functionally complete and consistently finished across the
path; under `review`, what is not finished after the confirming look is listed and recorded, never
looped on.
