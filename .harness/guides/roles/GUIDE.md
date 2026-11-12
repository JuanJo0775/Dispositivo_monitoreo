---
name: roles
when: Designing a feature or an architecture choice, or a decision needs evidence, a critic or questions to the person (the grill).
---

# Roles and the grill

The grill turns a design question into a decision backed by evidence, and sends to the person only
what is theirs to decide.

## The roles

Three read-only subagents, when installed (`.claude/agents/` or `.opencode/agents/`):

| Role | Use it to |
| --- | --- |
| `harness-researcher` | bring evidence for one question: code, ADRs, requirements, docs |
| `harness-critic` | attack a proposal: contradictions, assumptions, edge cases, gaps |
| `harness-reviewer` | run the CTO review of a diff given as a file (guide `cto-review`) |

You stay the implementer. Give each role a narrow brief and the files it needs; a role cannot
start others. No roles installed, or an agent without subagents: play each role yourself, in a
separate pass, and say so in your report.

## Pick the mode

- **Technical** (architecture, data shape, a library, a technical feature): agents against agents.
- **Business or cost** (business rules, money, scope, what users may do): questions to the person.

A question with both parts: settle the technical part first, then ask about the rest.

## Technical mode

1. One or two `harness-researcher`, each with its own question: what the code and the area's ADRs
   say, and which standard or library documentation applies here.
2. Write the proposal: the option, why, and what it costs to undo.
3. Give `harness-critic` the proposal and the evidence.
4. Settle each objection with evidence: change the proposal or answer the objection. One critic
   pass; a second one only when the proposal changed a lot.
5. What is still open and is business or cost goes to the person (business mode). The rest is
   decided: record it under `## Supuestos` in the task file.

## Business or cost mode

1. Read first: the soul, the requirements, the glossary and the code. Never ask what they answer.
2. Ask every question at once, each with a recommended answer and its reason. One batch costs less
   than one question at a time.
3. Do not act on the open part until the person answers.

## In both modes

- A current ADR is not reopened: if the proposal contradicts one, say so and ask.
- Invent edge cases (empty, huge, repeated, concurrent, failing halfway, no permission) and answer
  each one.
- Mark what goes in v1 and what waits.
- A term settled on the way goes into the glossary now (guide `context`).
- A decision that passes the three tests of guide `adr`: offer to record it as an ADR.

## Close

Report the decision, the evidence behind it, each objection and how it was settled, what is in v1,
and the questions still waiting for the person.

Ideas adapted from Matt Pocock's grill-with-docs skill (MIT License).
