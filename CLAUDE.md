# CLAUDE.md

Guidance for Claude Code working in kovirlabs/tagcheck. See the Tag Family Ecosystem Spec (section 6) for the plan.

## What this project is

TagCheck is a CLI, CI tool, and JavaScript API that scans HTML and reports semantic and accessibility mistakes, in human-readable text and JSON, so an agent can write a page, run TagCheck, and fix the results without a person.

## Rules

- No runtime dependencies for the static checks. Playwright is an optional peer dependency, used only by `--browser`.
- Every problem has a stable `rule` id, a level (`error` or `warning`), and a message that says how to fix it. Changing a rule id is a breaking change.
- Errors are things that are wrong for every page (accessibility, broken references). Warnings are Tag family style advice. Don't make advice an error.
- No false positives on the family's own pages: the TagBrush eval pages and starter, and TagAction's demo and fixtures, must stay clean (tested).
- `src/vocabulary.mjs` must match TagBrush's and TagAction's `llms.txt` (tested). When either library documents something new, update it here.
- Never edit `ai/` by hand; it's generated from `llms.txt`. Every rule and option must be in `llms.txt` (tested).
- Each README starts with a one-sentence "Use this when" statement.

## Workflow

- Run `npm test` before every commit.
- Small, focused PRs with a CHANGELOG entry. Update README and `llms.txt` in the same PR as a rule.
- When unsure whether something belongs in TagCheck, TagBrush, TagAction, or TagKit, check the spec and ask before building.
