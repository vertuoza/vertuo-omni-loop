// Issue 2400: which files of the delivery folder a harvest fetches. Its own PRD's folders, in every
// area; every other folder is listed, never fetched.
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { harvestFetched } from './github.ts';

const fetched = harvestFetched('.omni-loop/delivery/', parsePrd(42));

describe('harvestFetched (issue 2400)', () => {
  it('fetches the PRD’s own folders, in the inbox, the outbox and the shipped folder', () => {
    expect(fetched('.omni-loop/delivery/inbox/0042-widgets/spec.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/outbox/0042-widgets/settled.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/shipped/0042-widgets/outbox/settled.md')).toBe(true);
  });

  it('never fetches another PRD’s folder, a concept or a bug fix', () => {
    expect(fetched('.omni-loop/delivery/shipped/0007-old-history/before-after.html')).toBe(false);
    expect(fetched('.omni-loop/delivery/shipped/0420-other/spec.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/inbox/concepts/0042-widgets/concept.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/bugs/0043-widgets/bug.md')).toBe(false);
  });

  it('fetches everything outside the delivery folder, and a file directly under an area', () => {
    expect(fetched('.omni-loop/config.yml')).toBe(true);
    expect(fetched('.omni-loop/knowledge/product/rules.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/shipped/README.md')).toBe(true);
  });
});
