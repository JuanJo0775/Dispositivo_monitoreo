# Lens: documentation

Ask whether what is written matches what the code does today.

## Questions

- **Numbers:** counts, limits, timeouts, versions and sizes in the docs: do they match the code and
  the latest test run?
- **Commands:** does every command, flag and path in the docs exist and work as written? Is the help
  of the CLI in step with them?
- **Behavior:** does a described behavior match what the code does, including what happens on error?
- **Limits:** are the known gaps stated where a reader will look for them, not only in a commit
  message?
- **Decisions:** when the change departs from the spec or an ADR, is the departure written down, with
  its reason?
- **Audience:** is each document in the language and for the reader it is meant for?
- **Stale text:** does the change leave a document saying something that is no longer true?

## Not findings

- Wording that is correct and clear but could be phrased differently.
- Missing docs for internal code that no reader outside the module needs.
