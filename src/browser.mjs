// Browser checks: render each page and measure what source code can't show.
// - contrast: every visible piece of text meets WCAG AA (4.5:1) in the light
//   and the dark color scheme.
// - overflow: the page doesn't scroll sideways at a phone width.
// Needs Playwright (`npm install -D playwright` and `npx playwright install chromium`).

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PHONE_WIDTH = 360;
export const DESKTOP_WIDTH = 1280;

async function loadPlaywright() {
  const require = createRequire(join(process.cwd(), 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try {
      return await import(pathToFileURL(require.resolve(name)).href);
    } catch { /* try the next one */ }
  }
  for (const name of ['playwright', '@playwright/test']) {
    try { return await import(name); } catch { /* not installed next to TagCheck either */ }
  }
  throw new Error('Browser checks need Playwright: npm install -D playwright && npx playwright install chromium');
}

// Pages link the family's CDN files. Serve an installed copy when there is
// one, so checks work offline and test the version the project uses.
function localCopies() {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const routes = [];
  for (const [pattern, name, file, contentType] of [
    [/cdn\.jsdelivr\.net\/npm\/tagbrush@[^/]+\/tagbrush(\.min)?\.css/, 'tagbrush', 'tagbrush.css', 'text/css'],
    [/cdn\.jsdelivr\.net\/npm\/tagaction@[^/]+\/tagaction(\.min)?\.js/, 'tagaction', 'tagaction.js', 'text/javascript'],
  ]) {
    try {
      const path = join(require.resolve(`${name}/package.json`), '..', file);
      if (existsSync(path)) routes.push({ pattern, path, contentType });
    } catch { /* not installed: load it from the CDN */ }
  }
  return routes;
}

// Runs in the page: text elements whose contrast is below 4.5:1.
function lowContrast() {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (color) => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => top.slice(0, 3).map((c, i) => c * top[3] + bottom[i] * (1 - top[3])).concat(1);
  // What's behind a transparent page: the browser's canvas color, which is
  // dark in dark mode when the page opts into it with color-scheme.
  const probe = document.documentElement.appendChild(document.createElement('div'));
  probe.style.cssText = 'background-color: Canvas !important; display: block !important';
  const canvas = over(rgba(getComputedStyle(probe).backgroundColor), [255, 255, 255, 1]);
  probe.remove();
  const backdrop = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const bg = rgba(getComputedStyle(node).backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] === 1) break;
    }
    return layers.reduceRight((below, layer) => over(layer, below), canvas);
  };
  const luminance = ([r, g, b]) => {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  // Visible elements with their own text. Disabled controls are exempt under WCAG.
  const texts = [...document.body.querySelectorAll('*')].filter((el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
    el.checkVisibility() && !el.closest(':disabled, [aria-disabled="true"], dialog:not([open]), [popover]:not(:popover-open)'));
  return texts.map((el) => {
    const bg = backdrop(el);
    const fg = over(rgba(getComputedStyle(el).color), bg);
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return { text: `<${el.localName}> ${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}`, ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 };
  }).filter((r) => r.ratio < 4.5);
}

/** Render each file and return { [file]: problems } for contrast and overflow. */
export async function checkInBrowser(files) {
  const playwright = await loadPlaywright();
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  const browser = await chromium.launch();
  const routes = localCopies();
  const results = {};
  try {
    for (const file of files) {
      const problems = [];
      const report = (rule, message) => problems.push({ line: null, column: null, level: 'error', rule, message });
      const url = pathToFileURL(resolve(file)).href;
      // A redirect page (<meta http-equiv="refresh">, as Hugo and Jekyll write for moved
      // pages) leaves before it can be measured; its static checks still apply.
      if (/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(readFileSync(file, 'utf8'))) {
        results[file] = problems;
        continue;
      }
      for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: DESKTOP_WIDTH, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
        for (const { pattern, path, contentType } of routes) await page.route(pattern, (route) => route.fulfill({ path, contentType }));
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForTimeout(50); // let scripts like TagAction finish enhancing
        for (const { text, ratio } of await page.evaluate(lowContrast)) {
          report('contrast', `${text}: contrast ${ratio}:1 in ${scheme} mode, needs 4.5:1`);
        }
        if (scheme === 'light') {
          for (const width of [PHONE_WIDTH, DESKTOP_WIDTH]) {
            await page.setViewportSize({ width, height: 900 });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (overflow > 0) report('overflow', `the page is ${overflow}px wider than a ${width}px screen and scrolls sideways`);
          }
        }
        await page.close();
      }
      results[file] = problems;
    }
  } finally {
    await browser.close();
  }
  return results;
}
