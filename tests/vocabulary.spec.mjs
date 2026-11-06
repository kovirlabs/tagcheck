// TagCheck's list of documented classes and attributes must match what
// TagBrush.css and TagAction document in their llms.txt.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { CLASSES, ATTRIBUTES, COMMANDS } from '../src/vocabulary.mjs';

const read = (...paths) => {
  const path = paths.find((p) => existsSync(p));
  return path ? readFileSync(path, 'utf8') : null;
};
const tagbrush = read('node_modules/tagbrush/llms.txt');
const tagaction = read('node_modules/tagaction/llms.txt', '../tagaction/llms.txt');

test('every class TagBrush.css documents is known, and nothing else', () => {
  const documented = new Set([
    ...[...tagbrush.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    ...[...tagbrush.matchAll(/`\.([a-z][a-z-]*)`/g)].map((m) => m[1]),
    'tagbrush', // the scoped build's wrapper class (README)
  ]);
  expect([...documented].sort()).toEqual([...CLASSES].sort());
});

test('every family data attribute and value in the guides is known', () => {
  const guides = tagbrush + (tagaction ?? '');
  const documented = new Set([...guides.matchAll(/\b(data-(?:tag[a-z-]*|theme|layout|tone))\b/g)].map((m) => m[1]));
  expect([...documented].filter((name) => !(name in ATTRIBUTES))).toEqual([]);
  for (const [, name, value] of guides.matchAll(/\b(data-(?:tag[a-z-]*|theme|layout|tone))="([^"]*)"/g)) {
    if (ATTRIBUTES[name]) expect(ATTRIBUTES[name], `${name}="${value}"`).toContain(value);
  }
});

test('TagAction commands match its guide', () => {
  test.skip(!tagaction, 'TagAction llms.txt not found (install tagaction or check it out next to this repo)');
  const documented = new Set([...tagaction.matchAll(/command="(--[a-z-]+)"/g)].map((m) => m[1]));
  expect([...documented].sort()).toEqual([...COMMANDS].sort());
  const dataTag = new Set([...tagaction.matchAll(/\b(data-tag(?:action|-[a-z]+))\b/g)].map((m) => m[1]));
  const known = Object.keys(ATTRIBUTES).filter((name) => name.startsWith('data-tag') && name !== 'data-tagbrush');
  expect([...dataTag].sort()).toEqual(known.sort());
});
