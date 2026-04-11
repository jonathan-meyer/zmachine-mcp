---
description: "Use when generating commit messages for version bumps, changelog updates, or release-related changes"
applyTo: CHANGELOG.md, package.json
---

# Commit Message Guidelines for Version Bumps

When staged changes include a version bump in `package.json` and/or updates to `CHANGELOG.md`:

- Use the format: `chore: bump version to <version>`
- If the changelog was updated in the same commit, do not separately describe the changelog edit — it's implied by the version bump
- Include a brief summary of what the release contains after a blank line, e.g.:

```
chore: bump version to 0.2.0

Added Jest test suite, debug logging, and MongoDB persistence
```

## General commit message rules

- Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Keep the subject line under 72 characters
- Do not repeat filenames — describe the intent of the change
- If only `CHANGELOG.md` is staged (without a version bump), use `docs: update changelog`
