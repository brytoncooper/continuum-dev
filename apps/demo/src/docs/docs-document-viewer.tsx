import type { CSSProperties } from 'react';
import { startTransition, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { repositoryFileUrl } from '../site-config';
import { color, radius, shadow, space, type } from '../ui/tokens';
import type { DocsDocument } from './docs-content';

const viewerStyle: CSSProperties = {
  display: 'grid',
  gap: space.xl,
};

const viewerHeaderStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const tabButtonStyle = (isActive: boolean): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: isActive ? color.surface : color.text,
  cursor: 'pointer',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${isActive ? color.accentStrong : color.border}`,
  background: isActive ? color.accent : color.surface,
});

const sourceLinkStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${space.sm}px ${space.xs}px`,
};

const articleStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  padding: space.xxl,
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.lg,
  background: color.surface,
  boxShadow: shadow.panel,
};

const inlineCodeStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  padding: `2px ${space.xs}px`,
  borderRadius: radius.sm,
  background: color.surfaceInset,
};

const blockCodeStyle: CSSProperties = {
  color: color.text,
  fontFamily:
    'ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.6,
};

const preStyle: CSSProperties = {
  margin: 0,
  padding: space.lg,
  overflowX: 'auto',
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

const blockquoteStyle: CSSProperties = {
  margin: 0,
  paddingLeft: space.lg,
  borderLeft: `3px solid ${color.highlight}`,
  color: color.textMuted,
};

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: CSSProperties = {
  width: '100%',
  minWidth: 560,
  borderCollapse: 'collapse',
};

const tableCellStyle: CSSProperties = {
  ...type.body,
  textAlign: 'left',
  padding: `${space.sm}px ${space.md}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const markdownLinkStyle: CSSProperties = {
  color: color.accentStrong,
  textDecorationColor: color.border,
};

function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^# .+\r?\n+/, '');
}

function normalizeMarkdown(markdown: string): string {
  return stripLeadingTitle(markdown).replace(
    /^> \[!([A-Z]+)\]\s*$/gm,
    (_match, kind: string) => `> **${kind}**`
  );
}

function normalizeRepoPath(path: string): string {
  return path
    .split('/')
    .reduce<string[]>((segments, segment) => {
      if (segment === '' || segment === '.') {
        return segments;
      }

      if (segment === '..') {
        segments.pop();
        return segments;
      }

      segments.push(segment);
      return segments;
    }, [])
    .join('/');
}

function resolveRelativeRepoPath(
  basePath: string,
  href: string
): string | null {
  if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href)) {
    return null;
  }

  const [pathPart] = href.split('#', 2);
  const baseSegments = basePath.includes('/')
    ? basePath.split('/').slice(0, -1)
    : [];
  const joinedPath = pathPart.startsWith('/')
    ? pathPart.slice(1)
    : [...baseSegments, pathPart].join('/');

  return normalizeRepoPath(joinedPath);
}

function toGithubHref(basePath: string, href: string): string {
  if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href)) {
    return href;
  }

  const normalizedPath = resolveRelativeRepoPath(basePath, href);
  return normalizedPath ? repositoryFileUrl(normalizedPath) : href;
}

export function DocsDocumentViewer({
  documents,
}: {
  documents: DocsDocument[];
}) {
  const [activeId, setActiveId] = useState<DocsDocument['id']>(
    documents[0]?.id ?? 'quick-start'
  );

  const activeDocument =
    documents.find((document) => document.id === activeId) ?? documents[0];
  const docsByPath = new Map(
    documents.map((document) => [document.repoPath, document])
  );

  if (!activeDocument) {
    return null;
  }

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1
        style={{
          ...type.title,
          fontSize: 30,
          lineHeight: 1.05,
          color: color.text,
          margin: 0,
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        style={{
          ...type.title,
          fontSize: 22,
          lineHeight: 1.1,
          color: color.text,
          margin: `${space.lg}px 0 0`,
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        style={{
          ...type.section,
          fontSize: 18,
          color: color.text,
          margin: `${space.md}px 0 0`,
        }}
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p style={{ ...type.body, color: color.textMuted, margin: 0 }}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        style={{
          ...type.body,
          color: color.text,
          margin: 0,
          paddingLeft: space.xxl,
          display: 'grid',
          gap: space.sm,
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        style={{
          ...type.body,
          color: color.text,
          margin: 0,
          paddingLeft: space.xxl,
          display: 'grid',
          gap: space.sm,
        }}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li style={{ paddingLeft: space.xs }}>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote style={blockquoteStyle}>{children}</blockquote>
    ),
    pre: ({ children }) => <pre style={preStyle}>{children}</pre>,
    code: ({ children, className }) => {
      const content = String(children).replace(/\n$/, '');
      const isBlock = Boolean(className) || content.includes('\n');

      return isBlock ? (
        <code style={blockCodeStyle}>{content}</code>
      ) : (
        <code style={inlineCodeStyle}>{content}</code>
      );
    },
    a: ({ href = '', children }) => {
      const localDocPath = resolveRelativeRepoPath(
        activeDocument.repoPath,
        href
      );
      const localDocument = localDocPath
        ? docsByPath.get(localDocPath)
        : undefined;

      if (localDocument) {
        return (
          <a
            href={`#docs-viewer-${localDocument.id}`}
            style={markdownLinkStyle}
            onClick={(event) => {
              event.preventDefault();
              startTransition(() => {
                setActiveId(localDocument.id);
              });
            }}
          >
            {children}
          </a>
        );
      }

      const resolvedHref = toGithubHref(activeDocument.repoPath, href);
      const isExternal = /^https?:/i.test(resolvedHref);

      return (
        <a
          href={resolvedHref}
          style={markdownLinkStyle}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div style={tableWrapStyle}>
        <table style={tableStyle}>{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th
        style={{
          ...tableCellStyle,
          ...type.small,
          color: color.text,
          background: color.surfaceMuted,
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => <td style={tableCellStyle}>{children}</td>,
    hr: () => (
      <hr
        style={{
          width: '100%',
          border: 0,
          borderTop: `1px solid ${color.borderSoft}`,
        }}
      />
    ),
  };

  return (
    <div id="docs-viewer" style={viewerStyle}>
      <div style={viewerHeaderStyle}>
        <div style={tabRowStyle}>
          {documents.map((document) => (
            <button
              key={document.id}
              id={`docs-viewer-${document.id}`}
              type="button"
              style={tabButtonStyle(document.id === activeDocument.id)}
              onClick={() => {
                startTransition(() => {
                  setActiveId(document.id);
                });
              }}
            >
              {document.label}
            </button>
          ))}
        </div>
        <a
          href={activeDocument.githubHref}
          target="_blank"
          rel="noreferrer"
          style={sourceLinkStyle}
        >
          View on GitHub
        </a>
      </div>
      <div style={articleStyle}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {normalizeMarkdown(activeDocument.body)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
