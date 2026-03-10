import type { CSSProperties } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { repositoryUrl } from '../site-config';
import { color, radius, space, type } from './tokens';
import { useResponsiveState } from './responsive';

const brandStyle: CSSProperties = {
  ...type.label,
  display: 'inline-flex',
  alignItems: 'center',
  color: color.accentStrong,
  textDecoration: 'none',
};

const navListStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.sm,
  flexWrap: 'wrap',
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${isActive ? color.accentStrong : color.border}`,
  borderRadius: radius.pill,
  background: isActive ? color.accentSoft : color.surface,
});

const secondaryLinkStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  background: color.surface,
};

const githubLinkStyle: CSSProperties = {
  ...type.small,
  color: color.surface,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.accentStrong}`,
  borderRadius: radius.pill,
  background: color.accent,
};

const mobileWrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  width: '100%',
};

const mobileBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.sm,
  width: '100%',
};

const mobileActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.sm,
};

const mobileMenuStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const mobileNavListStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const menuButtonStyle: CSSProperties = {
  ...secondaryLinkStyle,
  cursor: 'pointer',
  border: `1px solid ${color.border}`,
};

export function SiteNav() {
  const { isMobile } = useResponsiveState();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isMobile) {
    return (
      <div style={mobileWrapStyle}>
        <div style={mobileBarStyle}>
          <NavLink to="/" end style={brandStyle}>
            Continuum
          </NavLink>
          <div style={mobileActionsStyle}>
            <a href={repositoryUrl} target="_blank" rel="noreferrer" style={githubLinkStyle}>
              GitHub
            </a>
            <button
              type="button"
              style={menuButtonStyle}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav style={mobileMenuStyle} aria-label="Primary">
            <div style={mobileNavListStyle}>
              <NavLink to="/" end style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/docs" style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                Install Docs
              </NavLink>
              <NavLink to="/playground" style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                Static Demo
              </NavLink>
              <NavLink to="/live-ai" style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                Live AI Demo
              </NavLink>
              <NavLink to="/starter-kit" style={navLinkStyle} onClick={() => setMenuOpen(false)}>
                Starter Kit
              </NavLink>
            </div>
          </nav>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <NavLink to="/" end style={brandStyle}>
        Continuum
      </NavLink>
      <nav style={navListStyle} aria-label="Primary">
        <NavLink to="/" end style={navLinkStyle}>
          Home
        </NavLink>
        <NavLink to="/docs" style={navLinkStyle}>
          Install Docs
        </NavLink>
        <NavLink to="/playground" style={navLinkStyle}>
          Static Demo
        </NavLink>
        <NavLink to="/live-ai" style={navLinkStyle}>
          Live AI Demo
        </NavLink>
        <NavLink to="/starter-kit" style={navLinkStyle}>
          Starter Kit
        </NavLink>
        <a href={repositoryUrl} target="_blank" rel="noreferrer" style={githubLinkStyle}>
          View on GitHub
        </a>
      </nav>
    </>
  );
}
