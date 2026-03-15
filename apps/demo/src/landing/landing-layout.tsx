import type { CSSProperties, ReactNode } from 'react';
import { color, page, radius, shadow, space, type } from '../ui/tokens';
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
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  boxShadow: shadow.panel,
};

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: space.xl,
};

const eyebrowStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const headlineStyle: CSSProperties = {
  ...type.hero,
  color: color.text,
  maxWidth: 780,
};

const supportingStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.55,
  fontWeight: 500,
  color: color.textMuted,
  maxWidth: 720,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  paddingTop: space.xxl,
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
  maxWidth: 760,
};

const sectionTextStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  maxWidth: 720,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
  gap: space.lg,
  alignItems: 'start',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.xxl,
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.lg,
  minWidth: 0,
  background: color.surface,
  boxShadow: shadow.panel,
};

export function LandingShell({
  nav,
  heroVisual,
  eyebrow,
  title,
  description,
  children,
}: {
  nav?: ReactNode;
  heroVisual?: ReactNode;
  eyebrow?: string;
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
      <div
        style={{
          ...innerStyle,
          width: `min(100%, ${page.width}px)`,
          gap: isMobile ? space.xxl : innerStyle.gap,
        }}
      >
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
          {heroVisual}
          {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
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
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const { isMobile } = useResponsiveState();
  const showHeader = Boolean(title || description);

  return (
    <section
      style={{
        ...sectionStyle,
        gap: isMobile ? space.md : sectionStyle.gap,
      }}
    >
      {showHeader ? (
        <div
          style={{
            ...sectionHeaderStyle,
            paddingLeft: 0,
          }}
        >
          {title ? <div style={sectionTitleStyle}>{title}</div> : null}
          {description ? <div style={sectionTextStyle}>{description}</div> : null}
        </div>
      ) : null}
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
      ? color.surfaceAccent
      : tone === 'soft'
        ? color.surfaceMuted
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
