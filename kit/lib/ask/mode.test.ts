// Ask mode as `OMNI_ASK` switches it (PRD 1831): on with no `ask.json`, off whatever the file says,
// and the file alone when the variable is unset.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { LOCAL_DIR } from './local-state.ts';
import { askMode } from './mode.ts';

const URL_ = 'https://omni.example.com';
const config = (url: string | null) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`;

describe('askMode', () => {
  it('OMNI_ASK=on turns the mode on against ask.url with no ask.json', () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': config(URL_) } });
    expect(askMode(root, null)).toBeNull();
    expect(askMode(root, 'on')).toEqual({ host: 'omni.example.com', baseUrl: URL_ });
  });

  it('OMNI_ASK=off turns it off with an ask.json', () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': config(URL_), [`${LOCAL_DIR}/ask.json`]: JSON.stringify({ host: 'omni.example.com' }) } });
    expect(askMode(root, null)).toEqual({ host: 'omni.example.com', baseUrl: URL_ });
    expect(askMode(root, 'off')).toBeNull();
  });

  it('OMNI_ASK=on leaves the mode off when ask.url is null or the config does not read', () => {
    expect(askMode(makeRepo({ files: { '.omni-loop/config.yml': config(null) } }).root, 'on')).toBeNull();
    expect(askMode(makeRepo({ files: { '.omni-loop/config.yml': 'kit: [' } }).root, 'on')).toBeNull();
  });
});
