# Performance check before a release or deploy

Used by the `release` playbook. Go through only the layers this release touches, and only the items
that apply to this stack. Measure first: a finding needs evidence (a query plan, a trace, a profile,
a timing, `file:line`), never a guess. Report each finding with its evidence and a proposed fix; it
blocks the release only when the soul, an ADR or the person says so.

Never add a tool on your own (a cache, a queue, a CDN, a tracer): that is the `dependency` playbook
and the person's OK.

## Data and backend

- No N+1 queries: one query per list, not one per row (guide `principles` has the pattern).
- Lists are paginated; queries ask only for the columns they use.
- The most frequent queries have an index; check with the database's query plan.
- Connections come from a pool, not one per request.
- Every call to an outside service has a timeout, and a retry only where the call is safe to repeat.
- Independent calls run in parallel; the same call is not made twice for one request.
- Slow work (email, reports, imports) goes to a job queue instead of the request.
- Hot read data is cached only with a measured need and a written rule for when it expires.
- The server runs close to its database.
- Unused dependencies are removed.

## Web frontend

- Search and autocomplete wait for a pause in typing (debounce) before calling the server.
- Pages render on the server or at build time where the content allows it.
- JavaScript is split by page; third-party scripts load after the page.
- Images below the fold load lazily; fonts are self-hosted, with few weights.
- Long lists are virtualized; components do not re-render without a change.
- The interface updates before the server answers where a failure can be undone; AI answers stream.

## Delivery

- Static files are compressed (Brotli or gzip), cached by the browser and served from a CDN when the
  project has one.
- Traffic is spread across instances when one is not enough.

## Watching

- Slow requests can be traced (OpenTelemetry or the stack's own tracer).
- Real users' speed is watched, and the release is tried on a phone and a slow network when it has a
  web interface.
