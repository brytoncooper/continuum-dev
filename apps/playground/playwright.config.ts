import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { fileURLToPath } from 'node:url';

const baseURL = process.env['BASE_URL'] || 'http://localhost:5173';

export default defineConfig({
  ...nxE2EPreset(fileURLToPath(import.meta.url), { testDir: './e2e' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx nx run playground:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
