---
name: harness-verify
description: Use before saying a coding task is done or opening a pull request, in a repository with a .harness/ folder. Runs the project's checks once and reports what passed, failed or could not be checked.
---

# Check the work before calling it done

## When the task is done

Run `node .harness/bin/harness.mjs verify` once, after the last change. It runs the profile's
format, lint and type checks, and the quick tests if the project set them. It does not run the full
test suite.

- **It passes:** say the task is done and quote its one line.
- **A check fails:** fix the cause and run it again, once. Never weaken a check, skip it or change
  its configuration to make it pass. If it still fails, stop and report the failure with its output.
- **A check could not run** (not found, timed out, needs a shell): say so plainly. It is not a pass.

With Superpowers, this command's output is the evidence `verification-before-completion` asks for:
run it as that evidence, not as a second check.

## Before a pull request

Run `node .harness/bin/harness.mjs verify --full`: it adds the full test suite and the build, and can
take many minutes. The guard asks before `gh pr create` when it did not pass on the current commit.

## What to report

Say what was checked and what was not. A command the profile does not have was not checked: name it
instead of implying it passed.
