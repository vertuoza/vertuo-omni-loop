import type { OutboxView } from '../../outbox-items/outbox-questions';
import { ProductFilter } from '../../product-filter/ProductFilter';
import { QuestionsList } from '../../questions/QuestionsList';

// Work › Questions › Outbox, drawn (PRD 2011 s14; the `questions` screen): the product filter, then every
// open outbox item of the workspace as the product's own Questions tab draws it, so it is answered in
// place with the same route. The ones that wait on the viewer come first (outbox-questions.ts).

export const EMPTY_OUTBOX = 'No decision waits on a person in your workspace.';

export function Outbox({ view }: { view: OutboxView }) {
  return (
    <div className="ask-col">
      <h1 className="ask-sr">Outbox</h1>
      <ProductFilter filter={view.filter} unreadable={false} />
      {view.questions.length === 0 ? (
        <p className="products-empty">{EMPTY_OUTBOX}</p>
      ) : (
        <QuestionsList label="Open outbox questions" questions={view.questions} demo={false} />
      )}
    </div>
  );
}
