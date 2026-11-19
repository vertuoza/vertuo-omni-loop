import type { Hero } from '@omni/design';
import { Avatar } from './Avatar.tsx';
import { AVATAR_SIZES } from './Avatar.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const ADA: Hero = { v: 1, body: 'girl', skin: 2, hair: 2, suit: 2, cape: 1 };

/** An Avatar in each size. */
export const avatarSpecimen: Specimen = (_prop, value) => <Avatar hero={ADA} name="Ada Lovelace" size={one(AVATAR_SIZES, value)} />;
