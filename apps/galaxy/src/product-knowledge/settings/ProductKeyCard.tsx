'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { WriteSource } from '../constituents/knowledge-reader';
import { setProductKey } from './product-key-port';
import {
  AN_OWNER_SETS_IT, confirmLine, KEY_ANCHOR, KEY_TITLE, keyCardFrom, keyShapeOk, mcpLine, NEVER_CHANGES, NO_KEY, NO_KEY_YET, prdLine,
  refusalLine, SET_ONCE, SET_ONCE_NEVER, SHAPE_RULE, suggestKey, type KeyState, type ProductKeyData,
} from './product-key';

// The Product key card of Product settings (PRD 2784 s1; the draft screen product-knowledge-settings): the key
// that starts the product's PRD ids and names its MCP address. A workspace owner sets it once through
// product_set_key(), called as the signed-in person, prefilled from the product's name and confirmed first; any
// other member, and anyone on an archived product, only reads. In the demo the write only moves the card.

interface Props {
  card: ProductKeyData;
  product: string;
  source: WriteSource;
}

interface Draft {
  value: string;
  refusal: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onSet: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

function Field({ draft }: { draft: Draft }) {
  const shapeOk = keyShapeOk(draft.value);
  return (
    <>
      <label className="ask-muted" htmlFor="product-key-field">Key</label>
      <input
        id="product-key-field" className="ask-input" type="text" value={draft.value} spellCheck={false} autoComplete="off"
        aria-invalid={!shapeOk} onChange={(event) => { draft.onChange(event.target.value); }}
      />
      {shapeOk ? null : <p className="ask-muted" data-key-rule>{SHAPE_RULE}</p>}
      {draft.refusal === null ? null : <p role="alert" className="ask-muted">{draft.refusal}</p>}
      <span className="links-actions">
        <button type="button" className="ask-button" disabled={!shapeOk} onClick={draft.onSet}>Set key</button>
      </span>
      <p className="ask-muted">{SET_ONCE_NEVER}</p>
    </>
  );
}

function Confirm({ draft }: { draft: Draft }) {
  return (
    <>
      <p>{confirmLine(draft.value)}</p>
      <p className="ask-muted">{prdLine(draft.value)}</p>
      <p className="ask-muted">{mcpLine(draft.value)}</p>
      <p className="ask-muted">{NEVER_CHANGES}</p>
      <span className="links-actions">
        <button type="button" className="ask-button" disabled={draft.busy} onClick={draft.onConfirm}>Set for good</button>
        <button type="button" className="ask-button" disabled={draft.busy} onClick={draft.onBack}>Back</button>
      </span>
    </>
  );
}

function body(state: KeyState, draft: Draft): ReactNode {
  switch (state.kind) {
    case 'set':
      return (
        <>
          <p><code data-product-key>{state.key}</code></p>
          <p className="ask-muted">{SET_ONCE}</p>
        </>
      );
    case 'archived':
      return <p className="ask-muted">{NO_KEY}</p>;
    case 'member':
      return (
        <>
          <p className="ask-muted">{NO_KEY_YET}</p>
          <p className="ask-muted">{AN_OWNER_SETS_IT}</p>
        </>
      );
    case 'owner-field':
      return <Field draft={draft} />;
    case 'owner-confirm':
      return <Confirm draft={draft} />;
  }
}

export function ProductKeyCard({ card, product, source }: Props) {
  const router = useRouter();
  const [stored, setStored] = useState(card.key);
  const [value, setValue] = useState(() => suggestKey(card.name));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const write = async () => {
    if (busy) return;
    setBusy(true);
    setRefusal(null);
    const refused = await setProductKey(source, product, value);
    setBusy(false);
    if (refused !== null) {
      setConfirming(false);
      setRefusal(refusalLine(refused, value));
      return;
    }
    setStored(value);
    router.refresh();
  };

  const draft: Draft = {
    value, refusal, busy,
    onChange: (next) => { setValue(next); setRefusal(null); },
    onSet: () => { setConfirming(true); },
    onConfirm: () => { void write(); },
    onBack: () => { setConfirming(false); },
  };

  return (
    <section className="ask-card products-section" id={KEY_ANCHOR} aria-labelledby="product-key-title">
      <h2 id="product-key-title">{KEY_TITLE}</h2>
      {body(keyCardFrom({ ...card, key: card.key ?? stored }, confirming), draft)}
    </section>
  );
}
