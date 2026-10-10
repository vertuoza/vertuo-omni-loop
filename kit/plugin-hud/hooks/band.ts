// What the band draws, from `omni now --json`'s answer (PRD 1208's spec, "The band"): pure.
//
// - **The answer** is read only when it parses and has the shape `omni now` prints; anything else
//   is no answer, and the band hides.
// - **At most four rows.** The headline (`roadmap 7 · 3/7 merged · roadmap page`), only with one;
//   the work (`PRD 315 help-and-status · building · now: s3 tabs, s4 board`), with `doing` in place
//   of the "now" part while a loop runs; the approval wait's line, below; the work's links, only
//   with some.
// - **The approval wait** (PRD 1322's spec, §6): while `omni wait approval` runs, its line, the
//   `wait` row, after the work and before its links; the approved or voided line is the `toast` row,
//   drawn highlighted, until the answer says it is over.
// - **Nothing** while the session is on nothing: no headline, no work and no wait.
import type { HudHeadline, HudLink, HudNow, HudSlice, HudWait, HudWork } from '../types/index.d.ts'

/** One piece of a row: plain text, or a link. */
export type BandPart = { text: string } | HudLink

/** One row of the band: its pieces, drawn with ` · ` between them; highlighted when `toast`. */
export type BandRow = { key: string; parts: BandPart[]; toast?: boolean }

const IN_FLIGHT = ['in-flight', 'claimed-stale']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function asLinks(value: unknown): HudLink[] | null {
  if (!Array.isArray(value)) return null
  const links: HudLink[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.label !== 'string' || typeof item.href !== 'string') return null
    links.push({ label: item.label, href: item.href })
  }
  return links
}

function asSlices(value: unknown): HudSlice[] | null {
  if (!Array.isArray(value)) return null
  const slices: HudSlice[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.state !== 'string') return null
    const name = typeof item.name === 'string' ? item.name : null
    slices.push({ id: item.id, name, state: item.state })
  }
  return slices
}

function asWork(value: unknown): HudWork | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const { kind, number, topic, stage } = value
  const slices = asSlices(value.slices ?? [])
  const links = asLinks(value.links ?? [])
  if (typeof kind !== 'string' || typeof number !== 'number' || typeof topic !== 'string') return undefined
  if (stage !== null && stage !== undefined && typeof stage !== 'string') return undefined
  if (!slices || !links) return undefined
  return { kind, number, topic, stage: stage ?? null, slices, links }
}

function asHeadline(value: unknown): HudHeadline | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined
  const links = asLinks(value.links ?? [])
  if (!links) return undefined
  const headline: HudHeadline = { kind: value.kind, links }
  if (typeof value.number === 'number') headline.number = value.number
  if (typeof value.progress === 'string') headline.progress = value.progress
  return headline
}

function asWait(value: unknown): HudWait | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const { line, toast, until } = value
  if (typeof line !== 'string' || typeof toast !== 'boolean') return undefined
  if (until !== null && typeof until !== 'number') return undefined
  return { line, toast, until }
}

/** `omni now --json`'s stdout as an answer, or `null` when it does not parse or has another shape. */
export function parseNow(stdout: string): HudNow | null {
  let data: unknown
  try {
    data = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!isRecord(data)) return null
  const headline = asHeadline(data.headline ?? null)
  const work = asWork(data.work ?? null)
  const doing = data.doing ?? null
  const wait = asWait(data.wait ?? null)
  if (headline === undefined || work === undefined || wait === undefined) return null
  if (doing !== null && typeof doing !== 'string') return null
  return { headline, work, doing, wait }
}

const slug = (kind: string, number: number): string =>
  kind === 'prd' ? `PRD ${number}` : kind === 'bug' || kind === 'visual' ? `${kind} #${number}` : `${kind} ${number}`

const sliceLabel = ({ id, name }: HudSlice): string => (name ? `${id} ${name}` : id)

function headlineRow(headline: HudHeadline): BandRow {
  const title = headline.number === undefined ? headline.kind : `${headline.kind} ${headline.number}`
  const parts: BandPart[] = [{ text: title }]
  if (headline.progress) parts.push({ text: headline.progress })
  return { key: 'headline', parts: [...parts, ...headline.links] }
}

function workRow(now: HudNow): BandRow | null {
  const { work, headline, doing } = now
  if (!work) return doing ? { key: 'work', parts: [{ text: doing }] } : null
  const parts: BandPart[] = [{ text: `${slug(work.kind, work.number)} ${work.topic}` }]
  if (work.stage) parts.push({ text: work.stage })
  const building = work.slices.filter((slice) => IN_FLIGHT.includes(slice.state))
  if (headline && doing) parts.push({ text: doing })
  else if (building.length > 0) parts.push({ text: `now: ${building.map(sliceLabel).join(', ')}` })
  return { key: 'work', parts }
}

const waitRow = ({ line, toast }: HudWait): BandRow =>
  toast ? { key: 'toast', parts: [{ text: line }], toast: true } : { key: 'wait', parts: [{ text: line }] }

/** The band's rows for an answer: none while the session is on nothing. */
export function bandRows(now: HudNow | null): BandRow[] {
  if (!now || (!now.work && !now.headline && !now.wait)) return []
  const rows: BandRow[] = []
  if (now.headline) rows.push(headlineRow(now.headline))
  const work = workRow(now)
  if (work) rows.push(work)
  if (now.wait) rows.push(waitRow(now.wait))
  if (now.work && now.work.links.length > 0) rows.push({ key: 'links', parts: now.work.links })
  return rows
}

/** How often the band asks `omni now` while a wait waits. */
const WAITING_EVERY_MS = 5_000

/**
 * When the band asks `omni now` again for the wait in `now`, in milliseconds from `at`: when the
 * toast ends, every 5 seconds while it waits so the approval shows within seconds, else `null`.
 */
export function waitAgainIn(now: HudNow | null, at: number): number | null {
  const wait = now?.wait
  if (!wait) return null
  if (wait.toast && wait.until !== null) return Math.max(0, wait.until - at)
  return WAITING_EVERY_MS
}

