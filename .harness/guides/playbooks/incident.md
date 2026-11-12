# Playbook: incident

## When

Something is broken for users now: an outage, wrong data, a security event. Level riesgoso.

## Steps

1. **Assess, read only.** What is broken, since when, and who is affected.
   Exit: a short summary in the task file, with its evidence (logs, errors, times).
2. **Tell the person.** The summary and the options: roll back, turn a feature off, or a hotfix.
   Exit: the person chose an option.
3. **Mitigate first.** The chosen option, with the smallest change that stops the damage.
   Exit: the impact stopped, confirmed by a check.
4. **Root cause.** After the mitigation, follow the bug playbook.
   Exit: the cause is known and its fix has a test.
5. **Write it down.** Timeline, cause, fix and how to prevent it; guide `docs` says where.
   Exit: the note is written, or it is in the report when the project keeps none.

## Stop and ask

- Before every action on production.
- Suspected data loss or a security breach: the person decides who else must know.

## Never

- Debug in production with actions that write.
- Delete logs or other evidence.
- Leave the timeline out of the report.

## Report

The timeline, the impact, the mitigation, the root cause, and what prevents it from happening again.
