// Cross-platform wrapper: `npm run samples` writes sample PDFs to ./out for visual review.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const vitest = createRequire(import.meta.url).resolve('vitest/vitest.mjs');
const r = spawnSync(process.execPath, [vitest, 'run', 'tests/samples.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, SAMPLES_DIR: 'out' },
});
process.exit(r.status ?? 1);
