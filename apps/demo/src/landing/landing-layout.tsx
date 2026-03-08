import type { CSSProperties, ReactNode } from 'react';
import { color, page, radius, shadow, space, type } from '../ui/tokens';

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  padding: `${space.xxxl}px ${space.page}px`,
};

const innerStyle: CSSProperties = {
  width: `min(100%, ${page.width}px)`,
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
  color: color.text,
};

const headlineStyle: CSSProperties = {
  ...type.hero,
  color: color.text,
  maxWidth: 860,
};

const supportingStyle: CSSProperties = {
  ...type.title,
  color: color.text,
  maxWidth: 860,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  paddingTop: space.lg,
  borderTop: `1px solid ${color.borderSoft}`,
};

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  paddingLeft: space.lg,
};

const sectionTitleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
  maxWidth: 900,
};

const sectionTextStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  maxWidth: 860,
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
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.panel,
  minWidth: 0,
  background: color.surface,
};

export function LandingShell({
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
      <div style={innerStyle}>
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

export function LandingSection({
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

export function LandingGrid({
  children,
  alignItems = 'start',
}: {
  children: ReactNode;
  alignItems?: 'start' | 'stretch';
}) {
  return <div style={{ ...gridStyle, alignItems }}>{children}</div>;
}

export function LandingCard({
  children,
  span = 6,
  tone = 'default',
  fullHeight = false,
}: {
  children: ReactNode;
  span?: 3 | 4 | 6 | 8 | 12;
  tone?: 'default' | 'soft' | 'strong';
  fullHeight?: boolean;
}) {
  const background =
    tone === 'strong' ? color.surfaceInset : tone === 'soft' ? color.surfaceMuted : color.surface;

  const borderColor = tone === 'strong' ? color.borderStrong : color.border;

  return (
    <div
      style={{
        ...cardStyle,
        gridColumn: `span ${span} / span ${span}`,
        background,
        border: `1px solid ${borderColor}`,
        height: fullHeight ? '100%' : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function LandingFeatureList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'grid', gap: space.md }}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            ...type.body,
            color: color.text,
            paddingBottom: space.md,
            borderBottom: `1px solid ${color.borderSoft}`,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
