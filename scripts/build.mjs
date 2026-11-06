// Generates the agent instruction files in ai/ from llms.txt, so every agent
// gets the same, tested guidance. Run with `npm run build`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const write = (file, contents) => {
  mkdirSync(new URL(file.slice(0, file.lastIndexOf('/') + 1), root), { recursive: true });
  writeFileSync(new URL(file, root), contents + '\n');
};
const guide = readFileSync(new URL('llms.txt', root), 'utf8').trim();
const generated = '<!-- Generated from llms.txt by scripts/build.mjs. Do not edit directly. -->';

write('ai/claude/tagcheck/SKILL.md', [
  '---',
  'name: tagcheck',
  'description: Check HTML pages for semantic and accessibility mistakes with `npx @kovirlabs/tagcheck` (alt text, labels, fake buttons, heading levels, broken id references, undocumented TagBrush/TagAction classes and attributes, contrast, phone overflow). Use after writing or editing HTML, before calling a page done.',
  '---',
  '',
  generated,
  '',
  guide,
].join('\n'));
write('ai/cursor/tagcheck.mdc', [
  '---',
  'description: Check HTML with npx @kovirlabs/tagcheck after editing it, and fix what it reports',
  'globs: ["**/*.html", "**/*.htm"]',
  'alwaysApply: false',
  '---',
  '',
  generated,
  '',
  guide,
].join('\n'));
write('ai/AGENTS.md', [generated, '', guide.replace(/^(#+) /gm, '#$1 ')].join('\n'));
console.log('ai/ instruction files written from llms.txt');
