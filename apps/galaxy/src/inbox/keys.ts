import { propertyOf } from 'omni-loop/kit/lib/narrow.ts';
import type { InboxRow } from './inbox';
import { hrefOf } from './InboxScreen.model';

// The Inbox list's keys (PRD omni-loop-22, s5), as pure functions. On the list, off while a text field
// has the focus: j or ↓ moves down, k or ↑ moves up, o opens the item's own page, e clears an Update and,
// on any other row, says "Answer it to clear it" and clears nothing. ↵ is the focused row's own: each row
// is a link, so ↵ opens it as a click does. ⌘↵ (or Ctrl+↵) sends the open question, from its Other field
// too. The answer form keeps its own keys (1 to 4 pick, ↵ sends: src/ask/answer-model.ts), and no single
// key press sends an answer.

export type ListIntent = { kind: 'move'; by: 1 | -1 } | { kind: 'page' } | { kind: 'clear' } | { kind: 'send' } | null;

type Press = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; isComposing?: boolean };

/** What the Inbox says when `e` is pressed on a wait. */
export const CLEAR_REFUSED = 'Answer it to clear it';

/** Whether the focus sits in a text field, where the list's keys are off. */
export const isTyping = (el: Element | null): boolean =>
  !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && ['text', 'search', 'email', 'url'].includes(String(propertyOf(el, 'type')))) || propertyOf(el, 'isContentEditable') === true);

const MOVES: Readonly<Record<string, 1 | -1>> = { j: 1, ArrowDown: 1, k: -1, ArrowUp: -1 };
const ARROWS = new Set(['ArrowDown', 'ArrowUp']);

/** Whether the focused element moves with the arrow keys itself (an option, the kind chips, a select):
 * the list leaves them their arrows, as a page-wide key never takes over a focused control (P-PRODUCT-42). */
export const ownsArrows = (el: Element | null): boolean =>
  !!el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.closest('[role="group"], [role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"]') !== null);

/** What a key press means on the list; null leaves it to the page and the answer form. */
export function listKey(press: Press, typing: boolean, arrowsOwned = false): ListIntent {
  if (press.isComposing) return null;
  if (press.key === 'Enter') return (press.metaKey || press.ctrlKey) && !press.shiftKey && !press.altKey ? { kind: 'send' } : null;
  if (typing || press.metaKey || press.ctrlKey || press.altKey) return null;
  if (arrowsOwned && ARROWS.has(press.key)) return null;
  const by = MOVES[press.key];
  if (by !== undefined) return { kind: 'move', by };
  if (press.key === 'o') return { kind: 'page' };
  if (press.key === 'e') return { kind: 'clear' };
  return null;
}

/** Whether a key press asks for the details of the Done row in focus (or under the pointer): a bare `i`,
 * off while a text field has the focus (PRD omni-loop-23, s6). */
export function detailsKey(press: Press, typing: boolean): boolean {
  if (press.isComposing || typing || press.metaKey || press.ctrlKey || press.altKey || press.shiftKey) return false;
  return press.key === 'i';
}

/** The row the focus moves to: one step from `at`, held at either end; the first row when `at` is not listed. */
export function moveFrom(keys: readonly string[], at: string | null, by: 1 | -1): string | null {
  const i = at === null ? -1 : keys.indexOf(at);
  if (i < 0) return keys[0] ?? null;
  return keys[Math.min(keys.length - 1, Math.max(0, i + by))] ?? null;
}

/** What a list key does: move the focus, open the row's own page (GitHub in a new tab), refuse to
 * clear a wait, or clear an update. */
export type KeyAction =
  | { kind: 'focus'; key: string | null }
  | { kind: 'page'; href: string; external: boolean }
  | { kind: 'refuse'; words: string }
  | { kind: 'clear'; row: Extract<InboxRow, { kind: 'update' }> }
  | null;

/** The action of a list key on the rows drawn; it acts on the row in focus, else on the open one. */
export function actionOf(intent: ListIntent, rows: readonly InboxRow[], focus: string | null, open: string | null): KeyAction {
  if (!intent || intent.kind === 'send') return null;
  const keys = rows.map((r) => r.key);
  const at = focus !== null && keys.includes(focus) ? focus : open;
  if (intent.kind === 'move') return { kind: 'focus', key: moveFrom(keys, at, intent.by) };
  const row = rows.find((r) => r.key === at);
  if (!row) return null;
  if (intent.kind === 'page') return { kind: 'page', href: hrefOf(row), external: row.kind === 'review' };
  // `e`: an update goes to Done; a wait stays until it is answered.
  if (row.kind === 'update') return { kind: 'clear', row };
  return { kind: 'refuse', words: CLEAR_REFUSED };
}
