import type { ComponentMeta } from './meta.ts';

export const CARD_SURFACES = ['surface', 'raised', 'sunken'] as const;
export const CARD_PADDINGS = ['3', '4', '5'] as const;

export const cardMeta = {
  name: 'Card',
  variants: { surface: CARD_SURFACES, padding: CARD_PADDINGS },
  usage: 'A block of content set off from the page: one PRD\'s seal, one outbox question.',
  do: ['Hold one thing per card.', 'Group cards with a Stack, a step of the space scale apart.'],
  dont: ['Put a card inside a card.', 'Give a card a loud border or the signal colour: a card never shouts.'],
  contrast: {
    'surface=surface': [{ text: 'text-primary', on: 'surface' }],
    'surface=raised': [{ text: 'text-primary', on: 'raised' }],
    'surface=sunken': [{ text: 'text-primary', on: 'sunken' }],
  },
  accessibility: ['A plain div with no role: a card that needs a name is a section the page labels itself.'],
  replaces: ['dossier-seal-card', 'outbox-card'],
  example: '<Card surface="raised"><Text>What the PRD changes.</Text></Card>',
} satisfies ComponentMeta;
