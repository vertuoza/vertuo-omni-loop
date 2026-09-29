import { Suspense, type ReactNode } from 'react';

// One block of a page that streams in on its own (PRD 657 s4): the server sends `skeleton` at once,
// in the block's place and of its size, then the block once `read` resolves. A slow block holds up
// only itself. A read that fails is logged on the server and shows, in the block's place, `failed`
// (its own "could not load" by default): the blocks beside it render as they would. Drawn on the
// server; `children` turns the read's value into the block.

export const STREAM_FAILED = 'Couldn’t load this. Reload in a moment.';

export interface StreamedProps<T> {
  /** The block's read, started by the page before it renders: never awaited by the page. */
  read: Promise<T>;
  /** What stands in its place while the read is pending. */
  skeleton: ReactNode;
  /** What shows when the read fails; the default says it could not load. */
  failed?: ReactNode;
  children: (value: T) => ReactNode;
}

async function Resolved<T>({ read, failed, children }: Omit<StreamedProps<T>, 'skeleton'>) {
  let value: T;
  try {
    value = await read;
  } catch (error) {
    console.error(error);
    return failed ?? <p className="dash-note skel-failed" role="alert">{STREAM_FAILED}</p>;
  }
  return children(value);
}

export function Streamed<T>({ read, skeleton, failed, children }: StreamedProps<T>) {
  return (
    <Suspense fallback={skeleton}>
      <Resolved read={read} failed={failed}>{children}</Resolved>
    </Suspense>
  );
}
