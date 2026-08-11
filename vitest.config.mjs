import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/renderer/js/**/*.js'],
      exclude: ['src/renderer/js/app.js'],
      reporter: ['text', 'json-summary'],
    },
  },
});
