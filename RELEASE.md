# Releasing published packages

Checklist for shipping `@continuum-dev/*` libraries from this monorepo.

## Before you version

1. Ensure `main` (or your release branch) is green, including CI release verification (`build:release-packages`, `prepare:dist-packages`, `verify:release-packages`). `build:release-packages` also runs `sync-workspace-entrypoints` so `packages/*/root` entry shims match `dist`.
2. Update [`CHANGELOG.md`](CHANGELOG.md): move items from **Unreleased** into a dated section for the new version.
3. Run locally if you changed release scripts or package lists:
   ```bash
   npm run build:release-packages
   npm run prepare:dist-packages
   npm run verify:release-packages
   ```

## Version and publish

Configured in [`nx.json`](nx.json) under `release.groups.publicPackages` with `projectsRelationship: "fixed"` (one version line for the group).

`preVersionCommand` already runs build, prepare, and verify before manifests update.

Typical flow:

```bash
npx nx release version --groups=publicPackages
```

Then publish (after review and npm auth):

```bash
npm run publish:public-packages
```

Or use `npx nx release publish --groups=publicPackages` after the same build/prepare/verify steps if you are not using the npm script wrapper.

## Local registry smoke (optional)

```bash
npx nx run @continuum-dev/source:local-registry
```

Use this to dry-run installs against a local Verdaccio before touching npm.

## Adding or removing a published package

1. Add the package folder name to [`scripts/release-public-package-dirs.json`](scripts/release-public-package-dirs.json) (order should respect TypeScript project references / build order).
2. Add the Nx project to `release.groups.publicPackages.projects` in [`nx.json`](nx.json).
3. Ensure `packages/<name>/project.json` defines `nx-release-publish` with `packageRoot` `dist/packages/<name>`.
4. Document validation expectations in [`docs/PACKAGE_VALIDATION_POLICY.md`](docs/PACKAGE_VALIDATION_POLICY.md) if the role is new or unusual.

`verify:release-packages` fails if the script directory list and `nx.json` `publicPackages` diverge.

## Reference

- Validation categories and facades: [`docs/PACKAGE_VALIDATION_POLICY.md`](docs/PACKAGE_VALIDATION_POLICY.md)
- Publishable directory list: [`scripts/release-public-package-dirs.json`](scripts/release-public-package-dirs.json)
