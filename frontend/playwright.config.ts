import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/integration',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-failure',
  },
  projects: [
    {
      name: 'Chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
