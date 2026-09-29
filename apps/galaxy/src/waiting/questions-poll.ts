import type { VisibilityDoc } from '../ask/page/poll';
import { HIDDEN_WAITING_MS, WAITING_MS } from './waiting';

// Calmer polling (PRD 657, s10): the waiting provider reads the Questions part every `every` ms while
// the tab is visible and every `hiddenEvery` ms while it is hidden, so a question still reaches a
// hidden tab's title and alerts, only less often. When the tab shows again it reads at once. A read
// never overlaps the one before it; a read that throws keeps the polling going, and one that resolves
// false ends it.

/** Starts polling with `tick`, which resolves true to keep going. Returns the stop function. */
export function pollQuestions(
  tick: () => Promise<boolean>, doc: VisibilityDoc, every = WAITING_MS, hiddenEvery = HIDDEN_WAITING_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;
  const pace = () => (doc.visibilityState === 'visible' ? every : hiddenEvery);
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(() => void run(), pace());
  };
  const run = async () => {
    if (running || stopped) return;
    running = true;
    const more = await tick().catch(() => true);
    running = false;
    if (more) schedule();
    else stop();
  };
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible' || running) return;
    clearTimeout(timer);
    void run();
  };
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
  doc.addEventListener('visibilitychange', onVisibility);
  schedule();
  return stop;
}
