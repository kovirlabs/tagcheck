// Static checks: read HTML source, report problems. No browser needed.

import { parse, ancestors } from './parse.mjs';
import { CLASSES, ATTRIBUTES, COMMANDS, BUILT_IN_COMMANDS, isFamilyAttribute } from './vocabulary.mjs';

const NAMED_BY_ATTRIBUTE = ['aria-label', 'aria-labelledby', 'title'];
const UNLABELED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
// Attributes whose value is one or more ids on the same page.
const REFERENCES = {
  for: ['label', 'output'],
  'aria-controls': null,
  'aria-labelledby': null,
  'aria-describedby': null,
  commandfor: null,
  popovertarget: null,
  list: ['input'],
  form: ['button', 'fieldset', 'input', 'object', 'output', 'select', 'textarea'],
};

const has = (element, name) => name in element.attributes;
const attribute = (element, name) => (element.attributes[name] ?? '').trim();
const hasName = (element) => NAMED_BY_ATTRIBUTE.some((name) => attribute(element, name));
// Text, or an image or icon with a name, gives a button or link a name.
const hasContent = (element) => element.text.trim() !== '' ||
  element.children.some((child) => (child.name === 'img' && attribute(child, 'alt')) || hasName(child) || hasContent(child));
const cssProperties = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|[;{\s])([a-z-]+)\s*:(?!:)/g)]
  .map((m) => m[1]).filter((property) => !property.startsWith('--') && property !== 'color-scheme');

/** Every rule TagCheck can report, with its level and what it means. */
export const RULES = {
  'missing-lang': ['error', '<html> has no lang attribute'],
  'missing-viewport': ['warning', 'no viewport <meta>, so phones show a zoomed-out desktop page'],
  'multiple-main': ['error', 'more than one visible <main>'],
  'missing-alt': ['error', '<img> without alt text'],
  'unlabeled-field': ['error', 'form field with no label, aria-label, or aria-labelledby'],
  'label-for-missing': ['error', '<label for> points to an id that does not exist'],
  'empty-button': ['error', '<button> with no text or aria-label'],
  'empty-link': ['error', '<a href> with no text or aria-label'],
  'clickable-div': ['error', '<div> or <span> used as a button or link'],
  'heading-skip': ['warning', 'a heading level is skipped (h2 to h4)'],
  'duplicate-id': ['error', 'the same id is used more than once'],
  'broken-reference': ['error', 'aria-controls, commandfor, for, list, or similar points to a missing id'],
  'unknown-command': ['error', 'command="…" is not a browser command or one TagAction handles'],
  'clone-target': ['error', 'command="--clone" must point at a <template>'],
  'remember-needs-id': ['warning', '<details> under data-tag-remember has no id, so its state is not saved'],
  'unknown-class': ['warning', 'a class the Tag family does not document'],
  'unknown-attribute': ['warning', 'a data-tag… (or TagBrush) attribute or value the Tag family does not document'],
  'generated-markup': ['warning', 'markup TagAction generates (data-tag="…") was copied into the source'],
  'inline-style': ['warning', 'inline style sets layout or colors instead of CSS variables'],
  'style-block': ['warning', '<style> sets properties other than CSS variables'],
  contrast: ['error', 'text below WCAG AA contrast (4.5:1) in the light or dark scheme (--browser)'],
  overflow: ['error', 'the page scrolls sideways at a phone width (--browser)'],
};

/**
 * Check one HTML document. Returns problems sorted by line:
 * { line, column, level, rule, message }.
 */
export function check(html) {
  const elements = parse(html);
  const problems = [];
  const position = (index) => {
    const before = html.slice(0, index).split('\n');
    return { line: before.length, column: before.at(-1).length + 1 };
  };
  const report = (element, rule, message) =>
    problems.push({ ...(element ? position(element.index) : { line: 1, column: 1 }), level: RULES[rule][0], rule, message });

  // Ids inside a <template> only exist once the template is copied.
  const live = elements.filter((element) => !element.inTemplate);
  const ids = new Map();
  for (const element of elements) {
    const id = element.attributes.id;
    if (!id) continue;
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(element);
  }
  const labelTargets = new Set(live.filter((e) => e.name === 'label' && e.attributes.for).map((e) => e.attributes.for));
  const usesTagBrush = elements.some((e) => e.name === 'link' && /tagbrush/i.test(e.attributes.href ?? ''));

  const root = elements.find((e) => e.name === 'html');
  if (root && !attribute(root, 'lang')) report(root, 'missing-lang', '<html> needs a lang attribute, for example lang="en"');
  if (root && !elements.some((e) => e.name === 'meta' && e.attributes.name === 'viewport')) {
    report(root, 'missing-viewport', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> so the page fits phones');
  }
  for (const extra of live.filter((e) => e.name === 'main' && !has(e, 'hidden')).slice(1)) {
    report(extra, 'multiple-main', 'A page should have only one visible <main>');
  }

  let previousHeading = 0;
  for (const element of elements) {
    const { name, attributes } = element;
    const inCode = [...ancestors(element)].some((a) => a.name === 'pre' || a.name === 'code');

    if (name === 'img' && !('alt' in attributes)) {
      report(element, 'missing-alt', `<img src="${attributes.src?.slice(0, 40) ?? ''}"> needs alt text (alt="" if it's decorative)`);
    }

    const isField = (name === 'input' && !UNLABELED_INPUT_TYPES.has((attributes.type ?? 'text').toLowerCase())) || name === 'select' || name === 'textarea';
    if (isField && !hasName(element) && ![...ancestors(element)].some((a) => a.name === 'label') &&
        !labelTargets.has(attributes.id) && !(element.inTemplate && attributes.id)) {
      report(element, 'unlabeled-field', `<${name}${attributes.name ? ` name="${attributes.name}"` : ''}> has no label: use <label for="…">, wrap it in <label>, or add aria-label`);
    }

    if (name === 'button' && !hasName(element) && !hasContent(element)) {
      report(element, 'empty-button', '<button> has no text: add text or aria-label');
    }
    if (name === 'a' && 'href' in attributes && !hasName(element) && !hasContent(element)) {
      report(element, 'empty-link', `<a href="${attributes.href.slice(0, 40)}"> has no text: add text or aria-label`);
    }

    if ((name === 'div' || name === 'span') && ('onclick' in attributes || ['button', 'link'].includes(attributes.role))) {
      report(element, 'clickable-div', `<${name}${attributes.role ? ` role="${attributes.role}"` : ' onclick'}> is a fake control: use <button> (or <a href> for navigation)`);
    }

    // References to other elements by id.
    for (const [reference, allowed] of Object.entries(REFERENCES)) {
      const value = attribute(element, reference);
      if (!value || (allowed && !allowed.includes(name))) continue;
      for (const id of value.split(/\s+/)) {
        if (ids.has(id)) continue;
        if (element.inTemplate && elements.some((e) => e.inTemplate && e.attributes.id === id)) continue;
        if (reference === 'for' && name === 'label') {
          report(element, 'label-for-missing', `<label for="${id}"> points to an id that doesn't exist`);
        } else {
          report(element, 'broken-reference', `${reference}="${id}" on <${name}> points to an id that doesn't exist`);
        }
      }
    }

    // TagAction commands.
    const command = attribute(element, 'command');
    if (command && name === 'button') {
      if (!BUILT_IN_COMMANDS.has(command.toLowerCase()) && !COMMANDS.has(command)) {
        report(element, 'unknown-command', `command="${command}" isn't a browser command (show-modal, close, toggle-popover, …) or one TagAction handles (${[...COMMANDS].join(', ')})`);
      }
      const target = ids.get(attribute(element, 'commandfor'))?.[0];
      if (command === '--clone' && target && target.name !== 'template') {
        report(element, 'clone-target', `command="--clone" points at <${target.name} id="${target.attributes.id}">; point it at a <template>`);
      }
    }
    if (name === 'details' && !attributes.id && [...ancestors(element), element].some((a) => 'data-tag-remember' in a.attributes)) {
      report(element, 'remember-needs-id', '<details> under data-tag-remember needs an id so its open state can be saved');
    }

    // The family's vocabulary.
    if (attributes.class !== undefined && !inCode) {
      const unknown = attributes.class.split(/\s+/).filter((c) => c && !CLASSES.has(c));
      if (unknown.length) report(element, 'unknown-class', `class="${unknown.join(' ')}" isn't part of TagBrush.css or TagAction: semantic HTML usually does the job`);
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'data-tag') {
        report(element, 'generated-markup', `data-tag="${value}" is added by TagAction at runtime; remove it (and the element, if TagAction inserted it) from the source`);
        continue;
      }
      if (!isFamilyAttribute(key)) continue;
      if (!(key in ATTRIBUTES)) {
        report(element, 'unknown-attribute', `${key} isn't a documented Tag family attribute (documented: ${Object.keys(ATTRIBUTES).join(', ')})`);
        continue;
      }
      const values = ATTRIBUTES[key];
      const customTone = key === 'data-tone' && /--tone\s*:/.test(attributes.style ?? '');
      if (values && !customTone && !values.includes(value.trim())) {
        report(element, 'unknown-attribute', `${key}="${value}" isn't a documented value (use ${values.map((v) => `"${v}"`).join(' or ')})`);
      }
    }

    if (usesTagBrush && attributes.style !== undefined) {
      const properties = cssProperties(`{${attributes.style}}`);
      if (properties.length) report(element, 'inline-style', `style sets ${properties.join(', ')}: with TagBrush.css only CSS variables should be needed`);
    }
    if (usesTagBrush && name === 'style') {
      const properties = [...new Set(cssProperties(element.text))];
      if (properties.length) report(element, 'style-block', `<style> sets ${properties.slice(0, 5).join(', ')}${properties.length > 5 ? ', …' : ''}: TagBrush.css only needs CSS variables`);
    }

    const level = /^h([1-6])$/.exec(name)?.[1];
    if (level && !element.inTemplate) {
      if (previousHeading && Number(level) > previousHeading + 1) {
        report(element, 'heading-skip', `<${name}> follows <h${previousHeading}>: don't skip heading levels`);
      }
      previousHeading = Number(level);
    }
  }

  for (const [id, list] of ids) {
    const outside = list.filter((e) => !e.inTemplate);
    if (outside.length > 1) report(outside[1], 'duplicate-id', `id="${id}" is used ${outside.length} times`);
  }
  return problems.sort((a, b) => a.line - b.line || a.column - b.column);
}
