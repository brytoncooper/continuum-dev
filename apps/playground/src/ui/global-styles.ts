import { color } from './tokens';

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Syne:wght@600;700;800&display=swap');

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
    background: ${color.bg};
    color: ${color.text};
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: "Manrope", "Inter", "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  ::selection {
    background: rgba(124, 58, 237, 0.4);
    color: #fff;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: ${color.border} ${color.surface};
  }

  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-track { background: ${color.surface}; }
  *::-webkit-scrollbar-thumb { background: ${color.border}; border-radius: 9999px; }
  *::-webkit-scrollbar-thumb:hover { background: ${color.textMuted}; }

  html { scroll-behavior: smooth; }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid #7c3aed;
    outline-offset: 2px;
  }

  button:hover:not(:disabled),
  [role="button"]:hover:not(:disabled) { cursor: pointer; }

  .continuum-field input:hover:not(:disabled):not(:read-only),
  .continuum-field select:hover:not(:disabled),
  .continuum-field textarea:hover:not(:disabled):not(:read-only) {
    border-color: ${color.textMuted};
    background: #fafbfd;
  }

  .continuum-field input:focus,
  .continuum-field select:focus,
  .continuum-field textarea:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
  }

  .continuum-field + .continuum-field { margin-top: 4px; }

  .continuum-field input::placeholder,
  .continuum-field textarea::placeholder {
    color: ${color.textMuted};
    opacity: 0.7;
    font-style: normal;
  }

  .continuum-field input:disabled,
  .continuum-field select:disabled,
  .continuum-field textarea:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    background: ${color.surfaceAlt};
  }

  [data-continuum-collection-item],
  .continuum-collection-item {
    border: 1px solid ${color.border};
    border-radius: 14px;
    background: ${color.surfaceAlt};
    padding: 20px;
    display: grid;
    gap: 16px;
    position: relative;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  [data-continuum-collection-item]:hover,
  .continuum-collection-item:hover {
    border-color: ${color.textMuted};
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }

  .continuum-collection-item-actions {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  [data-continuum-collection-remove],
  .continuum-collection-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid ${color.border};
    background: ${color.surface};
    color: ${color.textMuted};
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
  }

  .continuum-collection-add-container {
    display: flex;
    justify-content: flex-end;
  }

  [data-continuum-collection-add],
  .continuum-collection-add {
    height: 38px;
    border-radius: 10px;
    border: 1px solid ${color.border};
    background: ${color.surface};
    color: ${color.text};
    padding: 0 16px;
    font: inherit;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    opacity: 1;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.1s ease;
  }

  [data-continuum-collection-add]:hover:not(:disabled),
  .continuum-collection-add:hover:not(:disabled) {
    border-color: ${color.textMuted};
    background: ${color.surfaceAlt};
  }

  [data-continuum-collection-add]:disabled,
  .continuum-collection-add:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  [data-continuum-collection-remove]:hover:not(:disabled),
  .continuum-collection-remove:hover:not(:disabled) {
    border-color: ${color.danger} !important;
    background: ${color.dangerBg} !important;
    color: ${color.danger} !important;
  }

  .continuum-fallback {
    border: 2px dashed ${color.danger};
    border-radius: 6px;
    padding: 12px;
    background: ${color.dangerBg};
    display: grid;
    gap: 8px;
  }

  .continuum-fallback-title {
    font-size: 11px;
    color: ${color.danger};
    font-weight: 600;
  }

  .continuum-fallback-input {
    display: block;
    width: 100%;
    padding: 4px 8px;
    border: 1px solid ${color.border};
    border-radius: 4px;
    box-sizing: border-box;
    background: ${color.surface};
    color: ${color.text};
  }

  .continuum-fallback-details {
    margin-top: 4px;
  }

  .continuum-fallback-summary {
    font-size: 11px;
    color: ${color.textMuted};
    cursor: pointer;
  }

  .continuum-fallback-pre {
    margin: 4px 0 0;
    font-size: 10px;
    overflow: auto;
    background: ${color.surface};
    border: 1px solid ${color.border};
    padding: 8px;
    border-radius: 4px;
  }

  @keyframes reconciliation-toast-enter {
    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes landing-gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  @keyframes landing-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }

  @keyframes landing-pulse-glow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  @keyframes landing-scan-line {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  @keyframes landing-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes landing-border-glow {
    0%, 100% { border-color: rgba(124, 58, 237, 0.3); box-shadow: 0 0 20px rgba(124, 58, 237, 0.1); }
    50% { border-color: rgba(34, 211, 238, 0.4); box-shadow: 0 0 30px rgba(34, 211, 238, 0.15); }
  }

  @keyframes landing-text-glow {
    0%, 100% { text-shadow: 0 0 20px rgba(124, 58, 237, 0.3); }
    50% { text-shadow: 0 0 40px rgba(124, 58, 237, 0.5), 0 0 80px rgba(34, 211, 238, 0.2); }
  }

  @keyframes landing-orb-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -20px) scale(1.05); }
    66% { transform: translate(-20px, 15px) scale(0.95); }
  }

  @keyframes landing-orb-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-25px, 25px) scale(0.97); }
    66% { transform: translate(15px, -30px) scale(1.03); }
  }

  @keyframes landing-flow-arrow {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }

  @keyframes landing-card-appear {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;
