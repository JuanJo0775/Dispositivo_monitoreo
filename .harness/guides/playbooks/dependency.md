# Playbook: dependency

## When

Add, upgrade, replace or remove a dependency. Adding, replacing or a major upgrade is level grande;
a minor or patch upgrade, or a removal, is level normal.

## Steps

1. **Context.** Open guide `context` for the area that uses it.
   Exit: the area and its ADRs are named in the task file.
2. **Evidence.** Guide `roles`: the need, the alternatives (including none, or writing it by
   hand), license, maintenance, size and known security advisories.
   Exit: the comparison is in the task file, each fact with its source.
3. **ADR.** To add, replace or take a major upgrade: guide `adr`. A minor or patch upgrade, or a
   removal: record the choice under `## Supuestos` in the task file instead.
   Exit: the ADR is proposed with the alternatives, or the assumption is recorded.
4. **OK.** To add, replace or take a major upgrade, the person approves the ADR.
   Exit: the OK is recorded in the task file, or the change is one recorded as an assumption.
5. **Change behind tests.** At grande, in a worktree (`superpowers:using-git-worktrees`). Tests
   for the code that uses it first, then the change.
   Exit: the tests failed first where behavior is new, and pass now.
6. **Review.** Guide `cto-review`, at grande.
   Exit: no blocking finding stands.
7. **Docs.** Guide `docs`: install steps and requirements.
   Exit: the docs match.
8. **Verify.** Skill `harness-verify`, with `--full`, after the last change.
   Exit: verify passes on the final commit, and its output is quoted.

## Stop and ask

- Before adding, replacing or taking a major upgrade (step 4).
- A license that may not fit the project, or an open security advisory.

## Never

- Add a dependency without the person's OK.
- Upgrade several major versions in one change.
- Copy third-party code into the project without its license.

## Report

The dependency and version, the alternatives weighed, the ADR or the assumption, and the verify
output.
