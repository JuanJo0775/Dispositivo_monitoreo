# Playbook: refactor

## When

The behavior stays the same; the structure gets better.

## Steps

1. **Context.** Open guide `context` for the area to change.
   Exit: the area and its ADRs are named in the task file.
2. **Pin the behavior.** Run the tests that cover the code; add characterization tests where they
   are missing.
   Exit: they pass, and that baseline is recorded in the task file.
3. **Plan small steps.** Each step leaves the tests green.
   Exit: the list of steps is in the task file.
4. **One step at a time.** Run the tests after each step and commit it.
   Exit: green after every step.
5. **Principles.** Guide `principles`, for each structural claim.
   Exit: each claim has its evidence, or is marked as an opinion.
6. **Verify.** Skill `harness-verify`.
   Exit: verify passes, and its output is quoted.
7. **Review.** Guide `cto-review`, at grande and up, or when a module boundary or a public
   interface moved.
   Exit: no blocking finding stands.

## Stop and ask

- The behavior would have to change: that is a feature or a bug, not a refactor.
- A public interface changes.
- The work grows beyond the planned steps.

## Never

- Change behavior and structure in the same step.
- Edit a test so it fits new behavior.

## Report

The steps done, the baseline and the final test results, and the verify output.
