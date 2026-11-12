<!-- harness:start -->
## Engineering harness

- Start every task with the `harness-start` skill: it loads `.harness/profile.json` and sets the
  change level.
- Guides for context, ADRs, QA, review, docs and design decisions (grill): `.harness/guides/index.md`; open only what you need.
- Test, lint, format, typecheck and build commands come from the profile. Do not invent one the
  profile marks as unknown; ask.
- A task is not done until `node .harness/bin/harness.mjs verify` passes (skill `harness-verify`).
- Never read, print or commit secrets: `.env*` (except `.env.example`), keys, certificates and
  `secrets/` folders. Use the example file or run the command that needs them without showing them.
- Propose changes to this file and to agent configuration; do not make them on your own.
<!-- harness:end -->
