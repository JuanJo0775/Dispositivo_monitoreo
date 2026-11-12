---
name: cto-review
when: Opening a pull request, writing an ADR, a grande or riesgoso change, or when the person asks for a CTO or architecture review.
---

# CTO review: one review, with the lenses the change needs

A CTO review asks what a change costs to keep: risk, coupling, debt, how hard it is to undo. It is
not a second correctness review. It rides on the same review pass, so the change is read once.

## When

- A pull request is about to be opened.
- An ADR is being written or changed.
- The change is `grande` or `riesgoso` (see `harness-start`).
- The person asks for it, at any level.

At `trivial` and `normal` the level alone does not start it, since it costs a full read of the
change; a pull request, an ADR or a request from the person still does.

One review per change: if a CTO review already covered this diff range (for example when a `grande`
task closed), the pull request reuses its report. Review again only what changed since.

## 1. Pick the lenses

Read only the lens files the change touches:

- [lens-architecture.md](lens-architecture.md): modules, interfaces, dependencies, data shapes or
  module boundaries changed.
- [lens-security.md](lens-security.md): input from outside, commands run, files or paths handled,
  secrets, permissions, network, or a new dependency.
- [lens-documentation.md](lens-documentation.md): documents, CLI help, messages or described
  behavior changed.

If no lens applies, say so in the report: the review is correctness only.

## 2. Run one review

- **`harness-reviewer` is installed** (`.claude/agents/` or `.opencode/agents/`): it is the reviewer
  subagent in every case below. Write the diff with `git diff --output=.harness/review.diff
  <base>...HEAD`, give it that file, the spec or ADR and the chosen lens files, and delete the file
  when its report is back. It runs no commands: reproduce yourself a finding that needs a run.
- **Superpowers is installed:** use `superpowers:requesting-code-review` as it says, with `harness-reviewer`
  as its reviewer when installed. Add to the reviewer's brief the principles below and the text of
  each chosen lens. Do not start a second reviewer for the CTO part. You write the report below from
  its answer: Critical is blocking, Important is important, Minor is a note.
- **No Superpowers:** start one subagent with a clean context, on the most capable model, with the
  diff range, the spec or ADR it implements, the principles and the chosen lenses.
- **No subagents in this agent:** do the review yourself, after the work, as a separate pass. Label
  it `self-review` in the report: an author reviewing their own work misses what they missed while
  building it.

## 3. Reviewer principles

1. Read only. The reviewer does not edit what it judges.
2. Clean context: no memory of how the change was built.
3. Each finding names the written rule it breaks (spec, ADR, AGENTS.md, a lens). With no rule, it is
   an opinion and is marked as one.
4. A blocking finding points to `file:line` or a command that reproduces it. Otherwise it is a note.
5. When unsure, it is a note. "No findings" is a valid result.
6. A check that could not run counts as blocked, never as passed. What was already broken before the
   change does not block it.
7. Keep the inner view (the code) apart from the outer one (scope, hygiene, and whether what the
   PR description claims is true of the diff).

## 4. Report

```text
CTO review: <pass | blocked>   (<self-review> when no subagent was used)
Lenses: <architecture, security, documentation | no lens applies>
Blocking: <n>   Important: <n>   Notes: <n>

- [blocking] file:line: what fails, and the rule it breaks
- [important] ...
- [note] ...

Not reviewed: <what was out of reach, and why>
```

`blocked` when any blocking finding stands. Fix blocking and important findings in one pass, each
with a test that fails first; notes go to the task's pending list.
