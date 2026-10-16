// The limit the player chose, kept in the browser. Pure: the browser's storage is handed in.
import type { Action } from '../keys';
import { DEFAULT_LIMIT, LIMIT_NAMES, LIMITS, type LimitName } from './rules';

export interface PongOptions { limit: LimitName }

export const OPTIONS_KEY = 'omni-loop:pong-options';

export const defaultOptions = (): PongOptions => ({ limit: DEFAULT_LIMIT });

export const limitHz = (options: PongOptions): number => LIMITS[options.limit];

const isLimit = (raw: unknown): raw is LimitName => typeof raw === 'string' && (LIMIT_NAMES as readonly string[]).includes(raw);

export function parseOptions(text: string | null | undefined): PongOptions {
  if (typeof text !== 'string') return defaultOptions();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return defaultOptions(); }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaultOptions();
  const limit: unknown = (raw as Record<string, unknown>).limit;
  return isLimit(limit) ? { limit } : defaultOptions();
}

/** The slice of the browser's storage the options need. */
export interface OptionsStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

const browserStore = (): OptionsStore => window.localStorage;

export function loadOptions(store: () => OptionsStore = browserStore): PongOptions {
  try { return parseOptions(store().getItem(OPTIONS_KEY)); } catch { return defaultOptions(); }
}

/** A store that refuses leaves the choice for this visit only. */
export function saveOptions(options: PongOptions, store: () => OptionsStore = browserStore): void {
  try { store().setItem(OPTIONS_KEY, JSON.stringify(options)); } catch { /* per-device courtesy only */ }
}

/** ◀ ▶ step the limit through LOW, MID and HIGH, and stop at the ends; any other press leaves it. */
export function optionsPress(options: PongOptions, action: Action): PongOptions {
  const by = action === 'left' ? -1 : action === 'right' ? 1 : 0;
  if (by === 0) return options;
  const at = LIMIT_NAMES.indexOf(options.limit);
  const next = LIMIT_NAMES[Math.min(LIMIT_NAMES.length - 1, Math.max(0, at + by))] ?? options.limit;
  return next === options.limit ? options : { limit: next };
}
