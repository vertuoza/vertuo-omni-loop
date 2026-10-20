// The omni-hud mod's state contract: what its band draws from, held by the host for the session.

/** A link of what the session is on. */
export type HudLink = { label: string; href: string };

/** A slice being built, or stuck. */
export type HudSlice = { id: string; name: string | null; state: string };

/** What the session works on: a PRD, a bug fix or a visual fix. */
export type HudWork = { kind: string; number: number; topic: string; stage: string | null; slices: HudSlice[]; links: HudLink[] };

/** The loop, or the roadmap it drives, above the work. */
export type HudHeadline = { kind: string; number?: number; progress?: string; links: HudLink[] };

/** The approval wait's line (PRD 1322's s5), a toast until `until` (milliseconds since the epoch) when `toast`. */
export type HudWait = { line: string; toast: boolean; until: number | null };

/** What `omni sync` last kept (PRD 1990); `setupDone`, the newcomer's steps done, only while `blue`. */
export type HudSync = { status: 'blue' | 'red' | 'orange' | 'green'; headline: string | null; checkedAt: string; setupDone?: number };

/** The runner slots free while a runner is online for this repository (PRD 2251). */
export type HudRunners = { free: number; slots: number };

/** The last milestone of the followed runner job (PRD 2251). */
export type HudRunner = { line: string };

/** `omni now --json`'s answer, as the band reads it; `wait` only while an approval wait shows something, `sync` once `omni sync` has run. */
export type HudNow = { headline: HudHeadline | null; work: HudWork | null; doing: string | null; wait: HudWait | null; sync: HudSync | null; runners: HudRunners | null; runner: HudRunner | null };

declare module 'claude-code' {
  interface PluginState {
    'omni-hud': { now: HudNow | null; isOff: boolean };
  }
}
