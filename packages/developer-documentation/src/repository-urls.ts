const defaultRepositoryUrl = 'https://github.com/brytoncooper/continuum-dev';

/**
 * Base URL of the Continuum SDK source repository used for documentation links.
 */
export function getDeveloperDocsRepositoryUrl(): string {
  return defaultRepositoryUrl;
}

/**
 * Returns a URL that opens `path` in the repository default branch on GitHub.
 *
 * @param path - Repository-relative path (for example `docs/QUICK_START.md`).
 */
export function buildDeveloperDocsRepositoryFileUrl(path: string): string {
  return `${defaultRepositoryUrl}/blob/main/${path}`;
}
