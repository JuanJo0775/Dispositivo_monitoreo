---
name: playbooks
when: A normal or larger task, once its level is set: the steps in order for a feature, bug, refactor, dependency, migration, release or incident.
---

# Playbooks: the steps for each kind of work

Pick the one playbook that matches the task, open only that file, and follow its steps in order.

| Kind | Use when | File |
| --- | --- | --- |
| feature | new behavior: a feature, an endpoint, a screen, a command | [feature.md](feature.md) |
| bug | existing behavior is wrong | [bug.md](bug.md) |
| refactor | same behavior, better structure | [refactor.md](refactor.md) |
| dependency | add, upgrade, replace or remove a dependency | [dependency.md](dependency.md) |
| migration | change stored data, a schema or infrastructure state | [migration.md](migration.md) |
| release | publish a version or deploy; checks [performance.md](performance.md) | [release.md](release.md) |
| incident | something is broken for users now | [incident.md](incident.md) |

Two match (a bug whose fix needs a migration): follow the riskier one, and insert the other's steps
where they fit, before its verify step.

## How to follow a playbook

- Do the steps in order. Start a step only when the previous step's `Exit:` holds.
- A step that names a guide not in the index: do the step without that guide, and say so in the report.
- A playbook never lowers a gate of the change level (see `harness-start`); a level can add steps.
- At a `Stop and ask` point, ask as `harness-start` says, and wait. In a non-interactive run, write
  the questions with your recommended answers and stop there.
- Record each finished step in `.harness/task.md`, so a new session can resume at the next one.
- End with the playbook's `Report`. If guide `memory` is in the index,
  check it for a lesson to propose.
