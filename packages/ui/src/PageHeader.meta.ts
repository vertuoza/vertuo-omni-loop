import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PAGE_HEADER_LEVELS = ['1', '2'] as const;

export const pageHeaderMeta = {
  name: 'PageHeader',
  variants: { level: PAGE_HEADER_LEVELS },
  usage: 'The head of a page or of a major section: an eyebrow, one 32 px title, a one-sentence subtitle, at most five facts, the one primary action, and the rare actions in a menu.',
  do: [
    'Say the state once: in the status slot, or in the stage track under the head, never in both.',
    'Write the subtitle as one sentence; on an item that waits on someone, the next step, naming who acts.',
    'Keep the meta row to at most five short facts that need no label; the rest go to the side facts.',
    'Put the view\'s one primary action in the action slot, only when the viewer is the one who acts, its label the verb of the subtitle.',
    'Put Delete draft and the like in the Actions menu: actions only, never sections.',
  ],
  dont: [
    'Use two page headers at level 1 on one page.',
    'Fill the subtitle with what the page says below, or repeat the stage in the meta row.',
    'Draw the title smaller, or inside a card.',
    'Pass a sixth fact: the props type refuses it and the part drops it.',
  ],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('text-tertiary')] },
  accessibility: [
    'A header element holding the page title as a heading: `level` 1 for a page, 2 for a section.',
    'The action slot follows the title in source order: the Actions menu, the secondary actions, then the primary.',
    'The meta row is a list of facts, each readable on its own with no label.',
    'The Actions menu is a Menu: Base UI gives it its keyboard, focus and dismissal.',
  ],
  replaces: ['dossier-head', 'dossier-head-top', 'dossier-history-head', 'dossier-facts'],
  example: '<PageHeader title="Checkout rewrite" eyebrow="PRD 12" lede="Pierre approves the spec and plan." meta={[\'Opened by Pierre, 17 Nov\', \'2 agent decisions adopted\']} actions={[{ id: \'delete\', label: \'Delete draft\', tone: \'danger\' }]} action={<Button variant="primary">Review and approve</Button>} />',
} satisfies ComponentMeta;
