import { Toast, ToastTrigger } from './Toast.tsx';
import { TOAST_TONES } from './Toast.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const words = { title: 'Answer saved', description: 'The plan reads it on its next wave.' };

/**
 * A still of a toast in each tone, drawn in place, inert: a real toast floats at the corner of the
 * page and goes by itself, so /design and its screenshot show it as it rests. The first tone also
 * carries the part's own button, which raises a real toast (one live region on the page, not one per
 * tone).
 */
export const toastSpecimen: Specimen = (_prop, value) => {
  const tone = one(TOAST_TONES, value);
  return (
    <div className="omni-toast-specimen">
      {tone === 'info' ? (
        <Toast><ToastTrigger label="Save the answer" tone={tone} {...words} /></Toast>
      ) : null}
      <div className="omni-toast-still" inert>
        <div className={`omni-toast omni-toast--${tone}`}>
          <div className="omni-toast__content">
            <div className="omni-toast__text">
              <p className="omni-toast__title">{words.title}</p>
              <p className="omni-toast__description">{words.description}</p>
            </div>
            <span className="omni-toast__close" aria-hidden="true">{'×'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
