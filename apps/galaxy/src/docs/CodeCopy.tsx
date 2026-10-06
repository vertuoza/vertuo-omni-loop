'use client';

import { useEffect } from 'react';
import { copyLink } from '../ask/page/share';
import { codeToCopy } from './copy';

// The guide's copy chips (issue #931): badges.ts ends every code block's badge row with one, and
// this, in the browser, copies the block's code when one is pressed. Copied, the button shows a tick
// for two seconds; where the clipboard is missing or refuses, the code is selected instead, for the
// person to copy. It listens once, on the document, so a block the page adds later works too.

const SHOWN_MS = 2000;

/** A node's text, read as the DOM's Node gives it: none for a node that holds no text. */
const textOf = (node: Node): string => node.textContent ?? '';

export function CodeCopy() {
  useEffect(() => {
    const copyOn = async (event: MouseEvent) => {
      const target = event.target;
      const button = target instanceof Element ? target.closest('.docs-copy') : null;
      const pre = button?.closest('.docs-code')?.querySelector('pre');
      if (!(button instanceof HTMLElement) || !pre) return;
      const done = await copyLink(codeToCopy(textOf(pre)), navigator.clipboard, () => {
        const range = document.createRange();
        range.selectNodeContents(pre);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      });
      if (done !== 'copied') return;
      button.dataset.copied = 'true';
      button.setAttribute('aria-label', 'Copied');
      setTimeout(() => {
        delete button.dataset.copied;
        button.setAttribute('aria-label', 'Copy the code');
      }, SHOWN_MS);
    };
    // The listener answers at once; the copy finishes on its own, as it did when the listener was async.
    const onClick = (event: MouseEvent) => { void copyOn(event); };
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('click', onClick); };
  }, []);
  return null;
}
