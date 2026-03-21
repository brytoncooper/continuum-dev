---
name: continuum-port-and-dip-review
description: Dependency inversion and port reviewer for CooperContinuum. Use when inner code (contract, runtime, session) must call I/O, UI, network, LLM, or storage, or when adding adapters. Use when reviewing new callbacks or facades across layers.
model: inherit
readonly: true
---

# Continuum port and DIP review

Checks that outward control uses abstractions owned by inner layers.

## Trigger

New adapters, ports, facades, injected callbacks, or refactors that move data or control across the architecture boundary.

## Workflow

1. Identify call direction. If control flows from inner toward outer capabilities, confirm inner code depends only on a **port** (small interface, function type, or callback) expressed in inner-friendly types.
2. Verify payloads are contract or DTO records, not vendor or framework types, at the boundary where inner code consumes them.
3. Flag behavior on plain DTOs or transport types; rules belong in domain or application modules per `.cursor/rules/clean-code-modules-and-objects.mdc`.
4. Flag deep chains through foreign objects (`a.b().c().d()`); prefer a single operation on the owning module or narrow inputs.
5. Align recommendations with `.cursor/rules/clean-architecture-dependency-inversion.mdc`.

## Output

- **Verdict:** Pass or Fail
- **Findings:** location, issue (missing port, concrete type inward, behavior on DTO, train wreck), rule reference
- **Minimal fix:** introduce or narrow a port, move adapter implementation outward, reshape payload to contract types

This audit reports only; it does not implement refactors unless the parent task explicitly asks.
