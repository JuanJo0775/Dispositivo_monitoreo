# Playbook: migration

## When

Change stored data or a schema, move data, or change infrastructure state. Level riesgoso.

## Steps

1. **Context.** Open guide `context` and the ADRs of the data or system involved.
   Exit: the area, its ADRs and who uses the data are named in the task file.
2. **Plan four things.** The change, a dry run, a rollback, and how to check the result.
   Exit: all four are written in the task file.
3. **ADR.** Guide `adr`, when the change is hard to reverse.
   Exit: the ADR is written, or the task file says why none is needed.
4. **Review.** Guide `cto-review` on the plan and the migration code.
   Exit: no blocking finding stands.
5. **OK.** The person approves the plan.
   Exit: the OK is recorded in the task file.
6. **Dry run.** On a copy, or with the tool's dry-run mode; try the rollback there too.
   Exit: the dry run output matches what the plan expects, and the rollback works.
7. **Apply.** One irreversible action at a time, with explicit confirmation before each.
   Exit: each action confirmed, run and checked.
8. **Check.** Compare the result with the plan; keep the rollback ready until the person closes it.
   Exit: the check passes, and the person says the rollback can go.
9. **Verify.** Skill `harness-verify`.
   Exit: verify passes, and its output is quoted.

## Stop and ask

- Before each irreversible action.
- Any difference between the dry run and the plan.
- Data that looks lost, duplicated or different from what the plan expected.

## Never

- Skip the dry run or the rollback.
- Run against production without the person's OK for that exact action.
- Delete the source data in the same step that copies it.

## Report

What was applied, the dry run output, the checks, and the state of the rollback.
