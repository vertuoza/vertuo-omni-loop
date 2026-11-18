import type { ReactNode } from 'react';
import './Kbd.css';
import type { KBD_SIZES } from './Kbd.meta.ts';

export type KbdProps = {
  size?: (typeof KBD_SIZES)[number];
  children?: ReactNode;
};

/** A key a person presses, drawn as a key cap: Esc, Enter, Tab. */
export function Kbd({ size = 'body', children }: KbdProps) {
  return <kbd className={`omni-kbd omni-kbd--${size}`}>{children}</kbd>;
}
