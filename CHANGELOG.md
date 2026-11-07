# Changelog

## Unreleased

Knows the vocabulary of TagBrush.css 1.2.0.

- TagBrush.css 1.2.0's chat output: `data-density="compact"` and `<details data-reasoning>` are documented attributes, and classes in GitHub alerts (`markdown-alert`, `markdown-alert-note`, octicon icons), KaTeX (`katex`, `katex-display`, and everything inside them), and MathJax (`mjx-*` elements), and the inline styles KaTeX and MathJax put on their spans, aren't reported.

## 0.1.0 (2026-11-06)

Published as `@kovirlabs/tagcheck` (the unscoped `tagcheck` name on npm belongs to an unrelated package); the command is still `tagcheck`.

First version. Knows the vocabulary of TagBrush.css 1.1.0 and TagAction 0.1.0.

- Static checks, adapted from `npx tagbrush check`: lang, viewport, one `<main>`, alt text, labels, empty buttons and links, fake controls, heading levels, duplicate ids, inline and `<style>` CSS on TagBrush pages.
- New: references to missing ids (`aria-controls`, `commandfor`, `popovertarget`, `list`, `<output for>`, …), unknown `command` values, `--clone` targets, `data-tag-remember` without ids, undocumented Tag family classes and attributes, TagAction runtime markup copied into source.
- Output of Markdown tools is not reported: classes Pandoc, Jekyll (kramdown), and GitHub generate (`sourceCode`, `footnotes`, `task-list`, `highlight`, `language-…`, older Pandoc's `header`/`odd`/`even` on table rows, and Python-Markdown's (MkDocs) `admonition` boxes and `footnote-backref`), classes on `<pre>` and `<code>`, and `text-align` on table cells. Empty links hidden from assistive tech and the keyboard (`aria-hidden="true" tabindex="-1"`, Pandoc's code line anchors) and the disabled task-list checkboxes kramdown (GitHub Pages) and Goldmark (Hugo) generate aren't reported.
- `--browser` skips redirect pages (`<meta http-equiv="refresh">`), which leave before they can be measured.
- `--browser`: WCAG AA text contrast in light and dark mode, and sideways scrolling at phone and desktop widths.
- `--json`, `--strict`, `--ignore`, `--rules`; a JavaScript API.
- `llms.txt`, linked to the Tag family guide, plus a Claude Code skill, a Cursor rule, and an AGENTS.md section generated from it.
