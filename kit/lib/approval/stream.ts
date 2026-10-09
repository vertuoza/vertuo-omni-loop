// A PRD's approval as the Omni page streams it (PRD 1322, s4): `GET /api/dossiers/approval/stream`
// answers Server-Sent Events, which this module reads, and `POST /api/dossiers/approval/request`
// answers who was asked, in the same shape as an `asked` event's data.
//
// | event       | data (JSON)                                                                  |
// |-------------|------------------------------------------------------------------------------|
// | `asked`     | `{ asked: [{ login, name? }], nobodyElse, author, product }` (the request's) |
// | `re-asked`  | the same, after a void                                                       |
// | `approved`  | `{ approver, approvedAt, pinned }`: a login, an ISO time, how many files     |
// | `voided`    | `{ pusher, kind, from, to }`: a login, the pinned kind, the old and new sha256 |
// | `ping`      | none: the stream is alive                                                     |
// | `reconnect` | none: the server closes now, reconnect with `Last-Event-ID`                   |
//
// Every event but `ping` and `reconnect` carries an `id:` that increases. An event this module does
// not know, or whose data is not its shape, reads as `null`: the wait ignores it.
import { z } from 'zod';

/** One message of a Server-Sent Events stream: its event name (`message` when none), its id, its data. */
type SseMessage = { event: string; id: string | null; data: string };

const text = z.string().min(1);

/** Who a request asked: each asked person, whether nobody but the author was left, the author, the
 * product (null when the repository has none). */
export const AskingSchema = z.object({
  asked: z.array(z.object({ login: text, name: text.nullable().optional() })),
  nobodyElse: z.boolean(),
  author: text,
  product: text.nullable(),
});

const ApprovedSchema = z.object({ approver: text, approvedAt: text, pinned: z.number().int().nonnegative() });

const VoidedSchema = z.object({ pusher: text, kind: text, from: text, to: text });

/** Who a request asked, as the request and the `asked` events say it. */
export type Asking = z.infer<typeof AskingSchema>;

/** An event of the approval stream, read. */
export type ApprovalEvent =
  | { type: 'asked' | 're-asked'; asking: Asking }
  | ({ type: 'approved' } & z.infer<typeof ApprovedSchema>)
  | ({ type: 'voided' } & z.infer<typeof VoidedSchema>)
  | { type: 'ping' | 'reconnect' };

function json(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** The approval event a message carries, or null when it carries none this module knows. */
export function approvalEvent({ event, data }: SseMessage): ApprovalEvent | null {
  if (event === 'ping' || event === 'reconnect') return { type: event };
  if (event === 'asked' || event === 're-asked') {
    const asking = AskingSchema.safeParse(json(data));
    return asking.success ? { type: event, asking: asking.data } : null;
  }
  if (event === 'approved') {
    const approved = ApprovedSchema.safeParse(json(data));
    return approved.success ? { type: event, ...approved.data } : null;
  }
  if (event === 'voided') {
    const voided = VoidedSchema.safeParse(json(data));
    return voided.success ? { type: event, ...voided.data } : null;
  }
  return null;
}

/** The message being read: its fields so far, and whether any came. */
type Pending = { event: string; id: string | null; data: string[]; fields: boolean };

const blank = (): Pending => ({ event: '', id: null, data: [], fields: false });

/** The fields a message keeps; any other (a comment's empty name included) is skipped. */
const FIELDS: Readonly<Record<string, (pending: Pending, value: string) => void>> = {
  event: (pending, value) => {
    pending.event = value;
  },
  data: (pending, value) => {
    pending.data.push(value);
  },
  id: (pending, value) => {
    pending.id = value;
  },
};

/** A line's field name and value, the value's one leading space dropped. */
function fieldOf(line: string): [string, string] {
  const colon = line.indexOf(':');
  if (colon === -1) return [line, ''];
  return [line.slice(0, colon), line.slice(colon + 1).replace(/^ /, '')];
}

/** A reader of Server-Sent Events: text goes in as it arrives, whole messages come out. A message
 * ends on a blank line; a comment (`:`) is skipped; a field's one leading space is dropped. */
export function sseReader(): { push(chunk: string): SseMessage[] } {
  let rest = '';
  let pending = blank();
  const take = (line: string, out: SseMessage[]) => {
    if (line === '') {
      if (pending.fields) out.push({ event: pending.event || 'message', id: pending.id, data: pending.data.join('\n') });
      pending = blank();
      return;
    }
    const [name, value] = fieldOf(line);
    const set = Object.hasOwn(FIELDS, name) ? FIELDS[name] : undefined;
    if (!set) return;
    set(pending, value);
    pending.fields = true;
  };
  return {
    push(chunk) {
      // A `\r` at the very end may be half of a `\r\n`: it waits for the next chunk.
      const all = rest + chunk;
      const cut = all.endsWith('\r') ? all.length - 1 : all.length;
      const lines = all.slice(0, cut).split(/\r\n|\r|\n/);
      rest = (lines.pop() ?? '') + all.slice(cut);
      const out: SseMessage[] = [];
      for (const line of lines) take(line, out);
      return out;
    },
  };
}
