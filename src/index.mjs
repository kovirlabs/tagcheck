// TagCheck API.
//   import { check, checkFiles } from 'tagcheck';
//   check(html)                       -> problems in one HTML string
//   await checkFiles(paths, options)  -> report for files and folders

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, RULES } from './rules.mjs';

export { check, RULES };
export { parse } from './parse.mjs';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** HTML files in the given files and folders (skipping dot folders and node_modules). */
export function htmlFiles(path) {
  return statSync(path).isDirectory()
    ? readdirSync(path).filter((f) => !f.startsWith('.') && f !== 'node_modules').sort().flatMap((f) => htmlFiles(join(path, f)))
    : /\.html?$/i.test(path) ? [path] : [];
}

/**
 * Check files and folders. With { browser: true }, also render each page to
 * check contrast and overflow. Returns
 * { tool, version, files: [{ file, problems }], errors, warnings }.
 */
export async function checkFiles(paths, { browser = false, ignore = [] } = {}) {
  const files = paths.flatMap(htmlFiles);
  const results = files.map((file) => ({ file: relative(process.cwd(), file) || file, problems: check(readFileSync(file, 'utf8')) }));
  if (browser && files.length) {
    const { checkInBrowser } = await import('./browser.mjs');
    const rendered = await checkInBrowser(files);
    results.forEach((result, i) => result.problems.push(...rendered[files[i]]));
  }
  for (const result of results) result.problems = result.problems.filter((p) => !ignore.includes(p.rule));
  const count = (level) => results.reduce((n, r) => n + r.problems.filter((p) => p.level === level).length, 0);
  return { tool: 'tagcheck', version: VERSION, files: results, errors: count('error'), warnings: count('warning') };
}
