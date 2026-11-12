# Map of the project

One row per area. An agent reads this table, picks the area its task touches and opens only that
row's paths. Sub-areas are written `parent/child`.

| Area | Code | ADR | Requirements |
| --- | --- | --- | --- |
| billing | src/billing, src/shared/money.ts | docs/adr/0003-money-in-cents.md | docs/requirements/billing.md |
| billing/invoices | src/billing/invoices/** | 0003 | Notion: Invoices page |
| auth | src/auth | docs/adr/0005-sessions.md | - |

## Rules

- Several paths in one cell are separated by commas.
- Globs (`**`, `*`) are fine; they are not checked.
- Plain paths start at the repository root. A Markdown link starts at this file's folder, as when
  you click it (`[0003](../adr/0003-money-in-cents.md)`). A bare ADR number like `0003` is not
  checked. Path case must match the disk exactly.
- `harness doctor` reports every literal path in the Code and ADR columns that does not exist, and
  any path outside the project. Fix the row in the same change that moves the code.
- The ADR index has an Area column with these same area names, so both point at each other.
