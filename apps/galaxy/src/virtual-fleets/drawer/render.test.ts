import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MASCOTS } from '@omni/design';
import { newFleetReducer, openedWith, type NewFleetState } from './new-fleet';
import { NewFleetView, NewVirtualFleet } from './NewVirtualFleet';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The New virtual fleet drawer as drawn (PRD 2842 s1, the `fleet-new` screen): its title, then Name, Icon
// and Heroes in that order, the five switches all on, the foot with Cancel and Create fleet, and each
// state the screen names.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const view = (state: NewFleetState) => renderToStaticMarkup(createElement(NewFleetView, { state, mascots: MASCOTS }));
const opened = () => openedWith(MASCOTS);

describe('the New virtual fleet drawer', () => {
  it('draws Name, Icon and Heroes in order, under its title, as a dialog of the fleet-new screen', () => {
    const html = view(opened());
    expect(html).toContain('data-screen="fleet-new"');
    expect(html).toMatch(/role="dialog" aria-modal="true"/);
    const t = text(html);
    expect(t.indexOf('New virtual fleet')).toBeLessThan(t.indexOf('Name'));
    expect(t.indexOf('Name')).toBeLessThan(t.indexOf('Icon'));
    expect(t.indexOf('Icon')).toBeLessThan(t.indexOf('Heroes'));
    expect(t).toMatch(/Cancel Create fleet$/);
    expect(html).toContain('placeholder="Night Shift"');
    expect(html).toContain('maxLength="12"');
  });

  it('offers every fleet mascot as an icon, the first selected', () => {
    const html = view(opened());
    const icons = [...html.matchAll(/<input type="radio"[^>]*value="([^"]+)"[^>]*>/g)];
    expect(icons.map((m) => m[1])).toEqual([...MASCOTS]);
    expect(icons.filter((m) => m[0].includes('checked')).map((m) => m[1])).toEqual([MASCOTS[0]]);
  });

  it('draws the five roles as switches, all on, each saying whether it works alone today', () => {
    const t = text(view(opened()));
    expect(t).toContain('Engineer Builds PRDs alone QA Proves the work alone Reviewer A person does this today PM A person does this today Architect A person does this today');
    const switches = [...view(opened()).matchAll(/role="switch"[^>]*aria-checked="(true|false)"/g)].map((m) => m[1]);
    expect(switches).toEqual(['true', 'true', 'true', 'true', 'true']);
  });

  it('disables Create fleet with no name, or with every switch off', () => {
    const disabled = (html: string) => /<button type="submit"[^>]*disabled=""/.test(html);
    expect(disabled(view(opened()))).toBe(true);
    let state = newFleetReducer(opened(), { type: 'name', value: 'Night Shift' });
    expect(disabled(view(state))).toBe(false);
    for (const role of state.roles) state = newFleetReducer(state, { type: 'toggle', role });
    expect(disabled(view(state))).toBe(true);
    expect([...view(state).matchAll(/aria-checked="(true|false)"/g)].map((m) => m[1])).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('shows `Name taken: choose another` under the Name field, tied to it', () => {
    const state = newFleetReducer(newFleetReducer(opened(), { type: 'name', value: 'Beaver' }), { type: 'refused', field: 'name', message: 'Name taken: choose another' });
    const html = view(state);
    const describedBy = /aria-invalid="true" aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(describedBy).toBeDefined();
    expect(html).toContain(`<p class="vf-error" id="${describedBy ?? ''}" role="alert">Name taken: choose another</p>`);
    expect(text(html).indexOf('Name taken: choose another')).toBeLessThan(text(html).indexOf('Icon'));
  });

  it('says a refusal of the whole form in its foot, and Creating… while the call is on its way', () => {
    const busy = newFleetReducer(newFleetReducer(opened(), { type: 'name', value: 'Owls' }), { type: 'busy' });
    expect(text(view(busy))).toMatch(/Cancel Creating…$/);
    const refused = newFleetReducer(busy, { type: 'refused', field: 'form', message: 'Fleets: at most 12 active. Retire one first.' });
    expect(text(view(refused))).toMatch(/Fleets: at most 12 active\. Retire one first\. Cancel Create fleet$/);
  });

  it('is closed until its button is pressed, the button the page\'s main one when asked', () => {
    const quiet = renderToStaticMarkup(createElement(NewVirtualFleet, { workspace: null, mascots: MASCOTS }));
    expect(quiet).toBe('<button type="button" class="ask-button quiet vf-open">+ New virtual fleet</button>');
    const primary = renderToStaticMarkup(createElement(NewVirtualFleet, { workspace: null, mascots: MASCOTS, primary: true }));
    expect(primary).toBe('<button type="button" class="ask-button vf-open" data-primary="">+ New virtual fleet</button>');
  });
});
