import { color } from './tokens';

export const globalStyles = `
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  ::selection {
    background: #bfdbfe;
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
`;

