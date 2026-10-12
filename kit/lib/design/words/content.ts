// PRD 1584, s2: `design.words.content` — the selector of the text a screen shows rather than writes
// (a PRD's text in a pane, a dashboard's figures). The word pass counts it apart and judges none of
// it. The key is optional, as `design.ignore` is: `parseConfig` leaves it unset when the file does
// not name it, and its default is applied here, where it is read.

/** The content mark when the config sets none. */
export const DEFAULT_WORDS_CONTENT = '[data-content]';

/** The selector `design.words.content` holds, or the default when the config does not set it. */
export function wordsContent(words: { readonly content?: string | undefined }): string {
  return words.content ?? DEFAULT_WORDS_CONTENT;
}
