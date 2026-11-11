import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { check, checkFiles, RULES } from '../src/index.mjs';
import { COMMANDS } from '../src/vocabulary.mjs';

const run = (...args) => spawnSync(process.execPath, ['bin/tagcheck.mjs', ...args], { encoding: 'utf8' });
const rules = (html) => check(html).map((p) => `${p.level}:${p.rule}`);
const page = (body) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body>${body}</body></html>`;

test.describe('static rules', () => {
  test('the bad fixture triggers every static rule, the good fixture none', async () => {
    const report = await checkFiles(['tests/fixtures/bad.html', 'tests/fixtures/good.html']);
    const [bad, good] = report.files;
    expect(good.problems).toEqual([]);
    const staticRules = Object.keys(RULES).filter((rule) => !['contrast', 'overflow', 'not-loaded'].includes(rule));
    expect(new Set(bad.problems.map((p) => p.rule))).toEqual(new Set(staticRules));
    expect(report.errors).toBe(13);
    expect(report.warnings).toBe(10);
    // data-tag="num" (TagAction's mark on number columns) copied from a rendered page is generated markup.
    expect(bad.problems.filter((p) => p.rule === 'generated-markup').map((p) => p.message)).toContainEqual(expect.stringContaining('data-tag="num"'));
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
    expect(rules(page('<ul><li id="r"><input aria-label="Name"> <button commandfor="r" command="--remove" hidden>Remove</button></li></ul>'))).toEqual([]);
    expect(rules(page('<input id="i" aria-label="Link" value="x" readonly><button commandfor="i" command="--copy">Copy</button><section id="s"><button commandfor="s" command="--share">Share</button></section>'))).toEqual([]);
  });

  test('new TagBrush.css and TagAction attributes and values are known', () => {
    expect(rules(page('<header data-layout="sticky"><p>Bar</p></header><button data-tone="error">Delete</button>'))).toEqual([]);
    expect(rules(page('<input id="n" aria-label="Nights" value="2"><output for="n" data-tag-calc="product" data-tag-format="USD">2</output><select data-tag-theme aria-label="Theme"></select>'))).toEqual([]);
    expect(rules(page('<input id="p" aria-label="Password" type="password"><input aria-label="Confirm" type="password" data-tag-match="p">'))).toEqual([]);
    expect(rules(page('<header data-layout="fixed"><p>Bar</p></header>'))).toEqual(['warning:unknown-attribute']);
  });

  test('an interestfor tooltip trigger must name its popover', () => {
    expect(rules(page('<button interestfor="tip" aria-describedby="tip">Save</button><div popover="hint" id="tip" role="tooltip">Saves a draft</div>'))).toEqual([]);
    expect(rules(page('<button interestfor="nope">Save</button>'))).toEqual(['error:broken-reference']);
  });

  test('popovertarget, list, and output for are checked', () => {
    expect(rules(page('<button popovertarget="p">P</button><input aria-label="x" list="l"><output for="a b"></output>'))).toEqual(
      ['error:broken-reference', 'error:broken-reference', 'error:broken-reference', 'error:broken-reference']);
  });

  test('classes inside code blocks (syntax highlighting) are allowed', () => {
    expect(rules(page('<pre><code class="language-js"><span class="hljs-keyword">const</span></code></pre>'))).toEqual([]);
  });

  test('Markdown tool output (Pandoc, Jekyll, GitHub) is not reported', () => {
    const pandoc = '<link rel="stylesheet" href="tagbrush.css"><h2>A</h2><p>Text<a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a></p>' +
      '<div class="sourceCode" id="cb1"><pre class="sourceCode js"><code class="sourceCode javascript"><span id="cb1-1"><a href="#cb1-1" aria-hidden="true" tabindex="-1"></a><span class="kw">const</span></span></code></pre></div>' +
      '<table><thead><tr class="header"><th style="text-align: right;">N</th></tr></thead><tbody><tr class="odd"><td style="text-align: right;">1</td></tr><tr class="even"><td>2</td></tr></tbody></table>' +
      '<ul class="task-list"><li><label><input type="checkbox" checked>Done</label></li></ul>' +
      '<ul><li><input checked="" disabled="" type="checkbox"> Hugo task</li></ul>' +
      '<ul class="task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled="disabled" checked="checked" />Done</li></ul><span class="math inline">x</span>' +
      '<div class="language-js highlighter-rouge"><div class="highlight"><pre class="highlight"><code>x</code></pre></div></div>' +
      '<div class="admonition warning"><p class="admonition-title">Warning</p><p>x</p></div><a class="footnote-backref" href="#t">↩</a><p id="t">t</p>' +
      '<section id="footnotes" class="footnotes footnotes-end-of-document" role="doc-endnotes"><ol><li id="fn1"><p>Note.<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></p></li></ol></section>';
    expect(rules(page(pandoc))).toEqual([]);
    expect(rules(page('<link rel="stylesheet" href="tagbrush.css"><td style="width: 50%">x</td>'))).toEqual(['warning:inline-style']);
    expect(rules(page('<a href="#x" aria-hidden="true"></a><p id="x">x</p>'))).toEqual(['error:empty-link']); // still focusable
    expect(rules(page('<input type="checkbox" class="task-list-item-checkbox">'))).toEqual(['error:unlabeled-field']); // not disabled: a real form field
    expect(rules(page('<li>Text <input type="checkbox" disabled></li>'))).toEqual(['error:unlabeled-field']); // not at the start of a list item
    expect(rules(page('<p class="odd">x</p>'))).toEqual(['warning:unknown-class']); // row classes only count on rows
  });

  test('chat and AI output (GitHub alerts, KaTeX, MathJax, reasoning, compact density) is not reported', () => {
    const chat = '<link rel="stylesheet" href="tagbrush.css"><div class="tagbrush" data-density="compact">' +
      '<details data-reasoning><summary>Thought for 4 seconds</summary><p>x</p></details>' +
      '<div class="markdown-alert markdown-alert-note" dir="auto"><p class="markdown-alert-title" dir="auto"><svg class="octicon octicon-info mr-2" viewBox="0 0 16 16" aria-hidden="true"></svg>Note</p><p>x</p></div>' +
      '<p><span class="katex"><span class="katex-mathml"><math><mi>x</mi></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span></p>' +
      '<span class="katex-display"><span class="katex"><span class="katex-html" aria-hidden="true"><span class="mord">y</span></span></span></span>' +
      '<mjx-container class="MathJax" jax="CHTML" display="true"><mjx-math class="MJX-TEX"><mjx-mi class="mjx-i">z</mjx-mi></mjx-math></mjx-container>' +
      '</div>';
    expect(rules(page(chat))).toEqual([]);
    expect(rules(page('<div data-density="cozy">x</div>'))).toEqual(['warning:unknown-attribute']);
    expect(rules(page('<p class="mord">x</p>'))).toEqual(['warning:unknown-class']); // only inside KaTeX output
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
    expect(stdout).toMatch(/1 file checked: 13 errors, 10 warnings/);
  });

  test('--json prints a machine-readable report', () => {
    const report = JSON.parse(run('tests/fixtures', '--json').stdout);
    expect(report).toMatchObject({ tool: 'tagcheck', version: expect.any(String), errors: expect.any(Number), warnings: expect.any(Number) });
    expect(report.files.map((f) => f.file)).toEqual(['tests/fixtures/bad.html', 'tests/fixtures/good.html', 'tests/fixtures/low-contrast.html', 'tests/fixtures/not-loaded.html', 'tests/fixtures/redirect.html']);
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
    const report = await checkFiles(['tests/fixtures/low-contrast.html', 'tests/fixtures/good.html', 'tests/fixtures/redirect.html'], { browser: true });
    const [low, good, redirect] = report.files;
    expect(redirect.problems).toEqual([]); // skipped by the browser checks, not crashed
    expect(low.problems.filter((p) => p.rule === 'contrast').map((p) => p.message)).toEqual([
      expect.stringMatching(/<p> Too faint to read: contrast .*light mode, needs 4\.5:1$/),
      expect.stringMatching(/<p> Small gray text: contrast 3\.03:1 in light mode, needs 4\.5:1$/),
      expect.stringMatching(/<p> Large but too faint: contrast .*light mode, needs 3:1 \(large text\)$/),
    ]); // large (24px) and bold 19px gray text at 3.03:1 pass
    expect(low.problems.filter((p) => p.rule === 'overflow')).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringMatching(/360px screen/) }),
    ]);
    expect(good.problems).toEqual([]);
    expect(report.browser).toBe(true);
  });

  test('says when a stylesheet did not load, and serves every TagBrush.css build offline', async () => {
    const report = await checkFiles(['tests/fixtures/not-loaded.html'], { browser: true });
    expect(report.files[0].problems).toEqual([
      expect.objectContaining({ level: 'warning', rule: 'not-loaded', message: expect.stringMatching(/missing\.css didn't load/) }),
    ]);
    const { localCopies } = await import('../src/browser.mjs');
    const served = (url) => localCopies().find(({ pattern }) => pattern.test(url))?.path.split('/').pop();
    expect(served('https://cdn.jsdelivr.net/npm/tagbrush@1/tagbrush.min.css')).toBe('tagbrush.css');
    expect(served('https://cdn.jsdelivr.net/npm/tagbrush@1/tagbrush.scoped.min.css')).toBe('tagbrush.scoped.css');
    expect(served('https://cdn.jsdelivr.net/npm/tagbrush@1/tagbrush.shadow.css')).toBe('tagbrush.shadow.css');
    expect(served('https://cdn.jsdelivr.net/npm/tagaction@0/tagaction.min.js')).toBe('tagaction.js');
  });

  test('the report says whether the browser checks ran', async () => {
    expect((await checkFiles(['tests/fixtures/good.html'])).browser).toBe(false);
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
    for (const [option] of guide().matchAll(/--[a-z]+/g)) if (!COMMANDS.has(option)) expect(help, option).toContain(option); // TagAction commands aren't options
  });

  test('generated agent files match llms.txt', () => {
    for (const file of ['ai/claude/tagcheck/SKILL.md', 'ai/cursor/tagcheck.mdc']) expect(readFileSync(file, 'utf8')).toContain(guide().trim());
  });
});

test.describe('the site (index.html)', () => {
  test('lists every rule with its level and description, in order', () => {
    const html = readFileSync('index.html', 'utf8');
    const table = /<caption>Every rule[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(html)[1];
    const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => text(c[1])));
    expect(rows).toEqual(Object.entries(RULES).map(([rule, [level, description]]) => [rule, level, description]));
  });

  test('passes TagCheck', async () => {
    const report = await checkFiles(['index.html']);
    expect(report.files[0].problems).toEqual([]);
  });
});
