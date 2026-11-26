import { createElement } from 'react';
import { Writable } from 'node:stream';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP } from '../nav/settings-map';
import { SettingsHomeStreamed } from './SettingsHome.tsx';

const never = new Promise<never>(() => undefined);
type Status = Promise<Record<string, string | undefined>>;
const first = (status: Status) => renderToString(createElement(SettingsHomeStreamed, { status }));
// The page once every stream has arrived, as the browser ends up with it.
const render = (status: Status) =>
  new Promise<string>((resolve) => {
    let html = '';
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        html += chunk.toString();
        done();
      },
      final(done) {
        resolve(html);
        done();
      },
    });
    const stream = renderToPipeableStream(createElement(SettingsHomeStreamed, { status }), { onAllReady: () => void stream.pipe(sink) });
  });

describe('the settings home (omni-loop-32 s4)', () => {
  it('AC-1: shows every group and every page of the map as a card, with its description and who may change it', async () => {
    const html = await render(Promise.resolve({}));
    for (const group of SETTINGS_MAP) {
      expect(html).toContain(group.label);
      for (const page of group.pages) {
        expect(html).toContain(`href="${page.path}"`);
        expect(html).toContain(page.label);
        expect(html).toContain(page.holds.replace(/'/g, '&#x27;'));
        expect(html).toContain(page.changedBy);
      }
    }
  });

  it('AC-4: the first paint holds the cards while the status reads are still pending, busy and with no chip', () => {
    const html = first(never);
    expect(html).toContain('aria-busy="true"');
    for (const group of SETTINGS_MAP) for (const page of group.pages) expect(html).toContain(`href="${page.path}"`);
    expect(html).not.toContain('settings-home-chip');
  });

  it('AC-2: shows a chip only on the page the status names', async () => {
    const html = await render(Promise.resolve({ '/app/settings/jev': 'Jev is off' }));
    expect(html.match(/settings-home-chip/g)).toHaveLength(1);
    expect(html).toContain('Jev is off');
  });

  it('AC-4: a status read that fails leaves the cards, with no chip and no error', async () => {
    const html = await render(Promise.reject(new Error('down')));
    expect(html).not.toContain('settings-home-chip');
    expect(html).not.toContain('Couldn');
  });
});
