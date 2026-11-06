// What the Tag family documents. Anything in the family's namespaces that is
// not listed here is probably invented. Kept in sync with each library's
// llms.txt by tests/vocabulary.spec.mjs.

/** Classes TagBrush.css styles. */
export const CLASSES = new Set(['button', 'secondary', 'outline', 'container', 'grid', 'card', 'striped', 'visually-hidden', 'tagbrush']);

/**
 * data-* attributes in the family namespaces (data-tag…, plus TagBrush's own),
 * with the values they accept (null: any value, '': no value needed).
 */
export const ATTRIBUTES = {
  'data-tagbrush': ['debug'],
  'data-tagaction': ['off'],
  'data-tag-remember': null,
  'data-tag-time': ['relative'],
  'data-tag-toc': null,
  'data-theme': ['light', 'dark'],
  'data-layout': ['full'],
  'data-tone': ['success', 'warning', 'error', 'info', 'neutral'],
};

/** Custom commands TagAction handles (command="--…"). Built-in commands are the browser's. */
export const COMMANDS = new Set(['--clone']);
export const BUILT_IN_COMMANDS = new Set(['show-modal', 'close', 'request-close', 'toggle-popover', 'show-popover', 'hide-popover']);

/** Namespaces the family owns: an undocumented attribute here is a mistake. */
export const isFamilyAttribute = (name) => /^data-tag/.test(name) || name in ATTRIBUTES;
