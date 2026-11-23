import { afterEach, describe, expect, it, vi } from 'vitest';

// The demo's clock (#3204): the screenshot test pins it with OMNI_LOOP_DEMO_NOW, so the demo PRD's dates
// are the same on every run; unset, the demo reads the real clock.
const env = vi.hoisted(() => ({ demoNow: null as number | null }));
vi.mock('server-only', () => ({}));
vi.mock('../env', () => ({ serverEnv: () => env }));

const { demoNow } = await import('./demo-clock');

afterEach(() => { env.demoNow = null; vi.useRealTimers(); });

describe('demoNow, the demo\'s clock', () => {
  it('is the pinned time when OMNI_LOOP_DEMO_NOW is set, whatever the real clock says', () => {
    env.demoNow = Date.UTC(2026, 10, 22, 12, 20);
    vi.useFakeTimers({ now: Date.UTC(2030, 0, 1) });
    expect(demoNow()).toBe(Date.UTC(2026, 10, 22, 12, 20));
  });

  it('is the real clock when nothing pins it', () => {
    vi.useFakeTimers({ now: Date.UTC(2030, 0, 1) });
    expect(demoNow()).toBe(Date.UTC(2030, 0, 1));
  });
});
