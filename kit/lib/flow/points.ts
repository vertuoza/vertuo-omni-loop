// The catalog of the points a repository's flow may hook (PRD 1089): the one source of each point's
// skills, the modes it allows, the inputs a hook is handed and, for a `replace`, what the hook must
// produce. A point is named `<skill>.<step>` after the base skill; an ultra or mega variant that
// follows that skill step for step fires the same point, so it is listed beside it.

/** The ways a hook joins a point: before the kit's step, after it, or in its place. */
const HOOK_MODES = Object.freeze(['before', 'after', 'replace'] as const);
export type HookMode = (typeof HOOK_MODES)[number];

export type FlowPoint = {
  /** `<skill>.<step>`. */
  point: string;
  /** The skills that fire it, by their plugin name. */
  skills: readonly string[];
  /** The modes a hook may take here: `before` and `after` everywhere, `replace` only where the act may be swapped. */
  modes: readonly HookMode[];
  /** What a hook at this point is handed. */
  inputs: readonly string[];
  /** What a `replace` hook must produce; `[]` where no `replace` is allowed. */
  outputs: readonly string[];
};

const EXTEND: readonly HookMode[] = Object.freeze(['before', 'after']);
const ANY: readonly HookMode[] = HOOK_MODES;
const SLICE_INPUTS = Object.freeze(['prd', 'slice', 'territory', 'branch']);

export const FLOW_POINTS: readonly FlowPoint[] = Object.freeze([
  { point: 'plan.slice', skills: ['plan', 'mega-brainstorm'], modes: EXTEND, inputs: ['prd', 'slice', 'territory'], outputs: [] },
  { point: 'plan.done', skills: ['plan'], modes: EXTEND, inputs: ['prd', 'plan'], outputs: [] },
  { point: 'do-work.start', skills: ['do-work'], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  { point: 'do-work.test', skills: ['do-work'], modes: ANY, inputs: SLICE_INPUTS, outputs: ['the verdict line'] },
  { point: 'do-work.review', skills: ['do-work'], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  { point: 'do-work.ready', skills: ['do-work'], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  {
    point: 'pr.open',
    skills: ['pr'],
    modes: ANY,
    inputs: ['base', 'head', 'title', 'body', 'draft'],
    outputs: ["the PR's URL as its last line before the verdict", 'the verdict line'],
  },
  { point: 'wave.merge', skills: ['wave', 'ultra-wave'], modes: ANY, inputs: ['prd', 'slice', 'pr'], outputs: ["the merged PR's number in the verdict"] },
  { point: 'yolo.ready', skills: ['yolo', 'ultra-yolo'], modes: EXTEND, inputs: ['prd', 'pr'], outputs: [] },
]);

/** The point named `name`, or `undefined` when the catalog has none. */
export function flowPoint(name: string): FlowPoint | undefined {
  return FLOW_POINTS.find(({ point }) => point === name);
}
