---
description: "Bump the project version: determine the appropriate semver increment (patch, minor, major) from recent changes, update package.json, and create a git tag"
agent: "agent"
argument-hint: "patch, minor, or major (optional — auto-detected from git log if omitted)"
---



Bump the version in `package.json` following semver conventions, update the changelog, and create a git tag. **Never perform any destructive git commands such as `git add`, `git commit`, `git push`, or any command that modifies the git history or remote repository.**


## Determine the bump type

If a bump type (patch, minor, major) was provided as an argument, use it. Otherwise, inspect the recent git history since the last version tag to decide:

- **patch** — bug fixes, docs, test additions, dependency updates
- **minor** — new features, new tools, new API endpoints, non-breaking additions
- **major** — breaking changes to APIs, removed features, incompatible interface changes


## Steps

1. Read the current version from [package.json](../../package.json)
2. Determine the bump type (from argument or git log analysis)
3. Calculate the new version number
4. Update `version` in `package.json`
5. Prepend a new section to [CHANGELOG.md](../../CHANGELOG.md) (create the file if it doesn't exist) with the format:

	## [<new version>] - <YYYY-MM-DD>

	### Added / Changed / Fixed / Removed
	- One-line summary per notable change (from git log)

	Use the actual date and summarize changes based on the commit log since the last version tag.
6. Summarize what changed and why that bump type was chosen.
7. Prepare a commit message for the changes to `package.json` and `CHANGELOG.md` using the format from `.github/instructions/commit-messages.instructions.md` (e.g., `chore: bump version to <version>` with a brief summary of the release), but **do not run any git add, commit, or push commands**.
8. Prepare the git tag command for the new version (e.g., `git tag v<version>`), but **do not execute it**.
9. Output clear instructions for the user to manually review, commit, tag, and push the changes if desired.
