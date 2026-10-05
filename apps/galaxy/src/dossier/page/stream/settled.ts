import { createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Streamed, type StreamedProps } from '../../../skeleton/Streamed';
import { completePage, DossierStream, type DossierStreamProps } from './DossierStream';

// For the tests of the /prd routes (PRD 657 s4): what a streamed page ends as, once its reads have
// resolved. A streamed block (src/skeleton/Streamed.tsx) is its block drawn from its read, and a PRD's
// streamed page (./DossierStream.tsx) is its complete page; anything else is itself. The tests then
// render it to static markup, and read its props, as before the page streamed.

export async function settledPage(node: ReactNode): Promise<ReactElement> {
  if (isValidElement<DossierStreamProps>(node) && node.type === DossierStream) {
    const { props } = node;
    const [live, page] = await Promise.all([props.live(props.read), completePage(props)]);
    return createElement(Fragment, null, live, page);
  }
  if (isValidElement<StreamedProps<unknown>>(node) && node.type === Streamed) {
    const { read, children } = node.props;
    return settledPage(children(await read));
  }
  // The page hands its root element; anything else is drawn as itself, in a fragment.
  return isValidElement(node) ? node : createElement(Fragment, null, node);
}
