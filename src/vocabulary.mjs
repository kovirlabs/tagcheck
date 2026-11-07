// What the Tag family documents. Anything in the family's namespaces that is
// not listed here is probably invented. Kept in sync with each library's
// llms.txt by tests/vocabulary.spec.mjs.

/** Classes TagBrush.css styles. */
export const CLASSES = new Set(['button', 'secondary', 'outline', 'container', 'grid', 'card', 'striped', 'visually-hidden', 'tagbrush']);

/**
 * Classes that Markdown converters (Pandoc, kramdown/Jekyll, GitHub, Hugo)
 * put in their output. Page authors don't write them, and TagBrush.css
 * handles them, so they aren't "invented". Classes inside <pre> and <code>
 * (syntax highlighting) are always allowed.
 */
export const GENERATED_CLASSES = new Set([
  'sourceCode', 'footnotes', 'footnotes-end-of-document', 'footnote-ref', 'footnote-back', 'footnote', 'reversefootnote', 'footnote-backref',
  'admonition', 'admonition-title',
  'markdown-alert', 'markdown-alert-title', 'katex', 'katex-display',
  'task-list', 'task-list-item', 'task-list-item-checkbox', 'contains-task-list', 'math', 'inline', 'display',
  'highlight', 'highlighter-rouge', 'chroma', 'astro-code', 'shiki',
]);
/** Row classes older Pandoc versions (before 3.2) put on table rows. */
export const GENERATED_ROW_CLASSES = new Set(['header', 'odd', 'even']);
export const GENERATED_CLASS_PREFIXES = ['language-', 'highlight-', 'markdown-alert-'];
/**
 * Inside these, the renderer owns every class: GitHub alerts (octicon icons),
 * KaTeX (mord, mathnormal, …), and MathJax's mjx-* elements.
 */
export const isGeneratedContainer = (element) => element.name.startsWith('mjx-') ||
  (element.attributes.class ?? '').split(/\s+/).some((c) => c === 'markdown-alert' || c === 'katex' || c === 'katex-display');
export const isGeneratedClass = (name, element) => GENERATED_CLASSES.has(name) || (element === 'tr' && GENERATED_ROW_CLASSES.has(name)) || GENERATED_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix));

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
  'data-density': ['compact'],
  'data-reasoning': null,
};

/** Custom commands TagAction handles (command="--…"). Built-in commands are the browser's. */
export const COMMANDS = new Set(['--clone']);
export const BUILT_IN_COMMANDS = new Set(['show-modal', 'close', 'request-close', 'toggle-popover', 'show-popover', 'hide-popover']);

/** Namespaces the family owns: an undocumented attribute here is a mistake. */
export const isFamilyAttribute = (name) => /^data-tag/.test(name) || name in ATTRIBUTES;
