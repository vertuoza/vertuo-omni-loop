// The omni-hud mod's state contract: what its band draws from, held by the host for the session.

/** A link of what the session is on. */
export type HudLink = { label: string; href: string };

/** A slice being built, or stuck. */
export type HudSlice = { id: string; name: string | null; state: string };

/** What the session works on: a PRD, a bug fix or a visual fix. */
export type HudWork = { kind: string; number: number; topic: string; stage: string | null; slices: HudSlice[]; links: HudLink[] };

/** The loop, or the roadmap it drives, above the work. */
export type HudHeadline = { kind: string; number?: number; progress?: string; links: HudLink[] };

/** `omni now --json`'s answer, as the band reads it. */
export type HudNow = { headline: HudHeadline | null; work: HudWork | null; doing: string | null };

declare module 'claude-code' {
  interface PluginState {
    'omni-hud': { now: HudNow | null; isOff: boolean };
  }
}
