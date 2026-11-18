import { Notice } from './Notice.tsx';
import { NOTICE_TONES } from './Notice.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Notice in each tone. */
export const noticeSpecimen: Specimen = (_prop, value) => (
  <Notice title="Waiting for a person" tone={one(NOTICE_TONES, value)}>
    Two questions are open.
  </Notice>
);
