# Playbook: feature

## When

New behavior: a feature, an endpoint, a screen, a command, an option.

## Steps

1. **Context.** Open guide `context`: the soul and only the map area the feature touches.
   Exit: the area, its ADRs and its requirements are named in the task file.
2. **Grill.** Open guide `roles` and settle the design in the mode it needs.
   Exit: a proposal with its evidence; every business question has the person's answer.
3. **ADR.** A decision that passes the tests of guide `adr` gets one.
   Exit: the ADR is written, or the task file says why none is needed.
4. **Design and plan.** Level grande and up: `superpowers:brainstorming`, then
   `superpowers:writing-plans`, and a worktree (`superpowers:using-git-worktrees`); without
   Superpowers, the design and the plan go in the task file. Level normal: done criteria there.
   Exit: the plan or the criteria are written; at grande and up, the person approved the design.
5. **Build, test first.** `superpowers:test-driven-development`, one behavior at a time.
   Exit: each new behavior has a test that failed first and passes now.
6. **Verify.** Skill `harness-verify`.
   Exit: verify passes, and its output is quoted.
7. **QA.** Guide `qa`: the validations for this kind of change.
   Exit: each validation passed or is in the findings ledger.
8. **Review.** Guide `cto-review`, at grande and up or before opening a pull request.
   Exit: no blocking finding stands.
9. **Docs.** Guide `docs`, when visible behavior changed.
   Exit: the docs match the code, or the report says nothing visible changed.
10. **Hand over.** Run `node .harness/bin/harness.mjs verify --full` on the final commit, then
    open the pull request only with the person's OK.
    Exit: `verify --full` passes on the final commit, and the pull request is open, saying what
    changed and how it was verified.

## Stop and ask

- A business rule, money, scope or something hard to reverse that the documents do not settle.
- The design contradicts an ADR or the soul.
- Before opening the pull request.

## Never

- Write code before the done criteria exist.
- Add a dependency inside a feature: follow the dependency playbook for it.
- Say it is done without the verify output.

## Report

What changed, the evidence (tests, verify output, review), the decisions and the assumptions
(`## Supuestos`), and what is still pending.
