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
    background: #d5ccff;
    color: ${color.text};
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: ${color.border} ${color.surface};
  }

  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  *::-webkit-scrollbar-track {
    background: ${color.surface};
  }

  *::-webkit-scrollbar-thumb {
    background: ${color.border};
    border-radius: 9999px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: ${color.textMuted};
  }

  html {
    scroll-behavior: smooth;
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid #5f3dd2;
    outline-offset: 2px;
  }

  button:hover:not(:disabled),
  [role="button"]:hover:not(:disabled) {
    cursor: pointer;
  }

  .continuum-field input:hover:not(:disabled):not(:read-only),
  .continuum-field select:hover:not(:disabled),
  .continuum-field textarea:hover:not(:disabled):not(:read-only) {
    border-color: ${color.textMuted};
  }

  .continuum-field input:focus,
  .continuum-field select:focus,
  .continuum-field textarea:focus {
    border-color: #5f3dd2;
    box-shadow: 0 0 0 2px rgba(95, 61, 210, 0.2);
  }

  .continuum-field + .continuum-field {
    margin-top: 0;
  }

  @keyframes reconciliation-toast-enter {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;

