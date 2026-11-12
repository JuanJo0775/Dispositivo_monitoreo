---
name: adr
when: A decision is hard to reverse: framework, database, external service, auth, public contract, data model, module boundary, build, deploy, security.
---

# Architecture decision records

An ADR keeps the *why* of a decision that will be expensive to undo, so the next person (or agent)
does not reopen it blind. Write one only when it earns its place.

## Does it need an ADR?

All three must be true:

1. **Hard to reverse.** Undoing it later means a migration, a rewrite or broken users.
2. **Someone will ask why.** A reader of the code could not guess the reason.
3. **There were real alternatives.** You weighed at least one other option that could have worked.

Typical cases: choosing or replacing a framework, database, external service or auth model; changing
a public contract or the data model; drawing a boundary between modules; changing how the project
builds or deploys; any decision with security impact.

## What is not an ADR

- Bug fixes, and refactors that stay inside one module.
- Configuration tweaks, version bumps without behavior change, naming.
- Task notes, plans or meeting minutes: those belong in the task file or the plan.
- A decision nobody could reasonably have made differently.

If in doubt, say in one line why it does not qualify and move on.

## Where

- Use the folder the project already has for decisions (`docs/adr`, `docs/decisions`, `adr`, ...).
  Look before creating one.
- With none, propose `docs/adr` to the person.
- Name files `NNNN-short-title.md`, numbered after the highest existing one. Follow the project's own
  naming if it differs.
- If the project uses its own ADR tool or format, use that instead of this guide's template.

## How

1. Draft it from the agreed design or the person's request, with status `proposed`. Use
   [the template](adr-template.md).
2. Keep it short: the decision fits in a few sentences; alternatives get one or two lines each with
   why they lost.
3. The person accepts it. Only then set the status to `accepted`.
4. An accepted ADR is not edited for substance. To change course, write a new ADR and mark the old
   one `superseded by NNNN`; update both index lines. Typos and broken links can be fixed in place.
5. Link the ADR from the change that implements it (commit, pull request or task file).

## Index

Add one line for the new ADR to the folder's index (usually a `README.md` there): number, title,
status and area. The area is one of the areas in the project's context map (guide `context`), so
an agent can find the ADRs of its area without opening them all; with no map, leave it empty. Older
ADRs get their area when someone next edits them. Keep the existing format. If there is no index, you may create one; if the project keeps
its index elsewhere or generates it with its own tool, follow that. The index is a convenience, not
a gate: never block a task on it.

## With a CTO review

When guide `cto-review` is installed, writing an ADR starts a CTO review of the change; it checks
the ADR against the existing ones. One ADR per decision; a pull request can carry several.
