---
name: docs
when: A change alters visible behavior: a CLI flag or output, an API, a config key, an install step, or a documented number or limit.
---

# Documentation for a change

Documentation that disagrees with the code is worse than none. When a change alters what a person
or another program can see, update the documents that describe it, in the same change.

## What to check

Go through this list and touch only what the change affects:

- **README:** install steps, usage examples, the feature list, stated limits.
- **CLI help and messages:** flags, defaults, exit codes, examples in `--help`.
- **API documentation:** endpoints, parameters, types, errors, examples.
- **Configuration:** new, renamed or removed keys, and their defaults.
- **Changelog:** one entry when the project keeps one, in its existing format.
- **Decisions:** a hard-to-reverse choice gets an ADR (guide `adr`, if installed).
- **Examples and guides:** anything that shows the old behavior.

## Rules

- Check every number, command, path and flag you write against the code or by running it. Do not
  copy them from memory or from the plan.
- Do not create documents the project does not have (a changelog, a docs site, a new guide) unless
  the person asks. Suggest it in one line instead.
- State known limits plainly. A missing limit is a future bug report.
- Write in the language and style the project's documents already use.
- Remove or fix text the change makes false; do not leave it with a note.

## Done

In the task report, list the documents you updated, or say "no visible behavior changed" when that
is true.
