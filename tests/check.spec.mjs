import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { check, checkFiles, RULES } from '../src/index.mjs';

const run = (...args) => spawnSync(process.execPath, ['bin/tagcheck.mjs', ...args], { encoding: 'utf8' });
const rules = (html) => check(html).map((p) => `${p.level}:${p.rule}`);
const page = (body) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body>${body}</body></html>`;

test.describe('static rules', () => {
  test('the bad fixture triggers every static rule, the good fixture none', async () => {
    const report = await checkFiles(['tests/fixtures/bad.html', 'tests/fixtures/good.html']);
    const [bad, good] = report.files;
    expect(good.problems).toEqual([]);
    const staticRules = Object.keys(RULES).filter((rule) => !['contrast', 'overflow'].includes(rule));
    expect(new Set(bad.problems.map((p) => p.rule))).toEqual(new Set(staticRules));
    expect(report.errors).toBe(13);
    expect(report.warnings).toBe(9);
  });

  test('every problem has a line, column, level, rule, and message', () => {
    for (const problem of check('<html><body>\n  <img src="x.png"></body></html>')) {
      expect(problem).toEqual({ line: expect.any(Number), column: expect.any(Number), level: expect.stringMatching(/^(error|warning)$/), rule: expect.any(String), message: expect.any(String) });
    }
    expect(check('<html lang="en"><body>\n  <img src="x.png"></body></html>').find((p) => p.rule === 'missing-alt')).toMatchObject({ line: 2, column: 3 });
  });

  test('labels: for/id, wrapping, aria-label, aria-labelledby, and title all count', () => {
    expect(rules(page('<label for="a">A</label><input id="a">'))).toEqual([]);
    expect(rules(page('<label>B <input></label>'))).toEqual([]);
    expect(rules(page('<input aria-label="Search" type="search"><p id="l">Name</p><input aria-labelledby="l"><select title="Size"></select>'))).toEqual([]);
    expect(rules(page('<input type="hidden" name="t"><input type="submit" value="Go">'))).toEqual([]);
    expect(rules(page('<textarea></textarea>'))).toEqual(['error:unlabeled-field']);
  });

  test('ids inside a <template> may repeat the ones outside, and references inside it resolve', () => {
    expect(rules(page('<label for="g">G</label><input id="g"><template id="t"><label for="g">G</label><input id="g"><p id="h"></p><button aria-controls="h">x</button></template>'))).toEqual([]);
  });

  test('browser commands and TagAction commands are known; others are not', () => {
    expect(rules(page('<button commandfor="d" command="show-modal">Open</button><button commandfor="d" command="close">Close</button><dialog id="d"></dialog>'))).toEqual([]);
    expect(rules(page('<button commandfor="d" command="--open">Open</button><dialog id="d"></dialog>'))).toEqual(['error:unknown-command']);
  });

  test('popovertarget, list, and output for are checked', () => {
    expect(rules(page('<button popovertarget="p">P</button><input aria-label="x" list="l"><output for="a b"></output>'))).toEqual(
      ['error:broken-reference', 'error:broken-reference', 'error:broken-reference', 'error:broken-reference']);
  });

  test('classes inside code blocks (syntax highlighting) are allowed', () => {
    expect(rules(page('<pre><code class="language-js"><span class="hljs-keyword">const</span></code></pre>'))).toEqual([]);
  });

  test('other data-* attributes are the page\'s own business', () => {
    expect(rules(page('<div data-user-id="7" data-testid="x">Hi</div>'))).toEqual([]);
  });

  test('style checks apply only to pages that use TagBrush.css', () => {
    expect(rules(page('<p style="margin: 0">x</p>'))).toEqual([]);
  });
});

test.describe('command line', () => {
  test('exit codes: 1 for errors, 0 for clean, 2 for bad usage; --strict fails on warnings', () => {
    expect(run('tests/fixtures/bad.html').status).toBe(1);
    expect(run('tests/fixtures/good.html').status).toBe(0);
    expect(run().status).toBe(2);
    expect(run('tests/fixtures/good.html', '--strict').status).toBe(0);
    expect(run('tests/fixtures/bad.html', '--ignore=missing-lang,multiple-main,missing-alt,unlabeled-field,label-for-missing,empty-button,empty-link,clickable-div,duplicate-id,broken-reference,unknown-command,clone-target').status).toBe(0);
    expect(run('tests/fixtures/bad.html', '--ignore=missing-lang,multiple-main,missing-alt,unlabeled-field,label-for-missing,empty-button,empty-link,clickable-div,duplicate-id,broken-reference,unknown-command,clone-target', '--strict').status).toBe(1);
  });

  test('text output names file:line:column, level, and rule, then a summary', () => {
    const { stdout } = run('tests/fixtures/bad.html');
    expect(stdout).toMatch(/^tests\/fixtures\/bad\.html:12:3 {2}error {4}missing-alt/m);
    expect(stdout).toMatch(/1 file checked: 13 errors, 9 warnings/);
  });

  test('--json prints a machine-readable report', () => {
    const report = JSON.parse(run('tests/fixtures', '--json').stdout);
    expect(report).toMatchObject({ tool: 'tagcheck', version: expect.any(String), errors: expect.any(Number), warnings: expect.any(Number) });
    expect(report.files.map((f) => f.file)).toEqual(['tests/fixtures/bad.html', 'tests/fixtures/good.html', 'tests/fixtures/low-contrast.html']);
  });

  test('--rules lists every rule', () => {
    const { stdout } = run('--rules');
    for (const rule of Object.keys(RULES)) expect(stdout).toContain(rule);
  });
});

test.describe('family pages are clean', () => {
  const sibling = (path) => (existsSync(path) ? path : null);

  test('TagBrush agent-written pages and starter', async () => {
    const paths = [sibling('../tagbrush/evals/pages'), sibling('../tagbrush/starter.html')].filter(Boolean);
    test.skip(!paths.length, 'TagBrush checkout not next to this repo');
    const report = await checkFiles(paths);
    expect(report.files.flatMap((f) => f.problems.map((p) => `${f.file}:${p.line} ${p.rule}`))).toEqual([]);
  });

  test('TagAction demo and test pages', async () => {
    const paths = [sibling('../tagaction/index.html'), sibling('../tagaction/tests/fixtures')].filter(Boolean);
    test.skip(!paths.length, 'TagAction checkout not next to this repo');
    const report = await checkFiles(paths, { ignore: ['inline-style'] }); // the scroll fixture sets section heights
    expect(report.errors + report.warnings).toBe(0);
  });
});

test.describe('--browser', () => {
  test('finds low contrast and sideways scrolling, and passes good pages', async () => {
    const report = await checkFiles(['tests/fixtures/low-contrast.html', 'tests/fixtures/good.html'], { browser: true });
    const [low, good] = report.files;
    expect(low.problems.filter((p) => p.rule === 'contrast').map((p) => p.message)).toEqual([
      expect.stringMatching(/<p> Too faint to read: contrast .*light mode/),
    ]);
    expect(low.problems.filter((p) => p.rule === 'overflow')).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringMatching(/360px screen/) }),
    ]);
    expect(good.problems).toEqual([]);
  });
});

test.describe('llms.txt contract', () => {
  const guide = () => readFileSync('llms.txt', 'utf8');

  test('llms.txt lists exactly the rules TagCheck has, at the right level', () => {
    const rulesSection = guide().split('## Rules')[1].split('## Use it from code')[0];
    const [errors, warnings] = rulesSection.split(/^Warnings:$/m);
    const named = (text) => new Set([...text.matchAll(/^- `([a-z-]+)`(?:, `([a-z-]+)`)?/gm)].flatMap((m) => [m[1], m[2]]).filter(Boolean));
    const documentedErrors = named(errors);
    const documentedWarnings = named(warnings);
    for (const [rule, [level]] of Object.entries(RULES)) {
      expect(level === 'error' ? documentedErrors : documentedWarnings, rule).toContain(rule);
    }
    expect(documentedErrors.size + documentedWarnings.size).toBe(Object.keys(RULES).length);
  });

  test('every option llms.txt mentions exists in --help', () => {
    const help = run('--help').stdout;
    for (const [option] of guide().matchAll(/--[a-z]+/g)) if (option !== '--clone') expect(help, option).toContain(option);
  });

  test('generated agent files match llms.txt', () => {
    for (const file of ['ai/claude/tagcheck/SKILL.md', 'ai/cursor/tagcheck.mdc']) expect(readFileSync(file, 'utf8')).toContain(guide().trim());
  });
});
