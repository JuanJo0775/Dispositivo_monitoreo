# Lens: architecture

Ask what the change does to the shape of the code, and what that shape will cost later.

## Words used here

- **Module:** anything with an interface and a body: a function, a file, a package.
- **Interface:** what a caller must know to use it. Smaller than the body is better.
- **Deep module:** a small interface over a lot of behavior. A shallow one costs nearly as much to
  learn as to rewrite.
- **Seam:** a place where behavior can change without editing the callers.
- **Locality:** what changes together lives together.

## Questions

- Does each new module hide more than it exposes? A pass-through layer adds cost and no depth.
- Deletion test: if this module were deleted, would its callers get simpler or harder? Simpler means
  it was not paying its way.
- Is there a new seam? It needs two real users (two adapters) now, not one and a guess.
- Did coupling grow? A module now importing internals of another, or a cycle, is a finding.
- Is a decision hard to undo (data format, public API, dependency, file layout)? It needs an ADR.
- Does the change follow the patterns the project already uses? A new pattern needs a reason.
- What breaks first if the load or the data doubles?

## Not findings

- Style the formatter or linter owns.
- A different design that is only a matter of taste, with no cost named.

---
Ideas adapted from Matt Pocock's skills (MIT License).
