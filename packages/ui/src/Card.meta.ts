import type { ComponentMeta } from './meta.ts';

export const CARD_SURFACES = ['surface', 'raised', 'sunken'] as const;
export const CARD_PADDINGS = ['3', '4', '5'] as const;

export const cardMeta = {
  name: 'Card',
  variants: { surface: CARD_SURFACES, padding: CARD_PADDINGS },
  accessibility: ['A plain div with no role: a card that needs a name is a section the page labels itself.'],
  replaces: ['dossier-seal-card', 'outbox-card'],
  example: '<Card surface="raised"><Text>What the PRD changes.</Text></Card>',
} satisfies ComponentMeta;
