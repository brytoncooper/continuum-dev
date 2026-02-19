---
name: staged-commit
description: Snapshot uncommitted work to reference branches, diff them, then replay changes as atomic feature-branch commits optimized for human review. USE WHEN user says "commit these changes", "stage and commit", "reference branch", "commit piece by piece", "commit for review", "staged commit", or wants uncommitted work broken into reviewable commits.
---

# Staged Commit Workflow

Move uncommitted changes onto local reference branches, then replay them onto the base branch as small, logical, human-reviewable commits organized by feature branch. The goal is to produce the **easiest possible review** for any human reader.

## Core Principle

A commit is a **unit of understanding**, not a unit of files. Each commit should answer one question a reviewer might ask: "What changed and why?" A single commit can touch multiple files if they all serve one logical idea. Conversely, one large file change should be split into multiple commits if it contains multiple logical ideas.

## Phase 1: Snapshot

Capture all uncommitted work into one or more local reference branches. **NEVER push ref/ branches to the remote.**

### Single reference (simple case)

When all changes serve one cohesive effort:

```bash
git checkout -b ref/<name>
git add -A
git commit -m "ref: all <name> changes"
git checkout <base-branch>
```

### Multiple references (complex case)

When changes span unrelated concerns (e.g., a refactor + a bug fix + a new feature), split into separate reference branches before committing. This makes planning easier because each ref is a self-contained section to interpret:

```bash
# Snapshot everything first
git stash --include-untracked

# Create ref for concern A
git checkout -b ref/<name>-partA
git stash pop
git add <files-for-A>
git commit -m "ref: <name> part A - <description>"
git checkout <base-branch>

# Create ref for concern B
git checkout -b ref/<name>-partB
git stash pop
git add <files-for-B>
git commit -m "ref: <name> part B - <description>"
git checkout <base-branch>
git stash pop  # remaining files if any
```

Alternatively, commit everything to one `ref/<name>` and then use the diff to mentally group -- the multiple-ref approach is optional, for when the separation is clearer up front.

The working tree is now clean. The reference branch(es) hold the known-good state.

## Phase 2: Plan Commits

Run `git diff <base>..ref/<name> --stat` to see every changed file and its delta size.

### Think like a reviewer

Before touching git, read every diff and ask:

1. **What are the logical ideas in this changeset?** Not files -- ideas. Examples: "introduce the composable functions", "swap boilerplate for composable calls across entity lists", "fix a feedback loop in the billing tab".
2. **What order would make each idea easiest to understand?** Foundation first (shared libs, types), then consumers (features), then edge cases (bug fixes, nested lists).
3. **For each idea, what is the minimum set of changes a reviewer needs to see together to understand it?** That set is one commit. It might be 1 file or 5 files.

### Group changes into commits by logical idea

Each commit should be a **coherent thought** that a reviewer can understand in isolation:

| Pattern | Commit strategy | Example |
|---------|----------------|---------|
| New shared utility/library | One commit per exported concept, or one commit if tightly coupled | "Add useNavigationTracking and useChildRouteId composables" |
| Same mechanical change across N files | One commit for all N files if the change is identical in each | "Replace boilerplate navigation signals with composable calls in all entity lists" |
| Same pattern but with per-file variations | One commit per file or per variation group | "Swap fees list to composables (simpler variant, no archived)" |
| Bug fix alongside a refactor | Separate commits -- fix first, then refactor | "Fix billing config feedback loop" then "Refactor billing config to use composables" |
| Import changes + logic changes in one file | One commit if the imports only exist to support the logic change | Don't split imports from the code that uses them |
| Dead code removal | Separate commit from the additions that replace it, OR combined if the removal and addition are the same logical thought | "Replace selectFirstItem/navigateRelative with useAutoSelection" is one thought |

### Granularity guidelines

These are guidelines, not hard rules. Always prefer **reviewer comprehension** over mechanical thresholds.

| Scenario | Default strategy | Override when... |
|----------|-----------------|------------------|
| New file under 150 lines | 1 commit | It contains unrelated exports -- split by concept |
| New file over 150 lines | Split by logical section | All sections are tightly coupled -- keep as 1 |
| Modified file, small diff (under ~30 lines) | 1 commit | Changes touch unrelated concerns -- split |
| Modified file, large diff, single logical change | 1 commit even if 200 lines | -- |
| Modified file, large diff, multiple logical changes | Split into hunk-level commits | All changes are interdependent -- keep as 1 |
| Identical change across many files | 1 commit for all files | Some files have extra nuance -- separate those |
| Pure deletions (removing dead code) | Combine with the addition that replaces it | Deletion is unrelated to additions -- separate |

### Hunk-level splitting technique

When a single file has multiple logical changes that need separate commits:

```bash
git checkout ref/<name> -- path/to/file.ts

# Stage only the hunks for the first logical change
git add -p path/to/file.ts

# Commit the staged hunks
git commit -m "Replace boilerplate signals with composable calls"

# Remaining unstaged changes stay in the working tree
git add -p path/to/file.ts
git commit -m "Remove selectFirstItem and navigateRelative helpers"
```

Use `s` in `git add -p` to split hunks further. Use `git add -e` for manual hunk editing if needed.

## Phase 3: Build Feature Branches

Create one feature branch per logical group, chained linearly:

```
base ── feat/group-1 ── feat/group-2 ── feat/group-3
```

Branch from the tip of the previous so each has the dependencies it needs.

### Per-branch workflow

```bash
git checkout -b feat/<group-name>

# Pull file(s) from reference
git checkout ref/<name> -- path/to/file-a.ts path/to/file-b.ts

# Multi-file single-idea commit (all files serve one logical thought):
git add path/to/file-a.ts path/to/file-b.ts
git commit -m "Describe the single logical idea these files implement"

# OR hunk-split within a file (multiple ideas in one file):
git add -p path/to/file-a.ts
git commit -m "First logical idea"
git add path/to/file-a.ts
git commit -m "Second logical idea"
```

## Phase 4: Merge and Verify

```bash
git checkout <base-branch>

git merge feat/group-1 --no-ff -m "Merge feat/group-1 into <base>"
git merge feat/group-2 --no-ff -m "Merge feat/group-2 into <base>"
git merge feat/group-3 --no-ff -m "Merge feat/group-3 into <base>"
```

### Verification (MANDATORY)

Diff the base branch against **every** reference branch. Each must be empty:

```bash
git diff <base-branch> ref/<name>
# MUST be empty

# If multiple refs were created:
git diff <base-branch> ref/<name>-partA
git diff <base-branch> ref/<name>-partB
```

If any diff is non-empty, something was missed. Fix it before proceeding.

### Cleanup

Only after all diffs are verified empty:

```bash
git branch -D ref/<name>
# If multiple: git branch -D ref/<name>-partA ref/<name>-partB
git branch -d feat/group-1 feat/group-2 feat/group-3
```

## Commit Message Rules

- One line, imperative mood, no trailing period
- Describes the **logical idea**, never a file path
- Can reference the scope if helpful: "Replace navigation boilerplate with composables in entity lists"
- Good: `Replace boilerplate navigation signals with composable calls`
- Good: `Remove unused selectFirstItem and navigateRelative helpers`
- Good: `Add useNavigationTracking and useChildRouteId composables`
- Bad: `Update list.ts`
- Bad: `Refactor vendors list` (what changed?)
- Bad: `Changes to billing configuration tab`

## Hard Rules

1. **NEVER push ref/ branches to the remote.** They are local-only snapshots.
2. **NEVER delete ref/ branches before verification.** Always diff first.
3. **ALWAYS use `--no-ff` for merge commits** so branch history is visible.
4. **ALWAYS verify every ref/ branch** has an empty diff against the base before cleanup.
5. **A commit is a unit of understanding.** Multiple files per commit is fine when they serve one idea. One file split across commits is fine when it contains multiple ideas.
6. **Optimize for the reviewer, not the committer.** Ask: "If I were reading this PR for the first time, would each commit make sense on its own?"
