import type { CSSProperties, ReactNode } from 'react';
import { color, page, radius, shadow, space, type } from './tokens';

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  padding: `${space.xxxl}px ${space.page}px`,
};

const innerStyle: CSSProperties = {
  width: 'min(100%, 1240px)',
  margin: '0 auto',
  display: 'grid',
  gap: space.xxxl,
};

const navRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.lg,
  position: 'sticky',
  top: space.sm,
  zIndex: 30,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: 'rgba(255, 255, 255, 0.92)',
  backdropFilter: 'blur(6px)',
};

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
};

const eyebrowStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const headlineStyle: CSSProperties = {
  ...type.hero,
  color: color.text,
  maxWidth: 820,
};

const supportingStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  maxWidth: 760,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
};

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
  paddingLeft: space.lg,
};

const sectionTitleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const sectionTextStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  maxWidth: 760,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
  gap: space.lg,
  alignItems: 'start',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  padding: space.xxl,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.panel,
  minWidth: 0,
};

const cardHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const cardTitleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const cardBodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

export function PageShell({
  nav,
  eyebrow,
  title,
  description,
  children,
}: {
  nav?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div style={shellStyle}>
      <div style={{ ...innerStyle, width: `min(100%, ${page.width}px)` }}>
        {nav ? <div style={navRowStyle}>{nav}</div> : null}
        <header style={heroStyle}>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <div style={headlineStyle}>{title}</div>
          <div style={supportingStyle}>{description}</div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function PageSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>{title}</div>
        <div style={sectionTextStyle}>{description}</div>
      </div>
      {children}
    </section>
  );
}

export function ExampleGrid({
  children,
  alignItems = 'start',
}: {
  children: ReactNode;
  alignItems?: 'start' | 'stretch';
}) {
  return <div style={{ ...gridStyle, alignItems }}>{children}</div>;
}

export function ExampleCard({
  title,
  description,
  span = 6,
  fullHeight = false,
  headerAction,
  children,
}: {
  title: string;
  description: string;
  span?: 4 | 6 | 12;
  fullHeight?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      style={{
        gridColumn: `span ${span} / span ${span}`,
        minWidth: 0,
        height: fullHeight ? '100%' : undefined,
      }}
    >
      <div
        style={{
          ...cardStyle,
          height: fullHeight ? '100%' : undefined,
          display: fullHeight ? 'flex' : cardStyle.display,
          flexDirection: fullHeight ? 'column' : undefined,
        }}
      >
        <div
          style={{
            ...cardHeaderStyle,
            gridTemplateColumns: headerAction ? 'minmax(0, 1fr) auto' : undefined,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: space.sm, minWidth: 0 }}>
            <div style={cardTitleStyle}>{title}</div>
            <div style={cardBodyStyle}>{description}</div>
          </div>
          {headerAction}
        </div>
        {children}
      </div>
    </article>
  );
}
