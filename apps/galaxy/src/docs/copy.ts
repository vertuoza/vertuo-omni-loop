// What a guide code block's copy button copies (issue #931): the block's code as it reads, without
// the newline the compiler ends it with.

/** The code to copy, from the text of a block's <pre>. */
export const codeToCopy = (text: string) => text.replace(/\n$/, '');
