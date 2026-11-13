# TagCheck

Use TagCheck when you want to catch semantic and accessibility mistakes in HTML (missing alt text and labels, fake buttons, skipped headings, broken id references, low contrast, sideways scrolling on phones) from the command line, in CI, or from an AI agent.

```sh
npx @kovirlabs/tagcheck page.html
```

```
page.html:12:3  error    missing-alt        <img src="photo.jpg"> needs alt text (alt="" if it's decorative)
page.html:20:3  error    broken-reference   aria-controls="menu" on <button> points to an id that doesn't exist
page.html:26:3  warning  unknown-class      class="hero" isn't part of TagBrush.css or TagAction: semantic HTML usually does the job
1 file checked: 2 errors, 1 warning
```

TagCheck is part of the Tag family with [TagBrush.css](https://github.com/kovirlabs/tagbrush) (classless CSS) and [TagAction](https://github.com/kovirlabs/tagaction) (behaviors for semantic tags). It knows their documented classes, attributes, and commands, so it can tell an invented `data-tag-sortable` or `class="hero"` from the real ones. It works on any HTML page, with or without them.

## Why

An agent that can't look at a screen can still run a command. TagCheck gives it the same feedback a person gets from looking at the page: write the page, run `npx @kovirlabs/tagcheck page.html --json`, fix what it reports, repeat until clean.

## Options

| Option | |
| --- | --- |
| `--json` | Machine-readable report: `{ tool, version, errors, warnings, files: [{ file, problems: [{ line, column, level, rule, message }] }] }` |
| `--browser` | Also render each page in Chromium to check text contrast (WCAG AA: 4.5:1, or 3:1 for large text) in light and dark mode, and sideways scrolling at 360px and 1280px. Needs Playwright: `npm install -D playwright && npx playwright install chromium` |
| `--strict` | Fail (exit code 1) on warnings too |
| `--ignore=a,b` | Skip rules |
| `--rules` | List every rule |

Exit codes: 0 clean, 1 problems, 2 bad usage.

With `--browser`, pages that link TagBrush.css (any build, including the scoped and Shadow DOM ones) or TagAction from jsDelivr are served the copy installed in your project, if there is one, so the check works offline and tests your version. A stylesheet or script that still doesn't load is reported (`not-loaded`), since contrast and widths measured without it mean little, and the summary (or `"browser": true` in the JSON) says the browser checks ran. Photos from other sites aren't downloaded: they get a blank stand-in of the same size, so a slow image host doesn't slow the checks.

## Rules

Run `npx @kovirlabs/tagcheck --rules`, or see [`llms.txt`](llms.txt), which explains each rule and its fix.

## In CI

```yaml
- run: npx @kovirlabs/tagcheck site/ --strict
```

## From code

```js
import { check, checkFiles } from '@kovirlabs/tagcheck';

check('<img src="a.png">');                      // problems in one HTML string
await checkFiles(['site/'], { browser: true });  // the --json report for files and folders
```

## Where it came from

The static checks grew out of `npx tagbrush check`, and the browser checks out of the tests that score TagBrush's agent-written eval pages. `npx tagbrush check` stays in TagBrush; TagCheck is the full tool.

## Development

```sh
npm install
npm run build   # ai/ instruction files from llms.txt
npm test
```

The tests check every rule, the command line, the `--browser` checks, that `llms.txt` lists exactly the rules TagCheck has, that its vocabulary matches TagBrush's and TagAction's `llms.txt`, and that the family's own demo and eval pages are clean.

## License

Apache-2.0
