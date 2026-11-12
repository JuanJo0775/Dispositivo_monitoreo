---
name: harness-start
description: Use at the start of every task or session in a repository that has a .harness/ folder. Loads the project profile, classifies the change level and, from the normal level up, opens .harness/task.md.
---

# Start a task with the harness

## 1. Load the profile

Run `node .harness/bin/harness.mjs detect --check`. Exit 0: the profile is current. Exit 3: run
`node .harness/bin/harness.mjs detect`. Exit 1: show the error (usually an invalid
`.harness/overrides.json`) and ask the person to fix it; do not edit that file, and continue without
the profile. Node or the file missing: say so in your first line and continue without the profile
(degraded mode); do not repair the installation yourself.

Read `.harness/profile.json`; its overrides are already applied. Use its commands exactly; run a
command of a part (`parts`) from that part's folder. A category in `unknowns`: ask, never guess.

## 2. Classify the change

Pick one level and give a one-line reason. When in doubt, go one level up; the person can change it.
Quick mode, if asked: lower the gates one level, except the guard; write `mode: rapido` in the task.

| Level | Typical changes |
| --- | --- |
| trivial | typo, comment, doc text, config with no runtime effect |
| normal | contained bug, feature inside existing patterns, local refactor |
| grande | new module, public API, data model, new dependency, cross-package change, auth |
| riesgoso | migrations, data deletion, infrastructure or production, secrets, permissions, release |

## 3. Guides and task file (normal and above)

Read `.harness/guides/index.md` once and open only the guides this task needs, each at
`.harness/guides/<name>/GUIDE.md`: guide `context` first, then guide `playbooks` for the kind of
work. A guide that is not in the index is not installed: go on without it and say so.

Create `.harness/task.md` from [`.claude/skills/harness-start/task-template.md`](task-template.md):
header, goal, verifiable done criteria. If `.harness/task.md` already exists, read it first: same
task, continue it; another task, ask whether to resume it or move it to `.harness/handoffs/`.

## 4. Decide or ask

- **Ask, and do not act yet,** when the choice touches a business rule, money or costs, something
  hard to reverse, or an ADR or the soul. Ask everything at once, each with a recommended answer.
- **Otherwise propose and continue:** take the option most consistent with the soul and the map (a
  design choice: guide `roles`, the grill), record it under `## Supuestos` in the task file
  (trivial: only in the report) and in your report.

## 5. Gates by level

- **trivial:** run `node .harness/bin/harness.mjs verify` before finishing.
- **normal:** done criteria first; validations from guide `qa`; test first when the profile has a
  test command; `verify` (skill `harness-verify`) before saying it is done, quoting its output.
  Visible behavior changed: guide `docs`.
- **grande:** all of the above, plus a Superpowers design step, a written plan, a worktree, an ADR for
  a decision hard to reverse (guide `adr`), and a CTO review (guide `cto-review`) before closing.
- **riesgoso:** all of the above, plus a rollback plan and explicit confirmation before each action.

The person's instruction comes first, then AGENTS.md, then this harness, then Superpowers. These
skills add gates around Superpowers; they never replace its skills.
