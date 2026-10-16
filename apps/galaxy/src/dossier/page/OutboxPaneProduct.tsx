import { QuestionsList } from '../../questions/QuestionsList';
import { PRODUCT_OUTBOX_EMPTY, type ProductOutboxView } from './outbox-product';
import '../../product-home/product-home.css';

// The Outbox tab of a product PRD's page (PRD 2011 s15): its items from the server's rows. The open ones are
// the Questions tab's own rows (QuestionsList), answered in place with a person's sign-in; the settled ones
// follow, each with its verdict, the answer as given, who gave it and when (./outbox-product.ts). A
// repository PRD's tab is OutboxPane's, read from GitHub.

export function OutboxPaneProduct({ outbox }: { outbox: ProductOutboxView }) {
  if (outbox.open.length === 0 && outbox.settled.length === 0) return <p className="dossier-empty">{PRODUCT_OUTBOX_EMPTY}</p>;
  return (
    <div className="outbox outbox-product">
      {outbox.open.length > 0 && <QuestionsList label="Open outbox questions" questions={outbox.open} demo={false} />}
      {outbox.settled.length > 0 && (
        <section className="products-list product-home-lane" aria-label="Settled outbox questions">
          <ul>
            {outbox.settled.map((s) => (
              <li key={s.id} className="product-home-row questions-row" data-row="settled" data-question={s.id}>
                <span className="product-home-n">{outbox.prdId}</span>
                <span className="product-home-main">
                  <span className="product-home-title">{s.question}</span>
                  <span className="product-home-meta"><span>{s.id}</span><span>{s.by} · {s.at}</span></span>
                  {s.answer !== null && <span className="questions-settled">{s.answer}</span>}
                </span>
                <span className="product-home-state">{s.verdict}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
