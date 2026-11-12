---
name: greenfield
when: A new or half-started project, after init --new: inventory what exists, interview, context, stack ADR, the fixed minimum and a first commit.
---

# Greenfield: start a project from what already exists

Level grande. Build only what is missing: never overwrite a file that already exists; propose how to
complete it instead. The stack, the soul and the business rules belong to the person.

## Steps

1. **Inventory.** Check each piece: git and its remote, README, source code, the stack's manifest,
   tests, CI, `.env.example`, project rules in `AGENTS.md` (outside the harness block),
   `docs/context/` and `docs/adr/`. Mark each one present, partial or missing.
   Exit: the inventory is in `.harness/task.md`.
2. **Interview.** One round, all at once, each question with a recommended answer, and only what
   the inventory did not answer: goal and users, stack (language, framework, package manager) and
   why, constraints (hosting, budget, deadlines, compliance), risk level, CI platform, business
   rules. In a non-interactive run, write the questions with your recommendations and stop here.
   Exit: the answers are in the task file.
3. **Context.** Guide `context`: draft the soul, glossary and map from the answers.
   Exit: the files are written with the person's OK, or the person declined.
4. **Stack ADR.** Guide `adr`: the stack chosen, the options weighed and why (ADR 0001, or the next
   number if ADRs exist).
   Exit: the ADR is accepted by the person.
5. **Fixed minimum.** Create only what the inventory marked missing, and complete what is partial:
   - the stack's own scaffold, with its own init command. Some overwrite a folder that is not
     empty (create-vite, `dotnet new --force`): run it in an empty temp folder and copy in only
     what is missing, or use its no-overwrite option; then check `git status` and restore
     anything that existed;
   - a README: what it is, how to install, run and test it;
   - `.env.example`: every variable the code reads, with empty or fake values, never a real one;
   - one passing test with the stack's test runner;
   - CI on the chosen platform, running the project's test and lint commands;
   - project rules in `AGENTS.md`, outside the harness block: commands, layout, conventions.
   Exit: each piece is present, and nothing that existed was replaced.
6. **Profile.** Run `node .harness/bin/harness.mjs detect`. A command it cannot see goes to
   `.harness/overrides.json` only with the person's OK: that file is theirs.
   Exit: the profile lists the test command, or the gap is in the report.
7. **Verify.** Skill `harness-verify`, with `--full`.
   Exit: verify passes, and its output is quoted.
8. **First commit.** If git was initialized during the start, the hook is not there yet:
   run init again (`node .harness/bin/harness.mjs init`), then confirm `doctor` passes.
   Show the file list and the message; commit only with the person's OK. The pre-commit hook
   runs. Never push or create a remote without an explicit OK.
   Exit: the commit exists, or the person declined.
9. **Close.** Propose `node .harness/bin/harness.mjs init --without greenfield`: the start is done.
   Exit: proposed in the report.

A step that names a guide not in the index: do the step without that guide, and say so.

## Stop and ask

- After the interview (step 2), before anything is built.
- Before writing the context, the ADR, the overrides and the first commit.
- Anything already present that conflicts with the answers.

## Never

- Overwrite or delete a file that existed before the start.
- Invent a business rule, a user or a price.
- Put a real secret in `.env.example` or in any file.
- Add a dependency beyond the stack's minimum without the person's OK (playbook `dependency`).

## Report

The inventory, the answers, what was created and what was kept, the detected profile, the verify
output, the commit and the proposal to remove the guide.
