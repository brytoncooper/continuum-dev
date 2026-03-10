export const siteName = 'Continuum';
export const siteDomain = 'continuumstack.dev';
export const siteUrl = 'https://continuumstack.dev';
export const siteSocialImageUrl = `${siteUrl}/social-card.svg`;
export const maintainerName = 'Bryton Cooper';
export const maintainerEmail = 'brytoncooper1@gmail.com';
export const githubProfileUrl = 'https://github.com/brytoncooper';
export const repositoryUrl = 'https://github.com/brytoncooper/continuum-dev';

export function repositoryFileUrl(path: string): string {
  return `${repositoryUrl}/blob/main/${path}`;
}
