export const siteName = 'Continuum';
export const siteDomain = 'continuumstack.dev';
export const githubProfileUrl = 'https://github.com/brytoncooper';
export const repositoryUrl = 'https://github.com/brytoncooper/continuum-dev';

export function repositoryFileUrl(path: string): string {
  return `${repositoryUrl}/blob/main/${path}`;
}
