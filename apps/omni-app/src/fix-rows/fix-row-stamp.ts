// `fix-row-stamp`: the Inngest function a fix stamp event runs (PRD 2011 s7, acceptance 5). A pull
// request closed, merged or not, or reopened, stamps the Fixes rows of every bug record born on the server
// whose repository and pull request it is, in one step, "stamp", through `fix_row_stamp()` as the service
// role (./stamp.ts):
//
//   merged     the row shows `merged`; the last merge of a record's rows ships the record
//   closed     unmerged: the row shows `closed, not merged`, and the record stays open
//   reopened   the row is open again
//
// A merge matching no row, whose body names a record (`Fixes mobile-B74`) of a product holding the
// repository, stamps nothing and is kept on that record as `unmatched merge <repo>#<n>`.
//
// It is handed no GitHub: the delivery carries every fact it needs, so it reads nothing there and never
// merges anything (N-PRODUCT-15). A database that refuses fails the step, and Inngest retries it; a replay
// keeps the first merge and ships nothing twice.
import type { Inngest } from 'inngest';
import { noteTo } from '../run-log/run-log.ts';
import { FIX_STAMP_EVENT, FixStampDataSchema } from './fix-stamp.ts';
import type { FixStamper } from './stamp.ts';

export const FIX_ROW_STAMP_FUNCTION_ID = 'fix-row-stamp';

export function createFixRowStamp({
  client,
  stamp,
  log = noteTo('fix-row-stamp'),
}: {
  client: Inngest;
  /** The stamper; null when the App cannot reach the server here, which stamps nothing. */
  stamp: FixStamper | null;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    { id: FIX_ROW_STAMP_FUNCTION_ID, name: 'omni-loop · fix row stamp', triggers: [{ event: FIX_STAMP_EVENT }], retries: 3 },
    async ({ event, step }) => {
      const data = FixStampDataSchema.parse(event.data);
      const pull = `${data.repository}#${String(data.prNumber)}`;
      if (!stamp) {
        log(`fix stamp: ${pull} ${data.kind} stamps nothing: the App cannot reach the server here`);
        return { pull, kind: data.kind, stamped: false };
      }
      const { repository, prNumber, kind, at, bug } = data;
      const answer = await step.run('stamp', () => stamp({ repository, prNumber, kind, at, bug }));
      for (const shipped of answer.shipped) log(`fix stamp: ${pull} merged, the last fix of ${shipped}: it ships`);
      if (answer.unmatched !== null) log(`fix stamp: ${pull} merged, matching no row of ${answer.unmatched}: kept as unmatched merge ${pull.toLowerCase()}`);
      return {
        pull,
        kind,
        rows: answer.rows.map((row) => `${row.bug} row ${String(row.position)} ${row.state}`),
        shipped: answer.shipped,
        unmatched: answer.unmatched,
      };
    },
  );
}
