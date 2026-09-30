// Cross-platform wrapper: `npm run samples` writes sample PDFs to ./out for visual review.
import { existsSync } from 'node:fs';
import { startVitest } from 'vitest/node';

process.env.SAMPLES_DIR = 'out';
const vitest = await startVitest('test', ['tests/samples.test.ts'], { run: true, watch: false });
const failed = !vitest || vitest.state.getCountOfFailedTests() > 0;
await vitest?.close();
const missing = ['classic', 'modern', 'minimal'].filter((t) => !existsSync(`out/sample-${t}.pdf`));
if (failed || missing.length) {
  console.error('samples failed', missing.length ? `(missing: ${missing.join(', ')})` : '');
  process.exit(1);
}
console.log('samples written to ./out');
process.exit(0);
