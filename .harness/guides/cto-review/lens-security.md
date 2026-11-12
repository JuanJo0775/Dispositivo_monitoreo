# Lens: security

Ask what an input the code does not control can make it do.

## Questions

- **Untrusted input:** where does data from outside enter (user, network, files, other repos,
  environment, agent output)? Is it checked before it is used, and checked against what is allowed,
  not against a list of what is bad?
- **Commands:** is anything run through a shell with text that came from outside? Prefer a list of
  arguments with no shell.
- **Paths:** can a path from input reach outside the folder it should stay in (`..`, absolute paths,
  links)? Is it checked after it is resolved, not before?
- **Secrets:** can a key, token or `.env` value reach a log, an error message, a commit, a fixture or
  a prompt?
- **Permissions:** does the change widen what a user, a token or a process may do? Is the default the
  narrow one?
- **Trust in stored state:** does the code trust a file or record that someone else can edit (a
  manifest, a cache, a config) to decide what to delete, run or allow?
- **Dependencies:** is a new package needed, maintained and pinned? Does it run code at install time?
- **Failure:** when a check fails or cannot run, does the code deny, or does it let the action
  through?

## Not findings

- A threat that needs someone who already controls the machine or the repository, unless the change
  makes it easier.
- A theoretical issue with no path from an input to the harm.
