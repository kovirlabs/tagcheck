#!/usr/bin/env node
// TagCheck command line: `npx @kovirlabs/tagcheck page.html [more files or folders]`

import { pathToFileURL } from 'node:url';
import { checkFiles, RULES, VERSION } from '../src/index.mjs';

const USAGE = `Usage: npx @kovirlabs/tagcheck <file.html | folder>... [options]

Finds semantic and accessibility mistakes in HTML: missing alt text and
labels, empty buttons and links, fake buttons, skipped headings, duplicate
ids, references to missing ids, and classes or data-tag attributes the Tag
family (TagBrush.css, TagAction) doesn't document.

Options:
  --browser        also render each page (needs Playwright) to check text
                   contrast in light and dark mode and sideways scrolling
                   at a ${360}px phone width
  --json           print results as JSON (for agents and CI)
  --strict         also fail (exit code 1) on warnings
  --ignore=a,b     skip these rules
  --rules          list every rule
  --version        print the version

Exit code: 0 clean, 1 problems to fix, 2 bad usage.`;

export async function main(args, log = console.log) {
  const flags = new Set(args.filter((a) => a.startsWith('--')).map((a) => a.split('=')[0]));
  const ignore = (args.find((a) => a.startsWith('--ignore=')) ?? '').slice('--ignore='.length).split(',').filter(Boolean);
  const paths = args.filter((a) => !a.startsWith('--'));
  if (flags.has('--version')) { log(VERSION); return 0; }
  if (flags.has('--rules')) {
    for (const [rule, [level, description]] of Object.entries(RULES)) log(`${rule.padEnd(20)} ${level.padEnd(8)} ${description}`);
    return 0;
  }
  if (flags.has('--help') || paths.length === 0) { log(USAGE); return paths.length === 0 && !flags.has('--help') ? 2 : 0; }

  let report;
  try {
    report = await checkFiles(paths, { browser: flags.has('--browser'), ignore });
  } catch (error) {
    log(flags.has('--json') ? JSON.stringify({ tool: 'tagcheck', error: error.message }) : `tagcheck: ${error.message}`);
    return 2;
  }
  if (flags.has('--json')) {
    log(JSON.stringify(report, null, 2));
  } else {
    for (const { file, problems } of report.files) {
      for (const p of problems) {
        log(`${file}${p.line ? `:${p.line}:${p.column}` : ''}  ${p.level === 'error' ? 'error  ' : 'warning'}  ${p.rule.padEnd(18)} ${p.message}`);
      }
    }
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    log(`${plural(report.files.length, 'file')} checked: ${plural(report.errors, 'error')}, ${plural(report.warnings, 'warning')}`);
  }
  return report.errors > 0 || (flags.has('--strict') && report.warnings > 0) ? 1 : 0;
}

// Run only when executed (directly or through the npm bin link), not when imported.
const invoked = process.argv[1] ?? '';
if (invoked && (import.meta.url === pathToFileURL(invoked).href || /[\\/]tagcheck(\.cmd)?$/.test(invoked))) {
  process.exitCode = await main(process.argv.slice(2));
}
