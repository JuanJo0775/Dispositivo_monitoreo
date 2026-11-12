# Playbook: bug

## When

Existing behavior is wrong: a report, a failing check, a wrong result.

## Steps

1. **Context.** Open guide `context` for the area of the bug.
   Exit: the area and its ADRs are named in the task file.
2. **Reproduce.** Write a failing test that shows the bug; a command that reproduces it only when
   a test is not possible.
   Exit: it fails for the reported reason, and you saw it fail.
3. **Find the cause.** `superpowers:systematic-debugging`; only without Superpowers, the diagnostic
   loop of guide `qa`; with neither, one hypothesis at a time, each checked with evidence.
   Exit: the root cause is stated with its evidence (`file:line`).
4. **Fix the cause, not the symptom.**
   Exit: the failing test passes, and no other test was changed to pass.
5. **Siblings.** Look for the same mistake elsewhere in the code.
   Exit: each one found is fixed with its test, or listed as pending.
6. **Docs.** Guide `docs`, when the fix changes visible behavior.
   Exit: the docs match, or the report says nothing visible changed.
7. **Verify.** Skill `harness-verify`, after the last change.
   Exit: verify passes on the final commit, and its output is quoted.

## Stop and ask

- The fix changes a business rule or data already stored (stored data: add the migration playbook).
- The cause is still unknown after the diagnostic loop.
- The expected behavior itself is unclear.

## Never

- Fix before the bug is reproduced.
- Delete, skip or loosen a test to make it pass.
- Widen the change beyond the bug and its siblings.

## Report

The cause, the fix, the test that proves it, the siblings found, and the verify output.
