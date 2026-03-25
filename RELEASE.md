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

Use this to dry-run installs against a local Verdaccio before touching npm. After `build:release-packages`, `prepare:dist-packages`, and `verify:release-packages`, publish **every** package in [`scripts/release-build-package-dirs.json`](scripts/release-build-package-dirs.json) to the local registry with:

```bash
npm run publish:local-verdaccio
```

Set `VERDACCIO_REGISTRY` if Verdaccio is not on the default `http://localhost:4873/`. Public npm publishing still uses only the projects in `release.groups.publicPackages` (see `release-npm-publish-dirs.json`).

The local [`.verdaccio/config.yml`](.verdaccio/config.yml) does **not** set `proxy` on the `**` package rule so the web UI’s `/-/static/*` assets are not mistaken for registry traffic (which would return JSON 404s and break the UI). Scoped packages still use `proxy: npmjs` under `@*/*`. Restart Verdaccio after changing this file.

### Clearing local Verdaccio storage

To drop every tarball the local registry has stored (for example before republishing the same prerelease such as `0.3.0-alpha.1`), stop Verdaccio, delete the `storage` directory from [`.verdaccio/config.yml`](.verdaccio/config.yml) (default: `tmp/local-registry/storage` under this repo), restart Verdaccio, then run `npm run publish:local-verdaccio` again after `build:release-packages`, `prepare:dist-packages`, and `verify:release-packages`. Local publishes use the `next` dist-tag (not `latest`). As an alternative, `npm unpublish <package>@<version> --registry <url> --force` can remove one package at a time when the registry configuration allows it.

## Adding or removing a published package

1. Add the package folder name to [`scripts/release-build-package-dirs.json`](scripts/release-build-package-dirs.json) (order should respect TypeScript project references / build order). If the package is part of the public npm group, also add it to [`scripts/release-npm-publish-dirs.json`](scripts/release-npm-publish-dirs.json) in the same order as `nx.json`.
2. Add the Nx project to `release.groups.publicPackages.projects` in [`nx.json`](nx.json) when the package ships to npm.
3. Ensure `packages/<name>/project.json` defines `nx-release-publish` with `packageRoot` `dist/packages/<name>`.
4. Document validation expectations in the private maintainer documentation repository if the role is new or unusual.

`verify:release-packages` fails if `release-npm-publish-dirs.json` and `nx.json` `publicPackages` diverge.

## Reference

- Validation categories and facades: private maintainer documentation repository
- Full build directory list: [`scripts/release-build-package-dirs.json`](scripts/release-build-package-dirs.json)
- Public npm directory list: [`scripts/release-npm-publish-dirs.json`](scripts/release-npm-publish-dirs.json)
