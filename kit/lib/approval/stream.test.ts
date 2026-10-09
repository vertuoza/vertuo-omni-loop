// The approval stream's reader (PRD 1322, s4): Server-Sent Events split across chunks, comments,
// multi-line data and line endings, then each event's data read against its shape.
import { describe, expect, it } from 'vitest';
import { approvalEvent, sseReader } from './stream.ts';

describe('sseReader', () => {
  it('yields a message once its blank line arrives, across chunks and line endings', () => {
    const reader = sseReader();
    expect(reader.push('event: approved\r')).toEqual([]);
    expect(reader.push('\nid: 4\ndata: {"a":')).toEqual([]);
    expect(reader.push('1}\r\n\r\n: ping\n\nevent: reconnect\n\n')).toEqual([
      { event: 'approved', id: '4', data: '{"a":1}' },
      { event: 'reconnect', id: null, data: '' },
    ]);
  });

  it('joins data lines, names an unnamed event message, and skips unknown fields', () => {
    expect(sseReader().push('retry: 10\ndata: one\ndata:two\n\nfoo\n\n')).toEqual([{ event: 'message', id: null, data: 'one\ntwo' }]);
  });
});

describe('approvalEvent', () => {
  const asking = { asked: [{ login: 'paul' }], nobodyElse: false, author: 'ada', product: null };

  it('reads each event the stream sends', () => {
    expect(approvalEvent({ event: 'asked', id: '1', data: JSON.stringify(asking) })).toEqual({ type: 'asked', asking });
    expect(approvalEvent({ event: 're-asked', id: '2', data: JSON.stringify(asking) })).toEqual({ type: 're-asked', asking });
    expect(approvalEvent({ event: 'approved', id: '3', data: '{"approver":"paul","approvedAt":"t","pinned":2}' }))
      .toEqual({ type: 'approved', approver: 'paul', approvedAt: 't', pinned: 2 });
    expect(approvalEvent({ event: 'voided', id: '4', data: '{"pusher":"ada","kind":"spec","from":"a","to":"b"}' }))
      .toEqual({ type: 'voided', pusher: 'ada', kind: 'spec', from: 'a', to: 'b' });
    expect(approvalEvent({ event: 'ping', id: null, data: '' })).toEqual({ type: 'ping' });
  });

  it('reads an unknown event, or one whose data is not its shape, as null', () => {
    expect(approvalEvent({ event: 'message', id: null, data: '{}' })).toBeNull();
    expect(approvalEvent({ event: 'approved', id: '1', data: 'not json' })).toBeNull();
    expect(approvalEvent({ event: 'asked', id: '1', data: '{"asked":[]}' })).toBeNull();
    expect(approvalEvent({ event: 'voided', id: '1', data: '{"pusher":"ada"}' })).toBeNull();
  });
});
