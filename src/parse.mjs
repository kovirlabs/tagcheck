// A small HTML scanner: enough structure for semantic checks, no dependencies.
// Adapted from TagBrush's `npx tagbrush check`.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

const TAG = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/gi;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * Parse HTML into a flat list of elements in document order. Each element has
 * name, attributes, parent, children, text (all text inside it), index (offset
 * in the source), and inTemplate (inside a <template>).
 */
export function parse(html) {
  const elements = [];
  const stack = [];
  let last = 0;
  const addText = (text) => {
    if (!text.trim()) return;
    for (const open of stack) open.text += text;
  };
  TAG.lastIndex = 0;
  let match;
  while ((match = TAG.exec(html))) {
    addText(html.slice(last, match.index));
    last = TAG.lastIndex;
    const [, closing, rawName, rawAttributes] = match;
    if (!rawName) continue; // comment or doctype
    const name = rawName.toLowerCase();
    if (closing) {
      const index = stack.map((e) => e.name).lastIndexOf(name);
      if (index !== -1) stack.length = index;
      continue;
    }
    const attributes = {};
    for (const [, key, double, single, bare] of (rawAttributes || '').matchAll(ATTRIBUTE)) {
      const lower = key.toLowerCase();
      if (!(lower in attributes)) attributes[lower] = double ?? single ?? bare ?? '';
    }
    const parent = stack.at(-1) ?? null;
    const element = {
      name, attributes, parent, children: [], text: '', index: match.index,
      inTemplate: !!parent && (parent.name === 'template' || parent.inTemplate),
    };
    parent?.children.push(element);
    elements.push(element);
    if (RAW_TEXT.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, TAG.lastIndex);
      const stop = end === -1 ? html.length : end;
      element.text = html.slice(TAG.lastIndex, stop);
      TAG.lastIndex = last = stop;
      continue;
    }
    if (!VOID.has(name) && !match[0].endsWith('/>')) stack.push(element);
  }
  return elements;
}

/** Ancestors of an element, nearest first. */
export function* ancestors(element) {
  for (let node = element.parent; node; node = node.parent) yield node;
}
