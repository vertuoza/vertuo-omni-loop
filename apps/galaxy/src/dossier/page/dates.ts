// The page's dates, in UTC so the server and any browser read them alike: `27 Sep` and
// `27 Sep 2026, 09:12 UTC`. view.ts re-exports them; ./proof.ts reads them here, not through view.ts.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const pad = (n: number) => String(n).padStart(2, '0');

/** `27 Sep`, in UTC: the same on the server and in any browser. */
export function shortDay(iso: string): string {
  const at = new Date(iso);
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/** `27 Sep 2026, 09:12 UTC`. */
export function stamp(iso: string): string {
  const at = new Date(iso);
  return `${shortDay(iso)} ${at.getUTCFullYear()}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}
