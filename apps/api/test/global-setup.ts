import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Runs `prisma migrate deploy` against the TEST database once
 * before any spec file. Uses the session-mode TEST_DIRECT_URL
 * when set (DDL over a transaction pooler fails), else
 * TEST_DATABASE_URL. Throws when TEST_DATABASE_URL is missing
 * or equals DATABASE_URL — tests must never touch runtime data.
 */
export default async function globalSetup(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (testUrl === undefined || testUrl === '') {
    throw new Error('TEST_DATABASE_URL is not set in apps/api/.env');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL');
  }
  const directUrl = process.env.TEST_DIRECT_URL ?? testUrl;
  const apiDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DIRECT_URL: directUrl },
    stdio: 'inherit',
  });
}
