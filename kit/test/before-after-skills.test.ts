// PRD 2239, s4: the brainstorms write the before/after page through `omni before-after`, in three tabs (PRD 2850, s4: whole numbered screens, and the first look).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PLUGIN_DIR = 'kit/plugin';

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

describe('the before/after page in the brainstorm skills', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const stepFive = () => skillSection(read('brainstorm'), '5.');

  it('/omni:brainstorm step 5 runs new, then render, then the word pass, in the three tabs and three states', () => {
    const step = stepFive();
    const order = ['before-after new <n> --services', 'before-after render <n>', 'design words'].map((m) => step.indexOf(m));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const phrase of ['**Three tabs,**', '**Technical**', '`filled`', '`na`', '`gap`', 'breaking', 'diagram not rendered', '<details>']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('keeps the pixel-perfect rules and never names the skeleton path', () => {
    const step = stepFive();
    for (const phrase of ['The Pixel perfect section', 'The design memory', 'The marks and the word pass', 'The draft screens']) {
      expect(step, phrase).toContain(phrase);
    }
    for (const skill of ['brainstorm', 'mega-brainstorm']) expect(read(skill), skill).not.toContain('templates/before-after');
  });

  it('step 5 says the three tabs, the whole screens, the marks and the references that are never renumbered', () => {
    const step = flat(stepFive());
    for (const phrase of ['content="3"', 'the third tab', 'one section for the whole page', 'whole', 'at its real width', 'shared screens', '`data-ref`', '`data-when`', '`data-viewport`', '`<template>`', 'never renumbered', 'next free letter', 'never write a frame, a caption, a scale or an index', '`@font-face` inside a screen']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('step 5 says the first look after the grader and before the commit, with its three conditions and its skip', () => {
    const step = flat(stepFive());
    const order = ['`omni check inbox`, which grades', '**The first look.**', 'step 7'].map((m) => step.indexOf(m));
    expect(order.every((at) => at >= 0)).toBe(true);
    for (const phrase of ['publishes a page privately to its person and hands back a link (in Claude:', '`OMNI_UNATTENDED` is not set', 'the page passed `omni check inbox`', 'saying nothing', '**Iterate**', '**Carry on**', 'read the page back from the host', 'once more', 'write its link in no file']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('no skill forbids the claude.ai artifact any more, and none stores the private link', () => {
    for (const skill of ['brainstorm', 'mega-brainstorm']) {
      expect(flat(read(skill)), skill).not.toContain('Never publish it as a claude.ai');
      expect(flat(read(skill)), skill).toContain('copy others read');
    }
    expect(flat(stepFive())).not.toMatch(/store the (private )?link|save the (private )?link/i);
  });

  it('Rework writes the page the same way and keeps the old shape of a page without the meta', () => {
    const rework = flat(skillSection(read('brainstorm'), 'Rework'));
    expect(rework).toContain('before-after new <n> --force');
    expect(rework).toContain('omni-before-after');
    expect(rework).toContain('version 2');
    expect(rework).toContain('unless the person asks for the new one');
    expect(rework).toContain('**The first look**');
    expect(rework).toContain('never renumbered');
  });

  it("/omni:mega-brainstorm step 6 makes each repository a service, in the plan's build order", () => {
    const step = flat(skillSection(read('mega-brainstorm'), '6.'));
    expect(step).toContain('before-after new <n> --services');
    expect(step).toContain('one **service**');
    expect(step).toContain('order the plan builds them');
    expect(step).toContain('three tabs');
    expect(step).toContain('grouped by repository');
    expect(step).toContain('the numbers running across the page');
    expect(step).toContain('**The first look**');
    expect(step).toContain('`OMNI_UNATTENDED`');
    expect(step).toContain('the link stored nowhere');
  });

  it('/omni:do-work and /omni:pr find the screens line in either shape', () => {
    const review = flat(read('do-work'));
    expect(review).toContain('its Pixel perfect tab, or, on a page of the older two-tab shape, its Pixel perfect section');
    const pr = flat(read('pr'));
    expect(pr).toContain('in its Pixel perfect tab');
    expect(pr).toContain('older two-tab shape');
  });
});
