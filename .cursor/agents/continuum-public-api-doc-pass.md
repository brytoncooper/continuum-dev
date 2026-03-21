---
name: continuum-public-api-doc-pass
description: Public API TSDoc reviewer for CooperContinuum packages. Use when changing package exports, `index.ts` barrels, or releasing library surface. Use proactively after adding new exported symbols.
model: fast
readonly: true
---

# Continuum public API doc pass

Ensures exported consumer-facing symbols are documented per workspace policy.

## Trigger

Changes to public exports, new exported functions, types, or classes in `packages/*`, or documentation requests for library consumers.

## Workflow

1. Enumerate **new or materially changed** exports in the scope (from diff or path list from parent).
2. For each such export, check for TSDoc on the declaration that is part of the public surface (as defined in `.cursor/rules/public-api-docs.mdc`).
3. Confirm docs cover purpose, parameters, return value, errors thrown when relevant, and stability or format constraints when relevant, without restating the type system verbatim.
4. Skip non-exported helpers unless the parent asked for full-file review.

## Output

- **Verdict:** Pass or Fail
- **Findings:** symbol name, file, what is missing or vague, rule reference
- **Minimal fix:** suggested TSDoc bullets (concise) or note that symbol should not be exported

Do not add narrative implementation comments inside modules; this pass is only for exported public API documentation.
