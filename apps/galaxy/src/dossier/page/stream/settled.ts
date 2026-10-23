import { createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Streamed, type StreamedProps } from '../../../skeleton/Streamed';
import { completePage, DossierStream, type DossierStreamProps } from './DossierStream';

// For the tests of the /prd routes (PRD 657 s4): what a streamed page ends as, once its reads have
// resolved. A streamed block (src/skeleton/Streamed.tsx) is its block drawn from its read, and a PRD's
// streamed page (./DossierStream.tsx) is its complete page; anything else is itself. The tests then
// render it to static markup, and read its props, as before the page streamed.

/** A PRD's page whose approval, send and runners are late (PRD 2401 s4, ../DossierRoute.tsx's WithLateParts): the page once they settled. */
interface LateParts { late: Promise<unknown>; live: (read: unknown) => Promise<ReactNode>; read: unknown; children: (late: unknown) => ReactNode }
const isLateParts = (props: object): props is LateParts => 'late' in props && 'shell' in props && 'live' in props && 'children' in props;

export async function settledPage(node: ReactNode): Promise<ReactElement> {
  if (isValidElement<object>(node) && isLateParts(node.props)) {
    const { late, live, read, children } = node.props;
    const [seen, page] = await Promise.all([live(read), late.then((parts) => settledPage(children(parts)))]);
    return createElement(Fragment, null, seen, page);
  }
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
