import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { deliveryFetched } from './delivery-scope.ts';

const config = parseConfig('kit: 1\nrepo:\n  defaultBranch: main\nlaws:\n  source: knowledge\n', '.omni-loop/config.yml');
const pr = (headRef: string) => ({ baseRef: 'main', headRef });

describe('deliveryFetched — the pull request\'s own folder alone (issue 1968)', () => {
  it('a feature PR fetches the folders named after its topic, in every area, and no other PRD\'s', () => {
    const fetched = deliveryFetched(config, pr('feat/widget'));
    expect(fetched('.omni-loop/delivery/inbox/0042-widget/spec.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/outbox/0042-widget/accounts/s1.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/shipped/0042-widget/outbox/settled.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/shipped/0007-gadget/spec.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/shipped/0042-widget-two/spec.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/bugs/0042-widget-crash/bug.md')).toBe(false);
  });

  it('a fix PR fetches the folder of its issue, and no other', () => {
    const fetched = deliveryFetched(config, pr('fix/77-crash'));
    expect(fetched('.omni-loop/delivery/bugs/0077-crash/bug.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/visual/0077-crash/visual.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/bugs/0078-other/bug.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/bugs/00770-crash/bug.md')).toBe(false);
    expect(fetched('.omni-loop/delivery/shipped/0077-crash/spec.md')).toBe(true);
  });

  it('a fix PR whose topic names no issue fetches no folder', () => {
    const fetched = deliveryFetched(config, pr('fix/crash'));
    expect(fetched('.omni-loop/delivery/bugs/0077-crash/bug.md')).toBe(false);
    expect(deliveryFetched(config, pr('fix/0-crash'))('.omni-loop/delivery/bugs/0000-crash/bug.md')).toBe(false);
  });

  it('always fetches what sits outside the delivery folder, and the files beside its areas\' folders', () => {
    const fetched = deliveryFetched(config, pr('feat/widget'));
    expect(fetched('.omni-loop/knowledge/product/rules.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/README.md')).toBe(true);
    expect(fetched('.omni-loop/delivery/inbox/README.md')).toBe(true);
  });

  it('a knowledge PR or an enforce PR fetches no delivery folder: its check reads the knowledge alone (issue 2210)', () => {
    for (const headRef of ['docs/knowledge-widget', 'test/law-BR-1']) {
      const fetched = deliveryFetched(config, pr(headRef));
      expect(fetched('.omni-loop/delivery/shipped/0007-gadget/spec.md')).toBe(false);
      expect(fetched('.omni-loop/delivery/shipped/0042-widget/outbox/settled.md')).toBe(false);
      expect(fetched('.omni-loop/delivery/README.md')).toBe(true);
      expect(fetched('.omni-loop/knowledge/product/rules.md')).toBe(true);
    }
  });

  it('fetches everything for a pull request the check does not gate', () => {
    expect(deliveryFetched(config, pr('chore/tidy'))('.omni-loop/delivery/shipped/0007-gadget/spec.md')).toBe(true);
    expect(deliveryFetched(config, { baseRef: 'develop', headRef: 'feat/widget' })('.omni-loop/delivery/shipped/0007-gadget/spec.md')).toBe(true);
  });
});
