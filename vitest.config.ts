import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
  plugins: [
    // This is required to build the test files with SWC
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
