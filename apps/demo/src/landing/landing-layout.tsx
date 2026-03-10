import type { CSSProperties, ReactNode } from 'react';
import { color, page, radius, space, type } from '../ui/tokens';
import { useResponsiveState } from '../ui/responsive';

const shellStyle: CSSProperties = {
  minHeight: '100vh',
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
  border: `1px solid ${color.borderSoft}`,
  background: 'rgba(255, 255, 255, 0.88)',
  backdropFilter: 'blur(8px)',
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
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.lg,
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
  const { isMobile } = useResponsiveState();

  return (
    <div
      style={{
        ...shellStyle,
        padding: `${isMobile ? space.xxl : space.xxxl}px ${
          isMobile ? space.pageMobile : space.page
        }px ${isMobile ? space.xxl : space.xxxl + space.xxl}px`,
      }}
    >
      <div style={{ ...innerStyle, width: `min(100%, ${page.width}px)` }}>
        {nav ? (
          <div
            style={{
              ...navRowStyle,
              top: isMobile ? space.xs : space.sm,
              padding: `${space.sm}px ${isMobile ? space.sm : space.md}px`,
            }}
          >
            {nav}
          </div>
        ) : null}
        <header style={heroStyle}>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <div
            style={{
              ...headlineStyle,
              fontSize: isMobile ? 36 : headlineStyle.fontSize,
              lineHeight: isMobile ? 1.02 : headlineStyle.lineHeight,
            }}
          >
            {title}
          </div>
          <div
            style={{
              ...supportingStyle,
              fontSize: isMobile ? type.body.fontSize : supportingStyle.fontSize,
              lineHeight: isMobile ? type.body.lineHeight : supportingStyle.lineHeight,
            }}
          >
            {description}
          </div>
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
  const { isMobile } = useResponsiveState();

  return (
    <section style={sectionStyle}>
      <div
        style={{
          ...sectionHeaderStyle,
          paddingLeft: isMobile ? 0 : sectionHeaderStyle.paddingLeft,
        }}
      >
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
  const { isMobile } = useResponsiveState();

  return (
    <div
      style={{
        ...gridStyle,
        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : gridStyle.gridTemplateColumns,
        alignItems,
      }}
    >
      {children}
    </div>
  );
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
  const { isMobile } = useResponsiveState();
  const background =
    tone === 'strong'
      ? color.surfaceMuted
      : tone === 'soft'
        ? color.surface
        : color.surface;

  const borderColor = tone === 'strong' ? color.border : color.borderSoft;

  return (
    <div
      style={{
        ...cardStyle,
        gridColumn: isMobile ? '1 / -1' : `span ${span} / span ${span}`,
        padding: isMobile ? space.xl : cardStyle.padding,
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
