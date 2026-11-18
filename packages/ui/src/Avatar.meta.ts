import type { ComponentMeta } from './meta.ts';

export const AVATAR_SIZES = ['sm', 'md', 'lg'] as const;

export const avatarMeta = {
  name: 'Avatar',
  variants: { size: AVATAR_SIZES },
  usage: 'A person, drawn as the head and shoulders of their hero sprite, beside their name or on a card.',
  do: ['Always give the person\'s name: it is what a screen reader says.', 'Keep to the three sizes: the sprite is drawn at a whole-number scale and stays crisp.'],
  dont: ['Stretch or resize it with CSS: a fractional scale blurs the pixels.', 'Use it for a team or a repository: those have their own parts.'],
  contrast: {},
  accessibility: [
    'An image with the person\'s name as its text alternative.',
    'The drawing itself is hidden from a screen reader: the name says who it is.',
  ],
  replaces: ['avatar', 'hero-chip'],
  example: '<Avatar hero={hero} name="Ada Lovelace" />',
} satisfies ComponentMeta;
