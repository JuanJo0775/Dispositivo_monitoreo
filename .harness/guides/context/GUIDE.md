---
name: context
when: Start of a normal or larger task: read the soul and only the map area it touches; or set up docs/context.
---

# Project context

The context says what the project is, which rules are not negotiable, and where each part of it
lives. It lets you act on your own without guessing, and without reading the whole repository.

## Where

`docs/context/`, or the folder named by `context` in `.harness/overrides.json`. It holds three files
the person owns: `soul.md`, `glossary.md` and `map.md`.

## Read, in this order

1. **`soul.md`**, whole: it is short. It holds the purpose, the users, the non-negotiable business
   rules, the quality bar and the standards that apply to this project.
2. **`map.md`**: pick the area the task touches (`parent/child` rows are sub-areas) and say which
   in one line. If no row fits, say so and pick the nearest.
3. **Only that area's rows:** its code paths, its ADRs and its requirements. Never read every ADR;
   open another area only when the task crosses into it, and say why.
4. **`glossary.md`** when a domain term is unclear, or before naming something new.

If the soul points to an outside source (Notion, a wiki, issues) and you have access to it, read only
the pages for this area. Without access, say so and work from the repository. Never invent what a
source you could not read would say.

## When something does not fit

- The task contradicts the soul or an ADR of the area: stop and ask before acting, quoting both.
- The map is missing a path you touch, or lists one you move or delete: propose the corrected row in
  the same change.
- A term is resolved during the task: add it to the glossary in the same change.

## First use: no context folder

Offer to create it from the templates: [soul](soul-template.md), [glossary](glossary-template.md)
and [map](map-template.md).

1. Read what the repository already says: README, docs, folder layout, existing ADRs.
2. Draft what you can from that, marked as a draft.
3. Ask, all at once, only what the repository does not answer, each with a recommended answer.
   Business rules, money and users come from the person: never invent them.
4. Write the files only with the person's OK. They own them from then on.
   In an autonomous or non-interactive run there is no OK to get: the draft goes in your reply, and
   no file is written.

If the person declines, continue without a context folder and do not offer again in this task.
