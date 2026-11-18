import { Text } from './Text.tsx';
import { TEXT_ELEMENTS, TEXT_SIZES, TEXT_TONES } from './Text.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** Text at each size, in each tone, as each element, strong and not. */
export const textSpecimen: Specimen = (prop, value) => (
  <Text
    {...(prop === 'size' ? { size: one(TEXT_SIZES, value) } : {})}
    {...(prop === 'tone' ? { tone: one(TEXT_TONES, value) } : {})}
    {...(prop === 'as' ? { as: one(TEXT_ELEMENTS, value) } : {})}
    strong={prop === 'strong' && value === 'true'}
  >
    The spec, as the PRD says it.
  </Text>
);
