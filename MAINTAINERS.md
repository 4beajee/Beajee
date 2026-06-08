# Maintainers

Beajee is currently maintained by:

- Gleb4442

## Maintainer Responsibilities

- Review pull requests for correctness, privacy, security, and product fit.
- Keep MCP tool schemas and public agent instructions aligned with implementation.
- Keep dependency alerts and CI failures triaged.
- Coordinate security vulnerability reports privately according to `SECURITY.md`.
- Decide when breaking changes are acceptable and document them clearly.

## Review Expectations

Pull requests should normally have:

- Passing CI.
- A clear explanation of what changed and why.
- Focused tests for behavior changes.
- Updated docs for setup, MCP schema, privacy, or agent instruction changes.
- No secrets, private deployment details, or sensitive user data.

## Maintainer Notes

The production deployment runbook is private and intentionally not part of the public repository. Public contributors should be able to build, test, and review code locally without production access.
