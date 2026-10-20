// PRD 2239, s2: the skeleton of a before/after page of the two-tab shape (spec §2). The page's head,
// styles and tabs are the kit's template (`kit/templates/before-after/page.html`); this fills in the
// PRD's number and, for each named service, its block in each tab with every section a
// `<!-- FILL -->` for the agent to replace. Pure: it reads the template's text it is handed, never
// the disk.

import type { PrdNumber } from '../ids.ts';

/** The template's marks, each replaced once. */
const MARKS = { prd: '{{prd}}', functional: '{{functional}}', technical: '{{technical}}' } as const;

/** A service name: a word the page can carry in an attribute and a heading unescaped. */
const SERVICE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The sections of a service in the Functional & design tab: their `data-section` and heading. */
const FUNCTIONAL_SECTIONS = [
  ['functional', 'Functional'],
  ['pixel-perfect', 'Pixel perfect'],
] as const;

/** The sections of a service in the Technical tab: their `data-section` and heading. */
const TECHNICAL_SECTIONS = [
  ['db', 'Database'],
  ['api', 'API / schema'],
  ['behaviour', 'Behaviour'],
] as const;

/** The services `--services` names, in order, or the one line that refuses the list. */
export function parseServices(value: string | undefined): { services: string[] } | { refusal: string } {
  const services = (value ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  if (services.length === 0) return { refusal: '--services needs at least one service, as --services kit,app.' };
  const bad = services.find((name) => !SERVICE_NAME.test(name));
  if (bad !== undefined) return { refusal: `"${bad}" is not a service name: use letters, digits, ".", "_" and "-".` };
  const twice = services.find((name, index) => services.indexOf(name) !== index);
  if (twice !== undefined) return { refusal: `the service "${twice}" is named twice.` };
  return { services };
}

const sectionOf = ([name, title]: readonly [string, string]): string =>
  `<div data-section="${name}" data-state="gap">\n<h4>${title}</h4>\n<!-- FILL -->\n</div>`;

/** One service's block in a tab: its heading, then its sections. */
const blockOf = (service: string, heading: string, sections: readonly (readonly [string, string])[]): string =>
  `<div data-service="${service}">\n<h3>${heading}</h3>\n${sections.map(sectionOf).join('\n')}\n</div>`;

/** The page's text for PRD `prd` and the named `services`, from the kit's `template`. */
export function beforeAfterSkeleton({ template, prd, services }: { template: string; prd: PrdNumber; services: readonly string[] }): string {
  const functional = services.map((service) => blockOf(service, service, FUNCTIONAL_SECTIONS)).join('\n');
  const technical = services
    .map((service) => blockOf(service, `${service} <span class="badge" data-role><!-- FILL --></span>`, TECHNICAL_SECTIONS))
    .join('\n');
  return template
    .replaceAll(MARKS.prd, String(prd))
    .replace(MARKS.functional, () => functional)
    .replace(MARKS.technical, () => technical);
}
