import type { ReactElement, ReactNode } from 'react';
import { Streamed, type StreamedProps } from '../../../skeleton/Streamed';
import { completePage, DossierStream, type DossierStreamProps } from './DossierStream';

// For the tests of the /prd routes (PRD 657 s4): what a streamed page ends as, once its reads have
// resolved. A streamed block (src/skeleton/Streamed.tsx) is its block drawn from its read, and a PRD's
// streamed page (./DossierStream.tsx) is its complete page; anything else is itself. The tests then
// render it to static markup, and read its props, as before the page streamed.

export async function settled(node: ReactNode): Promise<ReactElement> {
  const element = node as ReactElement;
  if (element?.type === DossierStream) return completePage(element.props as DossierStreamProps);
  if (element?.type === Streamed) {
    const { read, children } = element.props as StreamedProps<unknown>;
    return settled(children(await read));
  }
  return element;
}
