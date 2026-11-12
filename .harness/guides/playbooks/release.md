# Playbook: release

## When

Publish a version or deploy to production: a package, an app build, a tagged release. Level
riesgoso.

## Steps

1. **State.** The main branch is green; list the open pull requests and the changes since the last
   release.
   Exit: the list is in the task file.
2. **Version.** Choose the number by the project's rules (for example semantic versioning).
   Exit: the number and its reason are in the task file.
3. **Notes.** Guide `docs`: the changelog or release notes.
   Exit: the notes match the changes listed in step 1.
4. **Review.** Guide `cto-review` on the changes since the last release that no review covered.
   Exit: no blocking finding stands.
5. **Performance.** Go through [performance.md](performance.md) for the layers this release
   touches.
   Exit: each finding is in the task file with its evidence and a proposed fix, or none applies.
6. **Rollback plan.** How to undo a bad release: ship the previous version again, deprecate or
   unpublish, as the registry allows.
   Exit: the rollback plan is in the task file.
7. **Verify.** Skill `harness-verify`, with `--full`.
   Exit: verify passes on the commit to release, and its output is quoted.
8. **OK.** The person approves the version, the notes and the rollback plan.
   Exit: the OK is recorded in the task file.
9. **Publish.** With the project's own command, exactly as approved.
   Exit: published, and the command output is quoted.
10. **Check.** Install or open the published artifact.
   Exit: it is the new version and it works; if not, apply the rollback plan, with the person's OK.

## Stop and ask

- Before publishing (step 8).
- Anything failing, or a change in the list that nobody reviewed.

## Never

- Publish with a failing check.
- Move, retag or force-push a published tag.
- Put secrets or local files in the artifact.

## Report

The version, the notes, the review, the performance findings, the verify output, the rollback plan and the result of the check.
