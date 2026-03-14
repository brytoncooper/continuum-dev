import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteName, siteSocialImageUrl, siteUrl } from '../site-config';

type RouteMetadata = {
  title: string;
  description: string;
  path: string;
};

const defaultMetadata: RouteMetadata = {
  title: 'Continuum | Open Source Runtime for AI-Generated UI State Continuity',
  description:
    'Continuum is an open-source runtime for AI-generated, schema-driven, and server-driven interfaces that preserves user state while the UI changes. View the GitHub repo, try the static demo, and install the packages.',
  path: '/',
};

const routeMetadata: Record<string, RouteMetadata> = {
  '/': defaultMetadata,
  '/docs': {
    title: 'Continuum Docs | Install the Runtime, React Bindings, and Starter Kit',
    description:
      'Read the Continuum installation and integration docs for the core runtime, headless React bindings, and Starter Kit. Get from GitHub to working install faster.',
    path: '/docs',
  },
  '/playground': {
    title: 'Continuum Static Demo | See User State Loss vs Continuity Preservation',
    description:
      'Try the static Continuum demo to compare state loss and state preservation across changing AI-generated and dynamic UI flows without adding an API key.',
    path: '/playground',
  },
  '/starter-kit': {
    title: 'Continuum Starter Kit | Faster React Setup for Dynamic UI Experiences',
    description:
      'Explore the Continuum Starter Kit for React and see the fastest path from install to a polished dynamic UI with continuity-aware rendering and proposal flows.',
    path: '/starter-kit',
  },
  '/live-ai': {
    title: 'Continuum Live AI Demo | Generate Dynamic UI Without Losing User State',
    description:
      'Use the Continuum Live AI demo to generate and evolve dynamic UI while preserving in-progress user state with the open-source Continuum runtime and Starter Kit.',
    path: '/live-ai',
  },
  '/vercel-ai-sdk': {
    title: 'Continuum Vercel AI SDK Demo | Keep Streaming UI Stable After It Lands',
    description:
      'See how Continuum plugs into the Vercel AI SDK stream model so generated forms and workflows can evolve without wiping in-progress user state.',
    path: '/vercel-ai-sdk',
  },
};

function upsertMeta(attribute: 'name' | 'property', value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  link.setAttribute('href', url);
}

export function RouteMetadataController() {
  const location = useLocation();
  const metadata = routeMetadata[location.pathname] ?? defaultMetadata;
  const canonicalUrl = `${siteUrl}${metadata.path}`;

  useEffect(() => {
    document.title = metadata.title;
    upsertMeta('name', 'description', metadata.description);
    upsertMeta('property', 'og:title', metadata.title);
    upsertMeta('property', 'og:description', metadata.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', siteSocialImageUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', metadata.title);
    upsertMeta('name', 'twitter:description', metadata.description);
    upsertMeta('name', 'twitter:image', siteSocialImageUrl);
    upsertCanonical(canonicalUrl);
  }, [canonicalUrl, metadata.description, metadata.title]);

  return null;
}
