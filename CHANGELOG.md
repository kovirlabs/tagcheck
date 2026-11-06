# Changelog

## 0.1.0 (unreleased)

First version. Knows the vocabulary of TagBrush.css 1.1.0 and TagAction 0.1.0.

- Static checks, adapted from `npx tagbrush check`: lang, viewport, one `<main>`, alt text, labels, empty buttons and links, fake controls, heading levels, duplicate ids, inline and `<style>` CSS on TagBrush pages.
- New: references to missing ids (`aria-controls`, `commandfor`, `popovertarget`, `list`, `<output for>`, …), unknown `command` values, `--clone` targets, `data-tag-remember` without ids, undocumented Tag family classes and attributes, TagAction runtime markup copied into source.
- `--browser`: WCAG AA text contrast in light and dark mode, and sideways scrolling at phone and desktop widths.
- `--json`, `--strict`, `--ignore`, `--rules`; a JavaScript API.
- `llms.txt`, plus a Claude Code skill, a Cursor rule, and an AGENTS.md section generated from it.
