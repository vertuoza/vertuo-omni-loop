import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HERO_ROLES, roleOf } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { HeroesTab } from './HeroesTab';
import type { HeroesView } from './heroes';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The Heroes tab as drawn (PRD 2873 s3, the `fleet-seats` screen): each hero lists every skill of its role, each
// marked `runs alone` or `needs a person`, the ones that run alone first, under its count line.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const EVERY_ROLE: HeroesView = {
  workspace: '11111111-1111-4111-8111-111111111111', fleet: 'night-shift', color: '#4fb0ff', canEdit: false,
  heroes: HERO_ROLES.map((role, position) => {
    const d = roleOf(role);
    return { id: `22222222-2222-4222-8222-22222222220${String(position)}`, fleet: 'night-shift', name: d.name, role, skills: [...d.skills], agent: d.agent, model: d.model, limits: [...d.limits], position };
  }),
};
const render = (view: HeroesView) => renderToStaticMarkup(createElement(HeroesTab, { view }));

describe('the Heroes tab, every skill of each role', () => {
  it('shows each hero\'s count line, then its skills with their marks, those that run alone first', () => {
    const t = text(render(EVERY_ROLE));
    expect(t).toContain('Engineer · Engineer · agent Runs 11 of 14 skills alone /omni:yolo runs alone');
    expect(t).toContain('/omni:ultra-wave runs alone /omni:repair runs alone /omni:mega-pr-care needs a person /omni:drive needs a person /omni:mega-drive needs a person claude · sonnet');
    expect(t).toContain('QA · QA · agent Runs 3 of 4 skills alone /omni:qa runs alone /omni:prove runs alone /omni:bug-fix runs alone /omni:validate-e2e needs a person');
    expect(t).toContain('Reviewer · Reviewer · agent Runs 1 of 2 skills alone /omni:review runs alone /omni:tech-review needs a person claude · opus');
    expect(t).toContain('PM · PM · agent Runs 6 of 7 skills alone /omni:pitch runs alone /omni:plan runs alone /omni:brainstorm runs alone /omni:roadmap runs alone /omni:mega-brainstorm runs alone /omni:mega-roadmap runs alone /omni:mission needs a person');
    expect(t).toContain('Architect · Architect · agent Runs 1 of 2 skills alone /omni:plan runs alone /omni:tech-review needs a person');
    expect(t).toContain('Designer · Designer · agent Runs 1 of 3 skills alone /omni:visual-fix runs alone /omni:pixel-perfect needs a person /omni:think-big needs a person');
    expect(t).toContain('It never locks a screen: a person does.');
  });

  it('says what QA does and never does: three of its four skills alone, and its four limits (PRD 3001, AC-10)', () => {
    const t = text(render(EVERY_ROLE));
    expect(t).toContain('QA · QA · agent Runs 3 of 4 skills alone');
    expect(t).toContain('It never writes the branch. It reports bugs to the Engineer. It reports five bugs at most. It checks two rounds at most.');
    expect(t).not.toContain('It reports what it saw; a person decides.');
  });

  it('marks each skill for the eye too, and says no third thing', () => {
    const html = render(EVERY_ROLE);
    const marks = [...html.matchAll(/data-mark="([a-z]+)"/g)].map((m) => m[1]);
    expect(new Set(marks)).toEqual(new Set(['alone', 'person']));
    expect(marks).toHaveLength(EVERY_ROLE.heroes.reduce((n, h) => n + h.skills.length, 0));
    expect(text(html)).not.toMatch(/Works alone|not yet/);
  });

  it('draws the Designer with a look of its own', () => {
    const sprites = [...render(EVERY_ROLE).matchAll(/<span class="hero-sprite"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => m[1]);
    expect(sprites).toHaveLength(6);
    expect(new Set(sprites).size).toBe(6);
  });
});
