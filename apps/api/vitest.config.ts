import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // All specs share one test database (see test/db.ts), so files
    // must not run in parallel against each other.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
  },
});
