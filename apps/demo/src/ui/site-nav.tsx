import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { repositoryUrl } from '../site-config';
import { color, radius, space, type } from './tokens';

const brandStyle: CSSProperties = {
  ...type.label,
  color: color.text,
};

const navListStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.sm,
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${isActive ? color.borderStrong : color.border}`,
  borderRadius: radius.pill,
  background: isActive ? color.surface : color.surfaceMuted,
});

const externalLinkStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  background: color.surfaceMuted,
};

export function SiteNav() {
  return (
    <>
      <div style={brandStyle}>Continuum</div>
      <nav style={navListStyle} aria-label="Primary">
        <NavLink to="/" end style={navLinkStyle}>
          Home
        </NavLink>
        <NavLink to="/playground" style={navLinkStyle}>
          Playground
        </NavLink>
        <NavLink to="/starter-kit" style={navLinkStyle}>
          Starter Kit
        </NavLink>
        <NavLink to="/live-ai" style={navLinkStyle}>
          Live AI
        </NavLink>
        <NavLink to="/docs" style={navLinkStyle}>
          Docs
        </NavLink>
        <a href={repositoryUrl} target="_blank" rel="noreferrer" style={externalLinkStyle}>
          GitHub
        </a>
      </nav>
    </>
  );
}
