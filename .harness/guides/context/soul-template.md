# Soul of <project>

<!-- Keep this file at 80 lines or less. Agents read it whole at the start of most tasks. -->

## Purpose

What the project does and why it exists, in two or three sentences.

## Users

Who uses it, and what they need from it most.

## Non-negotiable rules

Business rules an agent must never bend or guess. One line each, concrete:

- Example: only the finance team can issue a refund, and only within 30 days of payment.
- Example: prices are stored in cents; never use floating point for money.

## Quality bar

What "done" means here beyond passing tests: performance, accessibility, support for old clients,
test coverage expectations. Say what matters for this project, not everything that could.

## Standards that apply

Only the standards this project actually follows, and where. Grounded, not idealized:

- Example: ISO 25010 for reliability and security only.
- Example: OWASP ASVS level 1 for the public API.

## Where requirements live

- Repository: `docs/requirements/` (or where they are).
- Outside the repository: Notion page, issue tracker, design files. Name them so an agent with
  access can read the page for its area, and one without access knows to ask.

## Decisions an agent must ask about

Beyond business rules and money, anything specific to this project that always needs the person.
