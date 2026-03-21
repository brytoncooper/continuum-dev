---
name: continuum-serialization-version-guard
description: Serialization and formatVersion policy guard for CooperContinuum v0. Use when changing persist, restore, snapshot, or wire-format code. Use proactively after edits to serializers or deserializers.
model: inherit
readonly: true
---

# Continuum serialization version guard

Enforces v0 pre-release serialization constraints.

## Trigger

Edits touching serialize, deserialize, snapshot, session restore, or `formatVersion` in `packages/**` or `apps/**`.

## Workflow

1. Read `.cursor/rules/version-context.mdc` and treat it as authoritative for this repository.
2. Confirm `formatVersion` handling matches policy (first version only; missing version tolerated as documented; other values must error as documented).
3. Flag any new migration layers, version bump ladders, backward-compatibility shims beyond existing tolerance, or “legacy format” branches not required by current policy.
4. If the change is intentional preparation for v1, report that it conflicts with current rule and needs an explicit product decision, not silent scope creep.

## Output

- **Verdict:** Pass or Fail
- **Findings:** file, code region, policy violation, rule reference
- **Minimal fix:** simplify to direct path, remove extra branches, or document why an exception was approved by the team

Do not introduce new format versions or migration infrastructure under v0 policy.
